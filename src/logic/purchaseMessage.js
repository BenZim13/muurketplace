// Mensaje canónico de compra en HCS (RF-13, RF-14, RF-16 de la Spec 005).
// Discriminado del mensaje de tasación de la Spec 002 por kind="purchase" y
// specVersion="005" (vs. specVersion="001"). 100% puro: sin SDK, sin red,
// sin fs, sin Date.now, sin Math.random; publishedAt llega por parámetro.
// Reutiliza toCanonicalJson/verifyMessageContent/sha256Hex de oracleMessage.js.
// Comentarios en español; código en inglés camelCase.
"use strict";

const {
  toCanonicalJson,
  verifyMessageContent,
  sha256Hex,
} = require("./oracleMessage.js");

// Activos HTS admitidos en una compra (par propio por animal/lote).
const VALID_ASSET_TYPES = ["PAJ_BRAF", "BULL"];

// RF-13/RF-14: construye el mensaje canónico de compra y su purchaseKey estable.
// El purchaseKey es el sha256 del mensaje SIN la propia clave (idempotencia).
function buildPurchaseMessage(purchase, meta) {
  const input = purchase || {};
  // Discriminador de activo: solo el par de tokens de la Spec 005.
  if (!VALID_ASSET_TYPES.includes(input.assetType)) {
    throw new Error("activo inválido: debe ser PAJ_BRAF o BULL");
  }
  const params = meta || {};
  // Instante de publicación por parámetro (pureza: nunca Date.now interno).
  if (typeof params.publishedAt !== "string") {
    throw new Error("publishedAt requerido: instante ISO-8601 por parámetro");
  }
  // Mensaje sin purchaseKey para derivar el hash estable.
  const messageSinKey = {
    kind: "purchase",
    specVersion: "005",
    schemaVersion: 1,
    bullId: input.bullId,
    assetType: input.assetType,
    tokenId: input.tokenId,
    quantity: input.quantity,
    listingId: input.listingId,
    purchaseId: input.purchaseId,
    buyerAccountId: input.buyerAccountId,
    sellerAccountId: input.sellerAccountId,
    atomicTxId: input.atomicTxId,
    publishedAt: params.publishedAt,
  };
  const purchaseKey = sha256Hex(toCanonicalJson(messageSinKey));
  const message = { ...messageSinKey, purchaseKey };
  return { message, canonicalJson: toCanonicalJson(message), purchaseKey };
}

// RF-13/RF-16: coincide íntegramente una compra recuperada con la esperada.
// Rechaza primero por discriminador (para no confundir con el mensaje de
// tasación de 002, specVersion "001") y luego compara por valor profundo.
function verifyPurchaseMessageContent(retrievedJson, expectedMessage) {
  const retrieved =
    typeof retrievedJson === "string" ? JSON.parse(retrievedJson) : retrievedJson;
  // Discriminador: solo mensajes de compra de la Spec 005 son candidatos.
  if (!retrieved || retrieved.kind !== "purchase" || retrieved.specVersion !== "005") {
    return { status: "MISMATCH", diff: ["kind/specVersion"] };
  }
  // Comparación por valor profundo reutilizando oracleMessage.js.
  return verifyMessageContent(retrieved, expectedMessage);
}

module.exports = { buildPurchaseMessage, verifyPurchaseMessageContent };
