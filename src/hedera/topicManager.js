// Gestor del topic HCS de tasaciones (RF-01 crear, RF-02 reutilizar).
// Capa infraestructura: único lugar (junto a hcsClient) que toca @hashgraph/sdk.
// Sin process.env aquí: el topicId configurado llega por parámetro (viene de
// config/oracle.config.js). `deps.sdk` permite inyectar clases falsas en tests
// sin red ni node_modules; por defecto usa el SDK real (lazy require).
"use strict";

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

// Crea el topic de tasaciones y devuelve su topicId como string.
// Flujo SDK: TopicCreateTransaction → execute → getReceipt → receipt.topicId.
async function createValuationsTopic(client, options, deps) {
  const opts = options || {};
  const memo = opts.memo || "Muurketplace oracle v001";
  const sdk = resolveSdk(deps);
  const tx = new sdk.TopicCreateTransaction().setTopicMemo(memo);
  const txResponse = await tx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  return receipt.topicId.toString();
}

// Resuelve qué topic usar: crea si no hay configurado (RF-01),
// reutiliza el configurado si existe (RF-02), nunca crea en silencio
// un paralelo si el configurado falla (caso límite spec).
async function resolveValuationsTopic(client, configuredTopicId, options, deps) {
  // Sin topic configurado → crear uno nuevo (RF-01).
  if (configuredTopicId === null || configuredTopicId === undefined || configuredTopicId === "") {
    return createValuationsTopic(client, options, deps);
  }
  // Formato inválido → fallo explícito antes de tocar la red.
  if (!isValidTopicId(configuredTopicId)) {
    throw new Error("topicId malformado: debe tener formato 0.0.<n>");
  }
  // Validar existencia en red: si el topic no existe, error explícito
  // sin crear un paralelo silencioso (RF-02 + caso límite).
  const sdk = resolveSdk(deps);
  try {
    await new sdk.TopicInfoQuery().setTopicId(configuredTopicId).execute(client);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    if (message.includes("NOT_FOUND")) {
      throw new Error("topic configurado inexistente: revise HCS_VALUATIONS_TOPIC_ID");
    }
    throw err;
  }
  return configuredTopicId;
}

module.exports = { createValuationsTopic, resolveValuationsTopic };
