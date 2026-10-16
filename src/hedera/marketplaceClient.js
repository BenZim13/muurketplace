"use strict";

// Client HSCS del marketplace: listar y comprar con guarda VERIFIED (T6, RF-01/RF-02/RF-04).
// Capa infraestructura: orquesta validación pura + verificación de oráculo + contrato.
// Solo Testnet: nunca usa forMainnet ni mainnet; nunca lee claves ni .env.
// Comentarios en español; código en inglés camelCase.

const { validateListingParams, validatePurchaseParams, calculateSplit } = require("../logic/marketplace.js");
const { verifyValuation } = require("./oracleVerifier.js");

// Resuelve la función de verificación inyectada (por defecto el oráculo real).
function resolveVerifyFn(deps) {
  if (deps && typeof deps.verifyFn === "function") {
    return deps.verifyFn;
  }
  return verifyValuation;
}

// Resuelve el ejecutor del contrato inyectado (obligatorio: sin red real en tests).
function resolveContractExec(deps) {
  if (deps && deps.contractExec) {
    return deps.contractExec;
  }
  throw new Error("contractExec no inyectado: se requiere doble mock o ejecutor HSCS");
}

// Crea un listado verificado (RF-01): valida en puro sin red, exige veredicto
// VERIFIED vía verifyFn y solo entonces invoca al contrato una vez (RF-02).
// Devuelve identificadores más txId más referencia de proof.
async function createListing(client, contractId, listingParams, certifiedValuation, proof, expectedMessage, deps) {
  // Paso 1: validación pura sin red (precio tasado exacto, cantidades, proof con referencia).
  const validated = validateListingParams(listingParams, certifiedValuation);
  // Paso 2: guarda VERIFIED antes de tocar el contrato (sin proof válida no hay listado).
  const verifyFn = resolveVerifyFn(deps);
  const verifyOptions = deps && deps.verifyOptions ? deps.verifyOptions : undefined;
  const verdict = await verifyFn(proof, expectedMessage, verifyOptions);
  if (!verdict || verdict.status !== "VERIFIED") {
    throw new Error("sin proof VERIFIED no hay listado");
  }
  // Paso 3: una sola llamada al contrato tras VERIFIED.
  const contractExec = resolveContractExec(deps);
  const receipt = await contractExec.createListing(client, contractId, validated.listing);
  return {
    listingId: receipt.listingId,
    txId: receipt.txId,
    proofRef: { ...proof },
  };
}

// Compra al precio tasado (RF-04): valida en puro sin red, exige VERIFIED y
// solo entonces invoca al contrato una vez, devolviendo compra más reparto (RF-05).
// RF-07: si el contrato revierte, propaga fallo como reembolso sin acreditar parciales.
async function buy(client, contractId, purchase, listing, proof, expectedMessage, deps) {
  // Paso 1: validación pura sin red (listado abierto, cantidad, total half-up exacto).
  const validated = validatePurchaseParams(purchase, listing);
  // Paso 2: guarda VERIFIED también en compra (tasación alterada en un decimal rechaza).
  const verifyFn = resolveVerifyFn(deps);
  const verifyOptions = deps && deps.verifyOptions ? deps.verifyOptions : undefined;
  const verdict = await verifyFn(proof, expectedMessage, verifyOptions);
  if (!verdict || verdict.status !== "VERIFIED") {
    throw new Error("sin proof VERIFIED no hay compra");
  }
  // Paso 3: reparto half-up con residuo al vendedor (misma regla R-REV-01).
  const split = calculateSplit(validated.purchase.totalUsd, listing.royaltyPct);
  // Paso 4: una sola llamada al contrato tras VERIFIED.
  // Si revierte o falla la red, no hay purchaseId ni regalía acreditada (reembolso atómico).
  const contractExec = resolveContractExec(deps);
  let receipt;
  try {
    receipt = await contractExec.buy(client, contractId, { ...validated.purchase, split });
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    throw new Error(`reembolso: fallo al comprar (${detail})`);
  }
  return {
    purchaseId: receipt.purchaseId,
    txId: receipt.txId,
    split,
  };
}

// Liquida las regalías del criador (RF-06): una llamada al contrato tras
// validar beneficiario; el segundo retiro revierte on-chain y aquí se
// propaga como "doble retiro denegado" sin doble pago (R-REV-02 no aplica,
// es escritura con receipt). RF-07: cualquier otro fallo propaga reembolso.
async function withdrawRoyalties(client, contractId, breeder, deps) {
  // Beneficiario y contrato requeridos (sin claves ni .env aquí).
  if (typeof breeder !== "string" || breeder.trim() === "") {
    throw new Error("criador requerido");
  }
  if (typeof contractId !== "string" || contractId.trim() === "") {
    throw new Error("contractId requerido");
  }
  const contractExec = resolveContractExec(deps);
  try {
    const receipt = await contractExec.withdrawRoyalties(client, contractId, breeder);
    return {
      txId: receipt.txId,
      amountUsd: receipt.amountUsd,
      breeder,
    };
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    // El contrato revierte sin saldo ("sin regalias pendientes") o con marca
    // de ya liquidado: el client lo traduce al error canónico de doble retiro.
    if (/doble retiro|ya liquidado|ya retirado|sin regalias pendientes/i.test(detail)) {
      throw new Error(`doble retiro denegado: ${detail}`);
    }
    throw new Error(`reembolso: fallo al liquidar (${detail})`);
  }
}

// Cancela el listado (RF-08): cierra a nuevas compras sin tocar los saldos
// pendientes (el contrato preserva regalías; el bloqueo de compras vive en
// validatePurchaseParams). Devuelve txId con bandera de cancelación.
async function cancelListing(client, contractId, listingId, deps) {
  if (typeof listingId !== "string" || listingId.trim() === "") {
    throw new Error("listingId requerido");
  }
  if (typeof contractId !== "string" || contractId.trim() === "") {
    throw new Error("contractId requerido");
  }
  const contractExec = resolveContractExec(deps);
  try {
    const receipt = await contractExec.cancelListing(client, contractId, listingId);
    return {
      txId: receipt.txId,
      listingId,
      cancelled: true,
    };
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    throw new Error(`fallo al cancelar listado (${detail})`);
  }
}

// Consultas públicas de solo lectura (R-REV-02): sin cálculo ni validación
// de negocio, sin claves; solo devuelven el estado mirror más referencias
// HashScan Testnet. La verificación de contenido vive en oracleVerifier.
function hashscanContractUrl(contractId) {
  return `https://hashscan.io/testnet/contract/${contractId}`;
}

function hashscanTxUrl(txId) {
  return `https://hashscan.io/testnet/transaction/${txId}`;
}

// Resuelve el lector mirror inyectado (obligatorio: sin red real en tests).
function resolveMirrorFetch(deps) {
  if (deps && typeof deps.mirrorFetch === "function") {
    return deps.mirrorFetch;
  }
  throw new Error("mirrorFetch no inyectado: consulta pública sin claves");
}

async function getListing(contractId, listingId, deps) {
  if (typeof contractId !== "string" || contractId.trim() === "") {
    throw new Error("contractId requerido");
  }
  if (typeof listingId !== "string" || listingId.trim() === "") {
    throw new Error("listingId requerido");
  }
  const mirrorFetch = resolveMirrorFetch(deps);
  const url = `https://testnet.mirrornode.hedera.com/api/v1/contracts/${contractId}/listings/${listingId}`;
  const state = await mirrorFetch(url);
  return {
    contractId,
    listingId,
    listing: state,
    hashscanUrl: hashscanContractUrl(contractId),
  };
}

async function getPurchase(contractId, purchaseId, deps) {
  if (typeof contractId !== "string" || contractId.trim() === "") {
    throw new Error("contractId requerido");
  }
  if (typeof purchaseId !== "string" || purchaseId.trim() === "") {
    throw new Error("purchaseId requerido");
  }
  const mirrorFetch = resolveMirrorFetch(deps);
  const url = `https://testnet.mirrornode.hedera.com/api/v1/contracts/${contractId}/purchases/${purchaseId}`;
  const state = await mirrorFetch(url);
  const txId = state && typeof state.txId === "string" ? state.txId : null;
  return {
    contractId,
    purchaseId,
    purchase: state,
    hashscanUrl: txId ? hashscanTxUrl(txId) : hashscanContractUrl(contractId),
  };
}

async function getSettlement(contractId, purchaseId, deps) {
  if (typeof contractId !== "string" || contractId.trim() === "") {
    throw new Error("contractId requerido");
  }
  if (typeof purchaseId !== "string" || purchaseId.trim() === "") {
    throw new Error("purchaseId requerido");
  }
  const mirrorFetch = resolveMirrorFetch(deps);
  const url = `https://testnet.mirrornode.hedera.com/api/v1/contracts/${contractId}/settlements/${purchaseId}`;
  const state = await mirrorFetch(url);
  const txId = state && typeof state.txId === "string" ? state.txId : null;
  return {
    contractId,
    purchaseId,
    settlement: state,
    hashscanUrl: txId ? hashscanTxUrl(txId) : hashscanContractUrl(contractId),
  };
}

module.exports = { createListing, buy, withdrawRoyalties, cancelListing, getListing, getPurchase, getSettlement };
