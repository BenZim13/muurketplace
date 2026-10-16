// Configuración de tokens HTS — único lector de nombres/símbolos/decimales/supply.
// Patrón espejo de config/oracle.config.js: recibe `env` (o config object) para ser testeable
// sin tocar process.env. Sin SDK, sin red, sin secretos: los valores son públicos operativos
// (plan §1.3, T-05/T-06).

// Símbolos y nombres de los tokens del par por animal/lote.
const PAJ_BRAF = {
  name: "Genética Braford PAJ-BRAF",
  symbol: "PAJ-BRAF",
  decimals: 0,
  maxSupply: null,
};

const BULL = {
  name: "Muurka BULL",
  symbol: "BULL",
  decimals: 4,
  maxSupply: 10, // supply máximo 10 unidades (RNF-01/B2)
};

// Carga la configuración de tokens desde un object config (o process.env simulado).
function loadTokenConfig(env) {
  const source = env || {};
  const network = source.HEDERA_NETWORK || "testnet";

  const rawContractId =
    source.MURKETPLACE_ATOMIC_CONTRACT_ID !== undefined
      ? source.MURKETPLACE_ATOMIC_CONTRACT_ID
      : source.MARKETPLACE_CONTRACT_ID !== undefined
      ? source.MARKETPLACE_CONTRACT_ID
      : source.contractId !== undefined
      ? source.contractId
      : null;

  let contractId = null;
  if (rawContractId !== null && rawContractId !== undefined && rawContractId !== "") {
    if (!/^0\.0\.\d+$/.test(rawContractId)) {
      throw new Error("configuración inválida: contractId debe tener formato 0.0.<número>");
    }
    contractId = rawContractId;
  }

  const pajBraf = { ...PAJ_BRAF };
  const bull = { ...BULL };

  return { network, contractId, pajBraf, bull, paj: pajBraf };
}

module.exports = { loadTokenConfig, PAJ_BRAF, BULL };