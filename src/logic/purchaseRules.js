// Reglas puras de compra y composición del resultado (RF-07, RF-08, RF-09
// de la Spec 005). 100% puro: sin @hashgraph/sdk, sin process.env, sin red,
// sin fs, sin Date.now, sin Math.random.
// Reutiliza las reglas de cantidad y el split half-up de la Spec 003
// (marketplace.js) por equivalencia, sin duplicar su semántica.
// Comentarios en español; código en inglés camelCase.
"use strict";

const { assertQuantityForAsset, roundHalfUp2 } = require("./marketplace.js");

// URL pública de una transacción en HashScan Testnet (verificabilidad, RNF-06).
function hashscanTxUrl(txId) {
  return "https://hashscan.io/testnet/transaction/" + txId;
}

// RF-07/RF-08/RF-09: valida la compra antes de tocar la red (rechazo pre-red).
// Reutiliza las reglas de cantidad de 003 (PAJ entero; BULL ≤4 decimales y ≤10)
// y calcula el total con el mismo redondeo half-up (R-REV-01).
function validatePurchaseInput(purchase, listing) {
  if (listing === null || typeof listing !== "object") {
    throw new Error("listado inválido");
  }
  // RF-09: listado cancelado bloquea nuevas compras sin mover activos.
  if (listing.cancelled === true || listing.canceled === true) {
    throw new Error("listado cerrado: el listado está cancelado");
  }
  const input = purchase || {};
  if (typeof input.listingId !== "string" || input.listingId.trim() === "") {
    throw new Error("listingId requerido");
  }
  // NB-3: si la compra declara assetType, debe coincidir con el del listado.
  if (
    input.assetType !== undefined &&
    input.assetType !== null &&
    input.assetType !== listing.assetType
  ) {
    throw new Error("activo no coincide con el listado");
  }
  // RF-09: precio unitario 0 (o negativo) rechazado (regla de listado de 003).
  if (typeof input.unitPriceUsd !== "number" || !Number.isFinite(input.unitPriceUsd) || input.unitPriceUsd <= 0) {
    throw new Error("precio debe ser > 0");
  }
  // NB-2: el precio de la compra debe coincidir con el del listado cuando este
  // lo declara (mismo criterio que 003: precio derivado de la tasación, en
  // céntimos exactos). Si el listado no trae unitPriceUsd, se omite el contraste
  // para no romper compras válidas existentes (compatibilidad con plan/spec).
  if (typeof listing.unitPriceUsd === "number" && Number.isFinite(listing.unitPriceUsd)) {
    if (Math.round(input.unitPriceUsd * 100) !== Math.round(listing.unitPriceUsd * 100)) {
      throw new Error("precio no coincide con el listado");
    }
  }
  // Reglas de cantidad por activo reutilizadas de 003 (sin duplicar):
  // PAJ_BRAF solo enteros; BULL hasta 4 decimales y ≤ supply 10.
  assertQuantityForAsset(input.quantity, listing.assetType);
  // Saldo disponible del listado.
  if (typeof listing.available !== "number" || !Number.isFinite(listing.available)) {
    throw new Error("disponible inválido en el listado");
  }
  if (input.quantity > listing.available) {
    throw new Error("saldo insuficiente: cantidad mayor que disponible");
  }
  // Total con el split/redondeo half-up de 003 (R-REV-01), sin recalcularlo.
  const totalUsd = roundHalfUp2(input.unitPriceUsd * input.quantity);
  return { purchase: { ...input, totalUsd } };
}

// RF-10/RF-15: compone la salida de una compra atómica confirmada.
// Sin receipt (atomicTxId + purchaseId) no hay compra atómica que componer.
function composePurchaseResult(receipt, split) {
  if (receipt === null || typeof receipt !== "object") {
    throw new Error("recibo de compra inválido");
  }
  if (typeof receipt.atomicTxId !== "string" || receipt.atomicTxId.trim() === "") {
    throw new Error("atomicTxId requerido: sin receipt no hay compra atómica");
  }
  if (typeof receipt.purchaseId !== "string" || receipt.purchaseId.trim() === "") {
    throw new Error("purchaseId requerido: sin receipt no hay compra atómica");
  }
  return {
    purchaseId: receipt.purchaseId,
    atomicTxId: receipt.atomicTxId,
    split,
    balances: {
      buyer: receipt.buyerBalanceBase,
      seller: receipt.sellerBalanceBase,
    },
    hashscanUrl: hashscanTxUrl(receipt.atomicTxId),
  };
}

module.exports = { validatePurchaseInput, composePurchaseResult };
