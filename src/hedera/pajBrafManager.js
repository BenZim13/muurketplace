// Token manager HTS de PAJ-BRAF — Spec 005 RF-01.
// Crea y emite un token fungible PAJ-BRAF (0 decimales) con claves Admin+Treasury.
// Treasury = cuenta de la cabaña. Lote completo al minteo.
// Capa de interacción Hedera; el SDK solo aquí, nunca en src/logic/.
// Sin process.env: todo viene por parámetro/config (inyectable para tests).

// Configuración por defecto PAJ-BRAF (valores constantes, sin importar el SDK)
const PAJ_BRAF = {
  name: "Muurka PAJ-BRAF",
  symbol: "PAJ",
  decimals: 0,
};

// Crea una TokenCreateTransaction para PAJ-BRAF.
// Recibe un objeto `deps` con el SDK inyectado y parámetros de configuración.
// Sin process.env, todo por parámetro. Claves nunca impresas en logs.
function createPajBrafToken({ deps, treasuryAccountId, adminKey, }) {
  const sdk = deps && deps.sdk ? deps.sdk : require("@hashgraph/sdk");

  if (treasuryAccountId === undefined || treasuryAccountId === null || treasuryAccountId === "") {
    throw new Error("treasuryAccountId requerida para crear token PAJ-BRAF");
  }
  if (adminKey === undefined || adminKey === null) {
    throw new Error("adminKey requerida para crear token PAJ-BRAF");
  }

  const createTx = new sdk.TokenCreateTransaction()
    .setTokenName(PAJ_BRAF.name)
    .setTokenSymbol(PAJ_BRAF.symbol)
    .setDecimals(PAJ_BRAF.decimals) // 0 decimales
    .setTreasuryKey(adminKey)
    .setAdminKey(adminKey)
    .setSupplyKey(adminKey)
    .setTreasuryAccountId(treasuryAccountId)
    .setInitialSupply(0); // se minta el lote después

  return createTx;
}

// Minta (emite) el lote completo de tokens PAJ-BRAF.
// Recibe el tokenId y amount, y retorna la TokenMintTransaction.
function mintPajBrafToken({ deps, tokenId, amount, }) {
  const sdk = deps && deps.sdk ? deps.sdk : require("@hashgraph/sdk");

  if (tokenId === undefined || tokenId === null) {
    throw new Error("tokenId requerido para mintear PAJ-BRAF");
  }
  if (amount === undefined || amount === null) {
    throw new Error("amount (supply total) requerido para mintear PAJ-BRAF");
  }

  const mintTx = new sdk.TokenMintTransaction()
    .setTokenId(tokenId)
    .setAmount(amount);

  return mintTx;
}

// Flujo completo: create + mint. Recibe deps inyectables y config.
// Devrece un objeto con createTx, mintTx y metadatos (sin imprimir claves).
function createAndMintPajBrafToken({ deps, treasuryAccountId, adminKey, mintAmount, }) {
  const createTx = createPajBrafToken({ deps, treasuryAccountId, adminKey });
  const mintTx = mintPajBrafToken({ deps, tokenId: null, amount: mintAmount });

  // En implementación real contra Testnet, aquí se firmarían y ejecutarían
  // las transacciones, y se retornaría el receipt con tokenId.
  // Para tests con SDK falso, los dobles proveen el receipt directamente.

  return {
    createTx,
    mintTx,
    // tokenId vendrá del receipt del createTx en ejecución real
  };
}

// Exporta la configuración para que los tests puedan verificar constantes
module.exports = {
  createPajBrafToken,
  mintPajBrafToken,
  createAndMintPajBrafToken,
  PAJ_BRAF,
};