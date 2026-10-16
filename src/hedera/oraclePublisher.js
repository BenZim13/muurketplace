// Publisher del oráculo HCS (T4: RF-03 veto + RF-04 publica 1 mensaje;
// T5: RF-07 reintentos acotados + RF-08 idempotencia de borde).
// Capa infraestructura: único lugar (junto a hcsClient/topicManager) que toca
// @hashgraph/sdk. Sin process.env aquí: todo llega por parámetros.
// `submitFn`/`sleepFn` inyectables permiten tests sin red; `deps.sdk` permite
// clases falsas. `Math.random` solo aquí (jitter de backoff), nunca en src/logic/.
"use strict";

const { buildOracleMessage } = require("../logic/oracleMessage.js");

// Reintentos acotados (plan §1.4 T-03): 3 reintentos tras el intento inicial.
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
// Jitter uniforme 0..250 ms para evitar tormentas contra Testnet.
const BACKOFF_JITTER_MS = 250;

// Tasaciones ya confirmadas por la red: valuationKey+topic → proof original.
// Evita reenviar aunque el caller reintente tras un receipt (RF-08).
const proofCache = new Map();
// Publicaciones en curso: misma clave → el concurrente lanza "en curso"
// sin lanzar un segundo `execute` (RF-08 MIENTRAS).
const inFlight = new Map();

// Limpia el estado de borde (caché + vuelos). Solo para tests.
function clearPublisherState() {
  proofCache.clear();
  inFlight.clear();
}

// Formato válido Hedera: 0.0.<número>
function isValidTopicId(value) {
  return typeof value === "string" && /^0\.0\.\d+$/.test(value);
}

// Resuelve las clases SDK (reales o inyectadas para tests sin red).
function resolveSdk(deps) {
  if (deps && deps.sdk) {
    return deps.sdk;
  }
  return require("@hashgraph/sdk");
}

// Envío por defecto contra la red real (solo se usa sin submitFn inyectado).
async function defaultSubmitFn(tx, client) {
  return tx.execute(client);
}

// Espera real entre reintentos (inyectable vía options.sleepFn en tests).
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Texto normalizado de un error (código + mensaje) para clasificarlo.
function errorText(err) {
  if (!err) {
    return "";
  }
  if (typeof err === "string") {
    return err.toUpperCase();
  }
  const parts = [];
  if (err.code !== undefined && err.code !== null) {
    parts.push(String(err.code));
  }
  if (err.message !== undefined && err.message !== null) {
    parts.push(String(err.message));
  }
  const joined = parts.join(" ").toUpperCase();
  if (joined.trim().length > 0) {
    return joined;
  }
  try {
    return String(err).toUpperCase();
  } catch {
    return "";
  }
}

// Patrones que NUNCA se reintentan: reintentar es inútil o incorrecto.
const NON_RETRYABLE_PATTERNS = [
  "INSUFFICIENT_TX_FEE",
  "INVALID_SIGNATURE",
  "INVALID_ACCOUNT",
  "CREDENCIAL",
  "CREDENTIAL",
  "UNAUTHORIZED",
  "UNAUTHENTICATED",
  "RECHAZADO",
  "APTOS REGISTRABLES",
  "APTO DEBE",
  "MALFORMADO",
  "CONFIGURACI",
  "INEXISTENTE",
  "INVALID_TOPIC",
  "NOT_FOUND",
  "TOPIC_DELETED",
  "SPEC-VERSION",
];

// Patrones retryables: timeout/red, consenso no disponible o transacción
// expirada, y fallo de getReceipt / prueba ausente (plan §1.4 T-03).
const RETRYABLE_PATTERNS = [
  "TIMEOUT",
  "TIMED_OUT",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "UNAVAILABLE",
  "TRANSACTION_EXPIRED",
  "BUSY",
  "INTERNAL_ERROR",
  "SOCKET",
  "NETWORK",
  "CONSENSUS",
  "CONNECTION",
  "TRY_AGAIN",
  "RECEIPT",
  "SIN PRUEBA",
  "NO CONFIRMADO",
];

// Dice si un fallo de publicación merece reintento con backoff.
// Lo no-retryable (credenciales, apto=false, topic inexistente, fee)
// falla de inmediato; lo desconocido también (no se adivina).
function isRetryableError(err) {
  const text = errorText(err);
  if (text.length === 0) {
    return false;
  }
  for (const pattern of NON_RETRYABLE_PATTERNS) {
    if (text.includes(pattern)) {
      return false;
    }
  }
  for (const pattern of RETRYABLE_PATTERNS) {
    if (text.includes(pattern)) {
      return true;
    }
  }
  return false;
}

// Backoff exponencial con jitter: base * 2^attempt + aleatorio(0..250).
// attempt 0 = espera tras el primer fallo; base por defecto 1000 ms.
function computeBackoffMs(attempt, baseDelayMs) {
  const base =
    typeof baseDelayMs === "number" && Number.isFinite(baseDelayMs) && baseDelayMs >= 0
      ? baseDelayMs
      : DEFAULT_BASE_DELAY_MS;
  const safeAttempt =
    Number.isInteger(attempt) && attempt >= 0 ? attempt : 0;
  const jitter = Math.floor(Math.random() * (BACKOFF_JITTER_MS + 1));
  return base * 2 ** safeAttempt + jitter;
}

// Publica exactamente 1 mensaje de tasación APTA y devuelve la prueba.
// RF-03: si apto !== true lanza con motivos SIN tocar la red.
// RF-04: si apto === true construye el mensaje canónico (specVersion "001",
// publishedAt por parámetro) y hace 1 submit, devolviendo la prueba solo
// tras receipt (RNF-04): { topicId, sequenceNumber, consensusTimestamp, transactionId }.
// RF-07: ante error retryable reintenta hasta maxRetries con backoff y nunca
// confirma sin prueba. RF-08: concurrente misma tasación lanza "en curso" y
// tras receipt previo devuelve la prueba original sin reenviar.
async function publishValuation(client, topicId, bullInput, bullResult, options, deps) {
  const opts = options || {};

  // Veto RECHAZADOS antes de construir mensaje y antes de tocar red (RF-03).
  if (!bullResult || bullResult.apto !== true) {
    const reasons =
      bullResult && Array.isArray(bullResult.motivosRechazo)
        ? bullResult.motivosRechazo.join("; ")
        : "motivos no informados";
    throw new Error("registro rechazado: solo APTOS registrables — motivos: " + reasons);
  }

  // Falla explícito ante topic malformado antes de tocar la red.
  if (!isValidTopicId(topicId)) {
    throw new Error("topicId malformado: debe tener formato 0.0.<n>");
  }

  // publishedAt por parámetro (pureza: oracleMessage no usa Date.now interno).
  if (!opts.publishedAt || typeof opts.publishedAt !== "string") {
    throw new Error("publishedAt requerido: instante ISO-8601 por parámetro");
  }

  const maxRetries =
    Number.isInteger(opts.maxRetries) && opts.maxRetries >= 0
      ? opts.maxRetries
      : DEFAULT_MAX_RETRIES;
  const baseDelayMs =
    typeof opts.baseDelayMs === "number" && Number.isFinite(opts.baseDelayMs) && opts.baseDelayMs >= 0
      ? opts.baseDelayMs
      : DEFAULT_BASE_DELAY_MS;
  const submitFn = typeof opts.submitFn === "function" ? opts.submitFn : defaultSubmitFn;
  const sleepFn = typeof opts.sleepFn === "function" ? opts.sleepFn : defaultSleep;

  // Construye el mensaje canónico (también lanza si tasación ausente o specVersion inválida).
  const built = buildOracleMessage(bullInput, bullResult, {
    publishedAt: opts.publishedAt,
    specVersion: "001",
  });
  const canonicalJson = built.canonicalJson;

  // Clave de borde: misma tasación + mismo topic comparten vuelo y caché.
  const dedupKey = topicId + ":" + built.valuationKey;

  // Idempotencia: si ya hay receipt para esta tasación, no se reenvía (RF-08).
  if (proofCache.has(dedupKey)) {
    return proofCache.get(dedupKey);
  }

  // Guarda MIENTRAS: un reintento en curso veta el duplicado concurrente (RF-08).
  if (inFlight.has(dedupKey)) {
    throw new Error("publicación en curso para esta tasación: reintento ya activo");
  }
  inFlight.set(dedupKey, true);

  try {
    // Bucle 0..maxRetries: intento inicial + reintentos acotados (RF-07).
    for (let attempt = 0; ; attempt += 1) {
      try {
        // Un solo mensaje por tasación (RNF-03: costo acotado a 1 HCS-msg).
        // La transacción se reconstruye en cada intento (el SDK no re-ejecuta).
        const sdk = resolveSdk(deps);
        const tx = new sdk.TopicMessageSubmitTransaction()
          .setTopicId(topicId)
          .setMessage(canonicalJson);

        const txResponse = await submitFn(tx, client);

        // Solo se confirma con prueba de consenso: si el submit devuelve un
        // manejador con getReceipt, se espera al receipt; si devuelve la prueba
        // directa (mocks), se usa tal cual.
        let receipt = txResponse;
        if (txResponse && typeof txResponse.getReceipt === "function") {
          receipt = await txResponse.getReceipt(client);
        }
        const source = receipt || {};
        const fallback = txResponse || {};
        const sequenceNumber = String(
          source.topicSequenceNumber ?? fallback.sequenceNumber ?? source.sequenceNumber ?? ""
        );
        const consensusTimestamp = String(
          fallback.consensusTimestamp ?? source.consensusTimestamp ?? ""
        );
        const transactionId = String(
          fallback.transactionId ?? source.transactionId ?? ""
        );

        // Sin prueba completa no hay confirmación: se trata como fallo
        // retryable (posible getReceipt sin receipt) y se reintenta (RNF-04).
        if (!sequenceNumber || !consensusTimestamp || !transactionId) {
          throw new Error("registro no confirmado: sin prueba de consenso de la red");
        }

        const proof = { topicId, sequenceNumber, consensusTimestamp, transactionId };
        proofCache.set(dedupKey, proof);
        return proof;
      } catch (err) {
        // Error no-retryable: falla de inmediato sin más intentos.
        if (!isRetryableError(err)) {
          throw err;
        }
        // Reintentos agotados: error explícito sin proof (nunca confirmar).
        if (attempt >= maxRetries) {
          const detail = err && err.message ? err.message : String(err);
          throw new Error(
            "registro no confirmado tras " + (attempt + 1) + " intentos: " + detail
          );
        }
        // Espera exponencial con jitter antes del siguiente intento.
        await sleepFn(computeBackoffMs(attempt, baseDelayMs));
      }
    }
  } finally {
    inFlight.delete(dedupKey);
  }
}

module.exports = { publishValuation, isRetryableError, computeBackoffMs, clearPublisherState };
