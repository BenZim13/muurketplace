// Verificador del oráculo HCS (T6: RF-06 con 3 estados, sin falsos negativos).
// Capa infraestructura: consulta el mirror node REST vía `mirrorFetch`
// inyectado (sin red en tests). Nunca usa @hashgraph/sdk ni credenciales:
// la verificación es pública (RNF-07). Nunca devuelve NOT_FOUND definitivo.
"use strict";

const { verifyMessageContent } = require("../logic/oracleMessage.js");

// Valores del plan §1.5/§2.3 T-06/T-07: gracia 60 s, reintento sugerido 5 s,
// timeout de fetch 10 s, solo Testnet.
const DEFAULT_MIRROR_BASE_URL = "https://testnet.mirrornode.hedera.com";
const DEFAULT_GRACE_PERIOD_MS = 60000;
const DEFAULT_RETRY_AFTER_MS = 5000;
const DEFAULT_TIMEOUT_MS = 10000;

// Formato válido Hedera: 0.0.<número>
function isValidTopicId(value) {
  return typeof value === "string" && /^0\.0\.\d+$/.test(value);
}

// Convierte "seconds.nanos" del consenso a milisegundos (entero).
// Devuelve null si no se puede interpretar (se trata como dentro de gracia).
function consensusTimestampToMs(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const parts = value.split(".");
  const seconds = Number(parts[0]);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  return Math.floor(seconds * 1000);
}

// Extrae el primer mensaje del payload del mirror (forma { messages: [...] }).
function firstMirrorEntry(raw) {
  if (!raw) {
    return null;
  }
  const list = Array.isArray(raw) ? raw : raw.messages;
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  return list[0] || null;
}

// Decodifica el contenido base64→utf8 que sirve el mirror node.
function decodeMirrorContents(entry) {
  const encoded =
    entry.message !== undefined && entry.message !== null
      ? entry.message
      : entry.contents;
  if (typeof encoded !== "string" || encoded.length === 0) {
    throw new Error("mensaje del mirror vacío o ausente");
  }
  return Buffer.from(encoded, "base64").toString("utf8");
}

// Fetch por defecto contra el mirror real con timeout de 10 s.
// Solo se usa cuando no se inyecta `mirrorFetch` (E2E T7).
async function defaultMirrorFetch(url, timeoutMs) {
  const timeout =
    typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error("mirror responde " + response.status);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Verifica una tasación contra el mirror node con 3 estados (plan §1.5):
// VERIFIED (canónico idéntico), MISMATCH (existe pero difiere, con diff) o
// PENDING (no concluyente: not-yet-synced / mirror-unavailable /
// not-found-after-grace, con retryAfterMs). Nunca NOT_FOUND definitivo.
async function verifyValuation(proof, expectedMessage, options) {
  const opts = options || {};
  const gracePeriodMs =
    typeof opts.gracePeriodMs === "number" && Number.isFinite(opts.gracePeriodMs) && opts.gracePeriodMs >= 0
      ? opts.gracePeriodMs
      : DEFAULT_GRACE_PERIOD_MS;
  const retryAfterMs =
    typeof opts.retryAfterMs === "number" && Number.isFinite(opts.retryAfterMs) && opts.retryAfterMs > 0
      ? opts.retryAfterMs
      : DEFAULT_RETRY_AFTER_MS;
  const mirrorBaseUrl =
    typeof opts.mirrorBaseUrl === "string" && opts.mirrorBaseUrl.length > 0
      ? opts.mirrorBaseUrl.replace(/\/+$/, "")
      : DEFAULT_MIRROR_BASE_URL;
  const nowMs =
    typeof opts.nowMs === "number" && Number.isFinite(opts.nowMs)
      ? opts.nowMs
      : Date.now();
  const mirrorFetch =
    typeof opts.mirrorFetch === "function"
      ? opts.mirrorFetch
      : (url) => defaultMirrorFetch(url, opts.timeoutMs);

  // Proof mínima: topicId válido + al menos sequenceNumber o transactionId.
  if (!proof || !isValidTopicId(proof.topicId)) {
    throw new Error("proof inválida: topicId con formato 0.0.<n> requerido");
  }
  const hasSequence =
    proof.sequenceNumber !== undefined &&
    proof.sequenceNumber !== null &&
    String(proof.sequenceNumber).length > 0;
  const hasTransaction =
    proof.transactionId !== undefined &&
    proof.transactionId !== null &&
    String(proof.transactionId).length > 0;
  if (!hasSequence && !hasTransaction) {
    throw new Error("proof inválida: sequenceNumber o transactionId requerido");
  }

  // El verificador exige specVersion 001 en lo esperado (plan §1.4 T-02).
  if (!expectedMessage || expectedMessage.specVersion !== "001") {
    return {
      status: "MISMATCH",
      reason: "spec-version no soportada: solo 001",
      diff: ["specVersion"],
    };
  }

  // Construye la URL del mirror según la prueba disponible.
  let url;
  if (hasSequence) {
    url =
      mirrorBaseUrl +
      "/api/v1/topics/" +
      proof.topicId +
      "/messages?sequenceNumber=" +
      encodeURIComponent(String(proof.sequenceNumber));
  } else {
    url =
      mirrorBaseUrl +
      "/api/v1/transactions/" +
      encodeURIComponent(String(proof.transactionId));
  }

  // Consulta al mirror: si cae o es transitorio, no es negativo, es PENDING.
  let raw;
  try {
    raw = await mirrorFetch(url);
  } catch {
    return { status: "PENDING", reason: "mirror-unavailable", retryAfterMs };
  }

  const entry = firstMirrorEntry(raw);
  if (!entry) {
    // Vacío: dentro de gracia es lag de sincronización; fuera de gracia se
    // sigue reportando PENDING para no declarar falsos negativos (plan §1.5).
    const consensusMs = consensusTimestampToMs(proof.consensusTimestamp);
    const ageMs = consensusMs === null ? 0 : nowMs - consensusMs;
    if (ageMs <= gracePeriodMs) {
      return { status: "PENDING", reason: "not-yet-synced", retryAfterMs };
    }
    return { status: "PENDING", reason: "not-found-after-grace", retryAfterMs };
  }

  // Decodifica contents base64→utf8 y compara íntegramente por valor.
  let retrievedText;
  try {
    retrievedText = decodeMirrorContents(entry);
  } catch {
    return { status: "PENDING", reason: "mirror-unavailable", retryAfterMs };
  }
  let retrieved;
  try {
    retrieved = JSON.parse(retrievedText);
  } catch {
    return {
      status: "MISMATCH",
      reason: "mensaje del mirror no es JSON válido",
      diff: ["(root)"],
    };
  }

  // Versión de spec del mensaje recuperado también debe ser 001.
  if (retrieved.specVersion !== "001") {
    const detail =
      retrieved.specVersion === undefined
        ? "ausente"
        : "encontrada " + JSON.stringify(retrieved.specVersion);
    return {
      status: "MISMATCH",
      reason: "spec-version no soportada (" + detail + "): solo 001",
      diff: ["specVersion"],
    };
  }

  // Comparación canónica exacta (24.5 vs 24.50 VERIFIED; 2.45 vs 2.46 MISMATCH).
  const compared = verifyMessageContent(retrieved, expectedMessage);
  if (compared.status === "VERIFIED") {
    return { status: "VERIFIED" };
  }
  return {
    status: "MISMATCH",
    reason: "content-mismatch: el mensaje existe pero difiere",
    diff: Array.isArray(compared.diff) ? compared.diff : [],
  };
}

module.exports = {
  verifyValuation,
  DEFAULT_MIRROR_BASE_URL,
  DEFAULT_GRACE_PERIOD_MS,
  DEFAULT_RETRY_AFTER_MS,
};
