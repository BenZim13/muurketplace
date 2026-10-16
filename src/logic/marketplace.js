// Split puro de regalías del marketplace (RF-05 + EA-01, plan §2.2 R-REV-01).
// Lógica pura: sin SDK, sin entorno, sin red, sin tiempo ni azar.
// El redondeo half-up vive solo en pricing.js y aquí se reutiliza.
"use strict";

const { roundHalfUp2 } = require("./pricing.js");

// Calcula el reparto de una venta: regalía con half-up a 2 decimales
// y parte del vendedor por resta exacta en céntimos enteros.
// El residuo de medio céntimo queda siempre en el vendedor, de modo
// que royaltyUsd + sellerUsd === totalUsd en cada venta.
function calculateSplit(totalUsd, royaltyPct) {
  // Porcentaje inmutable por listado: solo 0-100, ambos bordes válidos.
  if (typeof royaltyPct !== "number" || !Number.isFinite(royaltyPct) || royaltyPct < 0 || royaltyPct > 100) {
    throw new Error("royalty fuera de rango 0-100");
  }
  // Total en USD: número finito no negativo.
  if (typeof totalUsd !== "number" || !Number.isFinite(totalUsd) || totalUsd < 0) {
    throw new Error("total inválido: debe ser número finito >= 0");
  }
  // Todo el dinero se maneja en céntimos enteros para resta exacta.
  const totalCents = Math.round(totalUsd * 100);
  const total = totalCents / 100;
  // Un solo redondeo half-up sobre la regalía (semántica de pricing.js).
  const royalty = roundHalfUp2((total * royaltyPct) / 100);
  const royaltyCents = Math.round(royalty * 100);
  // El vendedor cobra por resta exacta: absorbe el residuo de medio céntimo.
  const sellerCents = totalCents - royaltyCents;
  const seller = sellerCents / 100;
  return { totalUsd: total, royaltyUsd: royalty, sellerUsd: seller, royaltyPct };
}

// Valida el porcentaje inmutable del listado (0-100, bordes válidos).
function assertRoyaltyPct(royaltyPct) {
  if (typeof royaltyPct !== "number" || !Number.isFinite(royaltyPct) || royaltyPct < 0 || royaltyPct > 100) {
    throw new Error("royalty fuera de rango 0-100");
  }
}

// Cuenta decimales por representación textual (evita falsos por binario).
function countDecimals(value) {
  let text = String(value);
  // Notación científica (ej. 1e-7): expandir a decimal plano antes de contar.
  if (text.includes("e") || text.includes("E")) {
    text = Number(value).toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
    if (text === "-0") {
      text = "0";
    }
  }
  const dot = text.indexOf(".");
  if (dot === -1) {
    return 0;
  }
  return text.length - dot - 1;
}

// Reglas de cantidad por activo (RF-04): PAJ_BRAF entera, BULL ≤4 decimales y ≤10.
function assertQuantityForAsset(quantity, assetType) {
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("cantidad debe ser > 0");
  }
  if (assetType === "PAJ_BRAF") {
    // Una pajuela es físicamente indivisible: 0 decimales.
    if (!Number.isInteger(quantity)) {
      throw new Error("pajuela indivisible: PAJ_BRAF solo acepta enteros");
    }
    return;
  }
  if (assetType === "BULL") {
    // Equity fraccionable hasta 4 decimales con supply máximo 10.
    if (countDecimals(quantity) > 4) {
      throw new Error("fracción inválida: BULL acepta máximo 4 decimales");
    }
    if (quantity > 10) {
      throw new Error("fracción inválida: excede supply 10");
    }
    return;
  }
  throw new Error("tipo de activo inválido: debe ser PAJ_BRAF o BULL");
}

// Extrae el precio certificado (acepta número o objeto con unitPriceUsd).
function certifiedPriceOf(certifiedValuation) {
  if (typeof certifiedValuation === "number") {
    return certifiedValuation;
  }
  if (certifiedValuation !== null && typeof certifiedValuation === "object") {
    if (typeof certifiedValuation.unitPriceUsd === "number") {
      return certifiedValuation.unitPriceUsd;
    }
    if (typeof certifiedValuation.unitPrice === "number") {
      return certifiedValuation.unitPrice;
    }
  }
  throw new Error("tasación certificada inválida: falta unitPriceUsd");
}

// Valida parámetros de listado (RF-01/RF-03/RF-04, plan §2.2).
// Exige proof con referencia; precio idéntico a la tasación (céntimos exactos).
function validateListingParams(params, certifiedValuation) {
  if (params === null || typeof params !== "object") {
    throw new Error("parámetros de listado inválidos");
  }
  // Identificador del toro: requerido no-vacío.
  if (typeof params.bullId !== "string" || params.bullId.trim() === "") {
    throw new Error("bullId requerido");
  }
  if (params.assetType !== "PAJ_BRAF" && params.assetType !== "BULL") {
    throw new Error("tipo de activo inválido: debe ser PAJ_BRAF o BULL");
  }
  assertRoyaltyPct(params.royaltyPct);
  // Cantidad según activo (incluye cantidad > 0).
  assertQuantityForAsset(params.quantity, params.assetType);
  // Precio unitario positivo e idéntico a la tasación (comparación en céntimos).
  if (typeof params.unitPriceUsd !== "number" || !Number.isFinite(params.unitPriceUsd) || params.unitPriceUsd <= 0) {
    throw new Error("precio debe ser > 0");
  }
  const certified = certifiedPriceOf(certifiedValuation);
  if (Math.round(params.unitPriceUsd * 100) !== Math.round(certified * 100)) {
    throw new Error("precio no coincide con tasación certificada");
  }
  // La validez VERIFIED la decide oracleVerifier en el client;
  // aquí solo se exige presencia de la referencia (RF-01).
  if (params.proof === null || typeof params.proof !== "object") {
    throw new Error("proof requerida: falta referencia a la proof VERIFIED");
  }
  if (typeof params.proof.topicId !== "string" || params.proof.topicId.trim() === "") {
    throw new Error("proof requerida: falta topicId de referencia");
  }
  // Porcentaje inmutable: se congela en el listado devuelto.
  return {
    listing: {
      bullId: params.bullId,
      assetType: params.assetType,
      unitPriceUsd: params.unitPriceUsd,
      quantity: params.quantity,
      royaltyPct: params.royaltyPct,
      proof: { ...params.proof },
    },
  };
}

// Valida parámetros de compra (RF-04, plan §2.2).
// Exige listado abierto, cantidad válida, saldo suficiente y total half-up exacto.
function validatePurchaseParams(purchase, listing) {
  if (purchase === null || typeof purchase !== "object") {
    throw new Error("parámetros de compra inválidos");
  }
  if (listing === null || typeof listing !== "object") {
    throw new Error("listado inválido");
  }
  // Listado cancelado bloquea nuevas compras (RF-08 preserva saldos aparte).
  if (listing.cancelled === true || listing.canceled === true) {
    throw new Error("listado cerrado: el listado está cancelado");
  }
  if (typeof purchase.listingId !== "string" || purchase.listingId.trim() === "") {
    throw new Error("listingId requerido");
  }
  if (typeof listing.unitPriceUsd !== "number" || !Number.isFinite(listing.unitPriceUsd) || listing.unitPriceUsd <= 0) {
    throw new Error("precio debe ser > 0");
  }
  // Mismas reglas de cantidad que al listar, según el activo del listado.
  assertQuantityForAsset(purchase.quantity, listing.assetType);
  // Saldo disponible del listado.
  if (typeof listing.available !== "number" || !Number.isFinite(listing.available)) {
    throw new Error("disponible inválido en el listado");
  }
  if (purchase.quantity > listing.available) {
    throw new Error("saldo insuficiente: cantidad mayor que disponible");
  }
  // Total pagado idéntico al redondeo half-up de precio por cantidad.
  const expected = roundHalfUp2(listing.unitPriceUsd * purchase.quantity);
  if (typeof purchase.totalPaidUsd !== "number" || !Number.isFinite(purchase.totalPaidUsd)) {
    throw new Error("total no coincide con precio tasado");
  }
  if (Math.round(purchase.totalPaidUsd * 100) !== Math.round(expected * 100)) {
    throw new Error("total no coincide con precio tasado");
  }
  return {
    purchase: { ...purchase, totalUsd: expected },
  };
}

// Liquida una compra acreditando el split sin doble pago (RF-06/RF-08, plan §2.2).
// Acredita la regalía al criador y el resto al vendedor, marcando el
// purchaseId como liquidado. Un segundo retiro del mismo purchaseId lanza.
// La cancelación del listado no se consulta aquí: el bloqueo de nuevas
// compras vive en validatePurchaseParams y los saldos ya acreditados se
// preservan porque esta función solo acumula sobre balances recibidos.
function applySettlement(purchaseId, split, balances) {
  // Identificador de compra requerido no-vacío.
  if (typeof purchaseId !== "string" || purchaseId.trim() === "") {
    throw new Error("purchaseId requerido");
  }
  // Split válido: regalía y parte del vendedor finitas no negativas.
  if (split === null || typeof split !== "object") {
    throw new Error("split inválido");
  }
  if (typeof split.royaltyUsd !== "number" || !Number.isFinite(split.royaltyUsd) || split.royaltyUsd < 0) {
    throw new Error("split inválido: royaltyUsd debe ser >= 0");
  }
  if (typeof split.sellerUsd !== "number" || !Number.isFinite(split.sellerUsd) || split.sellerUsd < 0) {
    throw new Error("split inválido: sellerUsd debe ser >= 0");
  }
  // Saldos previos (inmutables: nunca se muta el objeto recibido).
  const base = balances === undefined || balances === null ? {} : balances;
  const prevBreeder = typeof base.breederBalance === "number" && Number.isFinite(base.breederBalance) ? base.breederBalance : 0;
  const prevSeller = typeof base.sellerBalance === "number" && Number.isFinite(base.sellerBalance) ? base.sellerBalance : 0;
  if (prevBreeder < 0 || prevSeller < 0) {
    throw new Error("saldos inválidos: no pueden ser negativos");
  }
  const prevSettled = Array.isArray(base.settledIds) ? base.settledIds.slice() : [];
  // Idempotencia: el mismo purchaseId solo se liquida una vez.
  if (prevSettled.includes(purchaseId)) {
    throw new Error("doble retiro denegado: purchaseId ya liquidado");
  }
  // Acreditación en céntimos enteros para suma exacta.
  const breederCents = Math.round(prevBreeder * 100) + Math.round(split.royaltyUsd * 100);
  const sellerCents = Math.round(prevSeller * 100) + Math.round(split.sellerUsd * 100);
  return {
    breederBalance: breederCents / 100,
    sellerBalance: sellerCents / 100,
    settledIds: [...prevSettled, purchaseId],
  };
}

module.exports = { calculateSplit, roundHalfUp2, validateListingParams, validatePurchaseParams, applySettlement };
