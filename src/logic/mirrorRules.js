// Reglas puras del espejo Supabase: toro y valuación idempotente (T2 spec 004, RF-01/RF-02, D-02).
// Lógica 100% pura: solo exige el módulo relativo ./oracleMessage.js (dueño de
// valuationKey + verifyMessageContent, sin duplicar su lógica). Sin SDK, sin
// process.env, sin red, sin fs, sin Date.now, sin Math.random.
"use strict";

const { buildOracleMessage, verifyMessageContent } = require("./oracleMessage.js");

// Los 11 campos PEGBraf evaluados (mismos que el oráculo; solo nombres, sin lógica duplicada).
const INPUT_FIELDS = [
  "pesoNacerDep",
  "pesoDestateDep",
  "edadDesteDias",
  "pesoFinalDep",
  "edadPesoFinalDias",
  "circunferenciaEscrotalCm",
  "areaOjoBifeCm2",
  "grasaIntramuscularTop5",
  "motilidadSeminalPct",
  "volumenEyaculadoMl",
  "pajuelasProducidas",
];

// Resuelve el identificador del toro igual que el oráculo (bullId o lote).
function resolveBullId(bullInput) {
  const input = bullInput || {};
  const bullId = input.bullId !== undefined ? input.bullId : input.lote;
  if (typeof bullId !== "string" || bullId.length === 0) {
    throw new Error("registro incompleto: bullId requerido, el espejo no inventa");
  }
  return bullId;
}

// Copia exacta de los 11 inputs PEGBraf; lanza si falta alguno.
function copyInputs(bullInput) {
  const input = bullInput || {};
  const out = {};
  for (const field of INPUT_FIELDS) {
    if (input[field] === undefined || input[field] === null) {
      throw new Error("registro incompleto: faltan inputs PEGBraf, el espejo no inventa");
    }
    out[field] = input[field];
  }
  return out;
}

// Arma el registro espejo del toro desde lo que 001 decidió, sin recalcular nada.
function buildBullRecord(bullInput, bullResult) {
  if (!bullResult || bullResult.apto !== true) {
    throw new Error("registro incompleto: solo APTOS espejables, el espejo no inventa");
  }
  if (
    bullResult.mTotal === null ||
    bullResult.mTotal === undefined ||
    bullResult.tasacionToroUsd === null ||
    bullResult.tasacionToroUsd === undefined ||
    bullResult.tasacionDosisUsd === null ||
    bullResult.tasacionDosisUsd === undefined
  ) {
    throw new Error("registro incompleto: mTotal y tasaciones requeridas, el espejo no inventa");
  }
  const bullId = resolveBullId(bullInput);
  const inputs = copyInputs(bullInput);
  const motivos = Array.isArray(bullResult.motivosRechazo) ? bullResult.motivosRechazo.slice() : [];
  return {
    bullId,
    inputs,
    apto: true,
    motivos,
    mTotal: bullResult.mTotal,
    priceBullUsd: bullResult.tasacionToroUsd,
    priceDoseUsd: bullResult.tasacionDosisUsd,
  };
}

// Arma el registro espejo de la valuación delegando la clave al oráculo existente.
// Exige specVersion "001": otra versión lanza (D-02, claves nuevas sin migración).
function buildValuationRecord(bullInput, bullResult, meta) {
  const params = meta || {};
  const specVersion = params.specVersion === undefined ? "001" : params.specVersion;
  if (specVersion !== "001") {
    throw new Error("spec-version no soportada: solo 001");
  }
  const bullId = resolveBullId(bullInput);
  const { message, valuationKey } = buildOracleMessage(bullInput, bullResult, {
    specVersion: "001",
    publishedAt: params.publishedAt,
  });
  return {
    valuationKey,
    bullId,
    specVersion: "001",
    mTotal: bullResult.mTotal,
    priceBullUsd: bullResult.tasacionToroUsd,
    priceDoseUsd: bullResult.tasacionDosisUsd,
    canonicalJson: message,
  };
}

// Decide la escritura idempotente por valuationKey.
// null ⇒ insert; misma clave + contenido idéntico ⇒ return-existing;
// misma clave + contenido distinto ⇒ lanza (es otra valuación, no idempotente).
function decideValuationPut(existing, incoming) {
  if (!incoming || typeof incoming.valuationKey !== "string" || incoming.valuationKey.length === 0) {
    throw new Error("registro incompleto: valuationKey requerida");
  }
  if (existing === null || existing === undefined) {
    return { decision: "insert", record: incoming };
  }
  if (existing.valuationKey !== incoming.valuationKey) {
    throw new Error("valuationKey distinta: no es reintento de la misma valuación");
  }
  // Contenido idéntico según el comparador del oráculo (CE 1.5 vs 1.6 ⇒ MISMATCH).
  const verdict = verifyMessageContent(existing.canonicalJson, incoming.canonicalJson);
  const sameTotals =
    existing.mTotal === incoming.mTotal &&
    existing.priceBullUsd === incoming.priceBullUsd &&
    existing.priceDoseUsd === incoming.priceDoseUsd &&
    existing.bullId === incoming.bullId &&
    existing.specVersion === incoming.specVersion;
  if (verdict.status === "VERIFIED" && sameTotals) {
    return { decision: "return-existing", record: existing };
  }
  throw new Error("colisión de clave con inputs distintos: es otra valuación, no idempotente");
}

// Decide la escritura de la proof HCS ligada a su valuationKey (RF-03, RF-04).
// El espejo nunca declara válido lo ajeno: si reclama VERIFIED pero el
// veredicto de verdad no es VERIFIED, se fuerza MISMATCH.
// La historia certificada es inmutable: un VERIFIED/MISMATCH final no se reescribe.
function decideProofPut(existing, incoming, verdict) {
  const proof = incoming || {};
  if (typeof proof.valuationKey !== "string" || proof.valuationKey.length === 0) {
    throw new Error("registro incompleto: valuationKey requerida, el espejo no inventa");
  }
  if (typeof proof.topicId !== "string" || proof.topicId.length === 0) {
    throw new Error("registro incompleto: topicId requerido, el espejo no inventa");
  }
  if (typeof proof.transactionId !== "string" || proof.transactionId.length === 0) {
    throw new Error("registro incompleto: transactionId requerido, el espejo no inventa");
  }
  if (proof.status !== "VERIFIED" && proof.status !== "MISMATCH" && proof.status !== "PENDING") {
    throw new Error("registro incompleto: estado VERIFIED|MISMATCH|PENDING requerido");
  }
  const verdictStatus = verdict && verdict.status;
  // Veto de inválido: reclamar VERIFIED sin verdad VERIFIED ⇒ MISMATCH forzado
  // (cubre mTotal 2.45 vs 2.46: la cadena difiere, el espejo no la declara válida).
  let effectiveStatus = proof.status;
  if (proof.status === "VERIFIED" && verdictStatus !== "VERIFIED") {
    effectiveStatus = "MISMATCH";
  }
  const record = {
    valuationKey: proof.valuationKey,
    topicId: proof.topicId,
    sequenceNumber: proof.sequenceNumber === undefined ? null : proof.sequenceNumber,
    consensusTimestamp: proof.consensusTimestamp,
    transactionId: proof.transactionId,
    status: effectiveStatus,
  };
  if (existing === null || existing === undefined) {
    return { decision: "insert", record };
  }
  if (existing.valuationKey !== record.valuationKey) {
    throw new Error("valuationKey distinta: la proof pertenece a otra valuación");
  }
  const sameProof =
    existing.topicId === record.topicId &&
    existing.sequenceNumber === record.sequenceNumber &&
    existing.consensusTimestamp === record.consensusTimestamp &&
    existing.transactionId === record.transactionId &&
    existing.status === record.status;
  if (sameProof) {
    return { decision: "return-existing", record: existing };
  }
  // Historia certificada inmutable: un VERIFIED o MISMATCH final no se reescribe.
  if (existing.status === "VERIFIED" || existing.status === "MISMATCH") {
    throw new Error("historia certificada inmutable: el espejo no reescribe");
  }
  // PENDING que la verdad confirma como final: solo cambia el estado,
  // conserva proof, valuationKey y txIds originales.
  if (existing.status === "PENDING" && (record.status === "VERIFIED" || record.status === "MISMATCH")) {
    if (verdictStatus !== record.status) {
      throw new Error("el espejo no se autoverifica: prueba de verdad requerida");
    }
    const updated = { ...existing, status: record.status };
    return { decision: "update-status", record: updated };
  }
  throw new Error("historia certificada inmutable: el espejo no reescribe");
}

// Decide si un listado puede escribirse (RF-04): sin proof VERIFIED vigente
// no hay listado ni compra; el repo no debe escribir (block-unverified).
function decideListingPut(existing, listing, proofStatus) {
  if (proofStatus !== "VERIFIED") {
    return { decision: "block-unverified", reason: "sin proof VERIFIED no hay listado" };
  }
  const item = listing || {};
  if (typeof item.listingId !== "string" || item.listingId.length === 0) {
    throw new Error("registro incompleto: listingId requerido, el espejo no inventa");
  }
  if (typeof item.valuationKey !== "string" || item.valuationKey.length === 0) {
    throw new Error("registro incompleto: valuationKey requerida, el espejo no inventa");
  }
  if (existing === null || existing === undefined) {
    return { decision: "insert", record: item };
  }
  if (existing.listingId !== item.listingId) {
    throw new Error("listingId distinto: no es reintento del mismo listado");
  }
  const sameValuation = existing.valuationKey === item.valuationKey;
  const samePrice = existing.unitPriceUsd === item.unitPriceUsd;
  const sameQty = existing.quantity === item.quantity;
  if (sameValuation && samePrice && sameQty) {
    return { decision: "return-existing", record: existing };
  }
  throw new Error("listado inmutable divergente: es otro listado, no idempotente");
}

// Decide la escritura idempotente de una compra del marketplace (RF-05, RF-06).
// El espejo solo refleja splits y txIds ya calculados por 003, sin recalcular.
// null ⇒ insert; mismo purchaseId + contenido idéntico ⇒ return-existing;
// mismo purchaseId + importes distintos ⇒ lanza (es otra compra).
function decidePurchasePut(existing, incoming, ledger) {
  void ledger;
  const item = incoming || {};
  if (typeof item.listingId !== "string" || item.listingId.length === 0) {
    throw new Error("registro incompleto: listingId requerido, el espejo no inventa");
  }
  if (typeof item.purchaseId !== "string" || item.purchaseId.length === 0) {
    throw new Error("registro incompleto: purchaseId requerido, el espejo no inventa");
  }
  if (typeof item.valuationKey !== "string" || item.valuationKey.length === 0) {
    throw new Error("registro incompleto: valuationKey requerida, el espejo no inventa");
  }
  if (
    typeof item.royaltyPct !== "number" ||
    !Number.isFinite(item.royaltyPct) ||
    item.royaltyPct < 0 ||
    item.royaltyPct > 100
  ) {
    throw new Error("registro incompleto: royaltyPct 0-100 requerido, el espejo no inventa");
  }
  for (const field of ["totalUsd", "royaltyUsd", "sellerUsd"]) {
    if (typeof item[field] !== "number" || !Number.isFinite(item[field]) || item[field] < 0) {
      throw new Error("registro incompleto: " + field + " >= 0 requerido, el espejo no inventa");
    }
  }
  // Copia exacta del movimiento: 0% y 100% se reflejan tal cual, con $0 explícito.
  const record = {
    listingId: item.listingId,
    purchaseId: item.purchaseId,
    valuationKey: item.valuationKey,
    assetType: item.assetType,
    unitPriceUsd: item.unitPriceUsd,
    quantity: item.quantity,
    royaltyPct: item.royaltyPct,
    royaltyUsd: item.royaltyUsd,
    sellerUsd: item.sellerUsd,
    totalUsd: item.totalUsd,
    purchaseTxId: item.purchaseTxId === undefined ? null : item.purchaseTxId,
    settlementTxId: item.settlementTxId === undefined ? null : item.settlementTxId,
    settled: item.settled === true,
  };
  if (existing === null || existing === undefined) {
    return { decision: "insert", record };
  }
  if (existing.purchaseId !== record.purchaseId) {
    throw new Error("purchaseId distinto: no es reintento de la misma compra");
  }
  const same =
    existing.listingId === record.listingId &&
    existing.valuationKey === record.valuationKey &&
    existing.assetType === record.assetType &&
    existing.unitPriceUsd === record.unitPriceUsd &&
    existing.quantity === record.quantity &&
    existing.royaltyPct === record.royaltyPct &&
    existing.royaltyUsd === record.royaltyUsd &&
    existing.sellerUsd === record.sellerUsd &&
    existing.totalUsd === record.totalUsd &&
    existing.purchaseTxId === record.purchaseTxId &&
    existing.settlementTxId === record.settlementTxId &&
    existing.settled === record.settled;
  if (same) {
    return { decision: "return-existing", record: existing };
  }
  throw new Error("purchaseId reutilizado con importes distintos: es otra compra, no idempotente");
}

// Liquida una compra espejando la acreditación ya ocurrida on-chain en 003
// (RF-06, RF-08): solo false → true con settlementTxId; una compra ya
// liquidada nunca se liquida de nuevo (doble liquidación denegada).
function decidePurchaseSettle(existing, settlementTxId) {
  if (existing === null || existing === undefined) {
    throw new Error("sin compra que liquidar: el espejo no inventa");
  }
  if (existing.settled === true) {
    throw new Error("doble liquidación denegada: purchaseId ya liquidado");
  }
  if (typeof settlementTxId !== "string" || settlementTxId.length === 0) {
    throw new Error("registro incompleto: settlementTxId requerido, el espejo no inventa");
  }
  const updated = { ...existing, settled: true, settlementTxId };
  return { decision: "update-status", record: updated };
}

// Transición de estado solo-desde-verdad (RF-08): solo PENDING → VERIFIED|MISMATCH
// con prueba de verdad coincidente; conserva proof, valuationKey y txIds.
// La autopromoción sin prueba lanza.
function decideProofStatusUpdate(existing, nextStatus, proofOfTruth) {
  if (existing === null || existing === undefined) {
    throw new Error("sin registro que actualizar: el espejo no inventa");
  }
  if (existing.status !== "PENDING") {
    throw new Error("solo PENDING transiciona (VERIFIED/MISMATCH finales)");
  }
  if (nextStatus !== "VERIFIED" && nextStatus !== "MISMATCH") {
    throw new Error("estado destino inválido: solo VERIFIED|MISMATCH");
  }
  const truthStatus = proofOfTruth && proofOfTruth.status;
  if (truthStatus !== nextStatus) {
    throw new Error("el espejo no se autoverifica: prueba de verdad requerida");
  }
  const updated = { ...existing, status: nextStatus };
  return { decision: "update-status", record: updated };
}

// Vista pública verificable (RF-04, RF-07): adjunta referencia Testnet
// construida (no consultada) o ausencia explícita; nunca inventa referencia
// ni presenta MISMATCH/PENDING como VERIFIED.
function toPublicView(record, proof) {
  const hasTopic = proof && typeof proof.topicId === "string" && proof.topicId.length > 0;
  const hasSeq = proof && proof.sequenceNumber !== undefined && proof.sequenceNumber !== null;
  const hasTx = proof && typeof proof.transactionId === "string" && proof.transactionId.length > 0;
  if (!hasTopic || (!hasSeq && !hasTx)) {
    return { record, mirrorUrl: null, hashscanUrl: null, unverified: true };
  }
  const mirrorUrl =
    "https://testnet.mirrornode.hedera.com/api/v1/topics/" +
    proof.topicId +
    (hasSeq ? "/messages?sequenceNumber=" + String(proof.sequenceNumber) : "/messages");
  const hashscanUrl = hasTx
    ? "https://hashscan.io/testnet/transaction/" + proof.transactionId
    : null;
  return { record, mirrorUrl, hashscanUrl, unverified: proof.status !== "VERIFIED" };
}

module.exports = { buildBullRecord, buildValuationRecord, decideValuationPut, decideProofPut, decideListingPut, decidePurchasePut, decidePurchaseSettle, decideProofStatusUpdate, toPublicView };
