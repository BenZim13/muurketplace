// Token manager HTS de PAJ-BRAF — Spec 005 RF-01.
// Crea y emite un token fungible PAJ-BRAF (0 decimales) con claves Admin+Treasury.
// Treasury = cuenta de la cabaña. Lote completo al minteo.
// Capa de interacción Hedera; el SDK solo aquí, nunca en src/logic/.
// Sin process.env: todo viene por parámetro/config (inyectable para tests).

// Configuración por defecto PAJ-BRAF (valores constantes, sin importar el SDK)
const PAJ_BRAF = {
  name: "Genética Braford PAJ-BRAF",
  symbol: "PAJ-BRAF",
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

// Flujo completo: create + mint según Spec 005 RF-01.
async function tokenizePajBraf(client, options = {}, deps = {}) {
  const { treasuryAccountId, pajuelaCount, adminKey, supplyKey, tokenName, tokenSymbol } = options;

  if (pajuelaCount === undefined || pajuelaCount === null || typeof pajuelaCount !== "number" || pajuelaCount <= 0 || !Number.isInteger(pajuelaCount)) {
    throw new Error("pajuelaCount entero mayor a 0 requerido para emitir PAJ-BRAF");
  }
  if (!adminKey) {
    throw new Error("adminKey requerida para crear token PAJ-BRAF");
  }
  if (!supplyKey) {
    throw new Error("supplyKey requerida para crear token PAJ-BRAF");
  }
  if (!treasuryAccountId || typeof treasuryAccountId !== "string" || !/^0\.0\.\d+$/.test(treasuryAccountId)) {
    throw new Error("treasuryAccountId requerida con formato 0.0.<n> para crear token PAJ-BRAF");
  }

  const sdk = deps && deps.sdk ? deps.sdk : require("@hashgraph/sdk");

  const createTx = new sdk.TokenCreateTransaction()
    .setTokenName(tokenName || PAJ_BRAF.name)
    .setTokenSymbol(tokenSymbol || PAJ_BRAF.symbol)
    .setDecimals(PAJ_BRAF.decimals)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryAccountId)
    .setAdminKey(adminKey)
    .setSupplyKey(supplyKey);

  const createResponse = await createTx.execute(client);
  const createReceipt = await createResponse.getReceipt(client);
  const tokenId = createReceipt.tokenId.toString();

  const mintTx = new sdk.TokenMintTransaction()
    .setTokenId(tokenId)
    .setAmount(pajuelaCount);

  const mintResponse = await mintTx.execute(client);
  await mintResponse.getReceipt(client);
  const txId = mintResponse.transactionId ? mintResponse.transactionId.toString() : "";

  return {
    tokenId,
    supply: pajuelaCount,
    txId,
  };
}

// Exporta las funciones y constantes
module.exports = {
  createPajBrafToken,
  mintPajBrafToken,
  tokenizePajBraf,
  PAJ_BRAF,
};