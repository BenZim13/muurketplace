// Repo de marketplace espejo en Supabase (T6 spec 004, RF-05/RF-06/RF-08).
// Listings + purchases + settlements idempotentes; veto sin escritura: sin
// proof VERIFIED vigente no hay listado ni compra (block-unverified antes de
// tocar red). Espeja splits/txIds ya calculados por 003, sin recalcularlos.
// Mock inyectado en tests, sin red.
"use strict";

const {
  decideListingPut,
  decidePurchasePut,
  decidePurchaseSettle,
  toPublicView,
} = require("../logic/mirrorRules.js");

// Convierte el listado espejo (camelCase) a fila Supabase (snake_case).
function toListingRow(record) {
  return {
    listing_id: record.listingId,
    valuation_key: record.valuationKey,
    asset_type: record.assetType === undefined ? null : record.assetType,
    unit_price_usd: record.unitPriceUsd,
    quantity: record.quantity,
  };
}

// Convierte la fila Supabase de vuelta a listado espejo (camelCase).
function fromListingRow(row) {
  return {
    listingId: row.listing_id,
    valuationKey: row.valuation_key,
    assetType: row.asset_type,
    unitPriceUsd: row.unit_price_usd,
    quantity: row.quantity,
  };
}

// Convierte la compra espejo (camelCase) a fila Supabase (snake_case).
function toPurchaseRow(record) {
  return {
    purchase_id: record.purchaseId,
    listing_id: record.listingId,
    valuation_key: record.valuationKey,
    asset_type: record.assetType === undefined ? null : record.assetType,
    unit_price_usd: record.unitPriceUsd,
    quantity: record.quantity,
    royalty_pct: record.royaltyPct,
    royalty_usd: record.royaltyUsd,
    seller_usd: record.sellerUsd,
    total_usd: record.totalUsd,
    purchase_tx_id: record.purchaseTxId,
    settlement_tx_id: record.settlementTxId,
    settled: record.settled,
  };
}

// Convierte la fila Supabase de vuelta a compra espejo (camelCase).
function fromPurchaseRow(row) {
  return {
    purchaseId: row.purchase_id,
    listingId: row.listing_id,
    valuationKey: row.valuation_key,
    assetType: row.asset_type,
    unitPriceUsd: row.unit_price_usd,
    quantity: row.quantity,
    royaltyPct: row.royalty_pct,
    royaltyUsd: row.royalty_usd,
    sellerUsd: row.seller_usd,
    totalUsd: row.total_usd,
    purchaseTxId: row.purchase_tx_id,
    settlementTxId: row.settlement_tx_id,
    settled: row.settled,
  };
}

// Indica si el error del motor es denegación RLS al rol anon (solo lectura).
function isDeniedError(error) {
  return (
    error &&
    (error.code === "42501" || /permission denied|denegad/i.test(error.message || ""))
  );
}

// Lee la fila cruda de listado por listingId (null si ausente).
async function readListingRow(supabase, listingId) {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("listing_id", listingId);
  if (error) {
    throw new Error("espejo no disponible: no se pudo leer el listado");
  }
  if (!data || data.length === 0) {
    return null;
  }
  return data[0];
}

// Lee la fila cruda de compra por purchaseId (null si ausente).
async function readPurchaseRow(supabase, purchaseId) {
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("purchase_id", purchaseId);
  if (error) {
    throw new Error("espejo no disponible: no se pudo leer la compra");
  }
  if (!data || data.length === 0) {
    return null;
  }
  return data[0];
}

// Guarda el listado solo con proof VERIFIED vigente: ante MISMATCH/PENDING
// lanza antes de tocar red (cero escrituras). Un solo upsert por listing_id.
async function saveListing(supabase, listing, proofStatus) {
  // Veto en puro antes de red: sin VERIFIED no hay escritura alguna.
  const veto = decideListingPut(null, listing, proofStatus);
  if (veto.decision === "block-unverified") {
    throw new Error("sin proof VERIFIED no hay listado");
  }
  const existingRow = await readListingRow(supabase, listing.listingId);
  const existing = existingRow ? fromListingRow(existingRow) : null;
  const decided = decideListingPut(existing, listing, proofStatus);
  if (decided.decision === "return-existing") {
    return { listing: decided.record, existed: true };
  }
  const row = toListingRow(decided.record);
  const { data, error } = await supabase
    .from("listings")
    .upsert(row, { onConflict: "listing_id" })
    .select();
  if (error) {
    if (isDeniedError(error)) {
      throw new Error("escritura denegada: rol anon solo lectura (42501)");
    }
    throw new Error("espejo no disponible: no se pudo guardar el listado");
  }
  return { listing: fromListingRow(data[0]), existed: false };
}

// Guarda la compra idempotente por purchaseId: mismo id + contenido idéntico
// devuelve el original; mismo id con importes distintos lanza. Un solo upsert.
async function savePurchase(supabase, purchase) {
  const existingRow = await readPurchaseRow(supabase, purchase && purchase.purchaseId);
  const existing = existingRow ? fromPurchaseRow(existingRow) : null;
  const decided = decidePurchasePut(existing, purchase, null);
  if (decided.decision === "return-existing") {
    return { purchase: decided.record, existed: true };
  }
  const row = toPurchaseRow(decided.record);
  const { data, error } = await supabase
    .from("purchases")
    .upsert(row, { onConflict: "purchase_id" })
    .select();
  if (error) {
    if (isDeniedError(error)) {
      throw new Error("escritura denegada: rol anon solo lectura (42501)");
    }
    throw new Error("espejo no disponible: no se pudo guardar la compra");
  }
  return { purchase: fromPurchaseRow(data[0]), existed: false };
}

// Liquida la compra una sola vez: false → true con settlementTxId; una compra
// ya liquidada nunca se liquida de nuevo (doble liquidación denegada).
async function settlePurchase(supabase, purchaseId, settlementTxId) {
  const existingRow = await readPurchaseRow(supabase, purchaseId);
  const existing = existingRow ? fromPurchaseRow(existingRow) : null;
  const decided = decidePurchaseSettle(existing, settlementTxId);
  const row = toPurchaseRow(decided.record);
  const { data, error } = await supabase
    .from("purchases")
    .upsert(row, { onConflict: "purchase_id" })
    .select();
  if (error) {
    if (isDeniedError(error)) {
      throw new Error("escritura denegada: rol anon solo lectura (42501)");
    }
    throw new Error("espejo no disponible: no se pudo liquidar la compra");
  }
  return { purchase: fromPurchaseRow(data[0]), settled: true };
}

// Lee el listado por listingId para consulta pública con rol anon (RF-07):
// solo lectura, sin credenciales de operador ni llamada on-chain. Devuelve
// referencia Testnet construida si hay proof, o ausencia explícita con
// marca de no verificado si no existe o aún no está certificado.
async function getListing(supabase, listingId, proof = null) {
  const row = await readListingRow(supabase, listingId);
  if (!row) {
    return toPublicView(null, null);
  }
  return toPublicView(fromListingRow(row), proof);
}

// Lee la compra por purchaseId para consulta pública con rol anon (RF-07):
// solo lectura, sin credenciales de operador ni llamada on-chain. Devuelve
// referencia Testnet construida si hay proof, o ausencia explícita con
// marca de no verificado si no existe o aún no está certificada.
async function getPurchase(supabase, purchaseId, proof = null) {
  const row = await readPurchaseRow(supabase, purchaseId);
  if (!row) {
    return toPublicView(null, null);
  }
  return toPublicView(fromPurchaseRow(row), proof);
}

module.exports = {
  saveListing,
  savePurchase,
  settlePurchase,
  getListing,
  getPurchase,
  toListingRow,
  fromListingRow,
  toPurchaseRow,
  fromPurchaseRow,
};
