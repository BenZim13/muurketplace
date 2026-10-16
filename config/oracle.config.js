// Configuración del oráculo HCS — único lector de HCS_VALUATIONS_TOPIC_ID.
// Sin secretos nuevos: topicId es público pero operativo (plan §1.3).
// Recibe `env` como parámetro para ser testeable sin tocar process.env.

// Formato válido Hedera: 0.0.<número>
function isValidTopicId(value) {
  return typeof value === "string" && /^0\.0\.\d+$/.test(value);
}

// Carga la configuración operativa del oráculo desde variables de entorno.
function loadOracleConfig(env) {
  const source = env || {};
  const raw = source.HCS_VALUATIONS_TOPIC_ID;

  // Ausente o vacío → no configurado: el caller debe crear el topic (RF-01).
  if (raw === undefined || raw === null || raw === "") {
    return { topicId: null, network: "testnet", maxRetries: 3, baseDelayMs: 1000 };
  }

  // Presente pero malformado → fallo explícito antes de tocar red.
  if (!isValidTopicId(raw)) {
    throw new Error("configuración inválida: HCS_VALUATIONS_TOPIC_ID debe tener formato 0.0.<n>");
  }

  return { topicId: raw, network: "testnet", maxRetries: 3, baseDelayMs: 1000 };
}

module.exports = { loadOracleConfig };
