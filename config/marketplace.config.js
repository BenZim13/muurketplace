// Configuración del marketplace HSCS — único lector de MARKETPLACE_CONTRACT_ID.
// Patrón espejo de config/oracle.config.js: recibe `env` para ser testeable sin tocar process.env.
// Sin SDK, sin red, sin secretos: contractId es público pero operativo (plan §1.3, T-09).

// Formato válido Hedera: 0.0.<número>
function isValidContractId(value) {
  return typeof value === "string" && /^0\.0\.\d+$/.test(value);
}

// Carga la configuración operativa del marketplace desde variables de entorno.
function loadMarketplaceConfig(env) {
  const source = env || {};
  const raw = source.MARKETPLACE_CONTRACT_ID;

  // Ausente o vacío → no configurado: el caller debe desplegar/configurar (base RF-01/RF-04).
  if (raw === undefined || raw === null || raw === "") {
    return { contractId: null, network: "testnet", confirmTimeoutMs: 15000 };
  }

  // Presente pero malformado → fallo explícito antes de tocar red.
  if (!isValidContractId(raw)) {
    throw new Error("configuración inválida: MARKETPLACE_CONTRACT_ID debe tener formato 0.0.<n>");
  }

  return { contractId: raw, network: "testnet", confirmTimeoutMs: 15000 };
}

module.exports = { loadMarketplaceConfig };
