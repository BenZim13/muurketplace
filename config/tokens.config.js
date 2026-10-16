// Configuración de tokens HTS — único lector de nombres/símbolos/decimales/supply.
// Patrón espejo de config/oracle.config.js: recibe `env` (o config object) para ser testeable
// sin tocar process.env. Sin SDK, sin red, sin secretos: los valores son públicos operativos
// (plan §1.3, T-05/T-06).

// Símbolos y nombres de los tokens del par por animal/lote.
const PAJ_BRAF = {
  name: "Muurka PAJ-BRAF",
  symbol: "PAJ",
  decimals: 0,
  maxSupply: null, // ilimitado por lote; la cantidad se controla por el supply de BULL y reglas de negocio
};

const BULL = {
  name: "Muurka BULL",
  symbol: "BULL",
  decimals: 4,
  maxSupply: 10, // supply máximo 10 unidades (RNF-01/B2)
};

// Carga la configuración de tokens desde un object config (o process.env simulado).
// Devuelve un objeto plano con los parámetros necesarios para los token managers.
// Si no se provee `env`, usa los valores por defecto (útil para tests con dobles).
function loadTokenConfig(env) {
  const source = env || {};

  // PAJ-BRAF: siempre 0 decimales, nombre/símbolo fijos
  const paj = { ...PAJ_BRAF };
  // BULL: siempre 4 decimales, supply máximo 10, nombre/símbolo fijos
  const bull = { ...BULL, supply: typeof source.bullSupply === "number" && source.bullSupply > 0 && source.bullSupply <= 10 ? source.bullSupply : 10 };

  // contractId de MuurketplaceAtomic: si viene en la config, se valida formato; si no, null
  let contractId = null;
  const rawContractId = source.contractId;
  if (typeof rawContractId === "string" && rawContractId !== "") {
    // Formato Hedera: 0.0.<número>
    if (/^0\.0\.\d+$/.test(rawContractId)) {
      contractId = rawContractId;
    }
  }

  return { paj, bull, contractId };
}

module.exports = { loadTokenConfig };