// Lógica pura de tokenización HTS (RF-01, RF-02, RF-03 de la Spec 005).
// 100% pura: sin @hashgraph/sdk, sin process.env, sin red, sin fs,
// sin Date.now, sin Math.random. Solo validación, normalización y composición.
// Comentarios en español; código en inglés camelCase.
"use strict";

// Unidades BULL por defecto al acuñar: supply máximo de la equity fraccionable.
const DEFAULT_BULL_SUPPLY = 10;

// URL pública de un token en HashScan Testnet (verificabilidad pública, RNF-06).
function hashscanTokenUrl(tokenId) {
  return "https://hashscan.io/testnet/token/" + tokenId;
}

// RF-02: normaliza el supply de BULL. Por defecto 10; debe ser entero 1..10.
//
// Nota: aquí se calcula el supply de unidades BULL a acuñar, distinto de
// las pajuelas del lote (pajuelaCount, RF-01) que es un entero cualquiera > 0.
function normalizeBullSupply(bullSupply) {
  if (bullSupply === undefined) {
    return DEFAULT_BULL_SUPPLY;
  }
  if (typeof bullSupply !== "number" || !Number.isFinite(bullSupply)) {
    throw new Error("bullSupply inválido: debe ser un número entero 1..10");
  }
  if (!Number.isInteger(bullSupply) || bullSupply < 1 || bullSupply > DEFAULT_BULL_SUPPLY) {
    throw new Error("bullSupply fuera de rango 1..10");
  }
  return bullSupply;
}

// RF-01/RF-02/RF-03: valida y normaliza los parámetros de tokenización.
// Rechaza sin veredicto APTO (Spec 001) o sin proof VERIFIED (Spec 002) antes
// de crear token alguno. Devuelve el objeto tokenization normalizado.
function validateTokenizationParams(params, certifiedValuation, proof) {
  if (params === null || typeof params !== "object") {
    throw new Error("parámetros de tokenización inválidos");
  }
  // Identificación del animal/lote: requerido no-vacío.
  if (typeof params.bullId !== "string" || params.bullId.trim() === "") {
    throw new Error("bullId requerido");
  }
  // RF-03: precondición transversal (solo APTO de 001 + VERIFIED de 002).
  // El veredicto APTO se materializa en la tasación certificada de la Spec 001.
  if (
    certifiedValuation === null ||
    typeof certifiedValuation !== "object" ||
    certifiedValuation.mTotal === null ||
    certifiedValuation.mTotal === undefined ||
    certifiedValuation.tasacionToroUsd === null ||
    certifiedValuation.tasacionToroUsd === undefined ||
    certifiedValuation.tasacionDosisUsd === null ||
    certifiedValuation.tasacionDosisUsd === undefined
  ) {
    throw new Error("sin veredicto APTO: falta tasación certificada (mTotal y tasaciones)");
  }
  // La validez VERIFIED la decide el verificador; aquí se exige la referencia.
  if (
    proof === null ||
    typeof proof !== "object" ||
    typeof proof.topicId !== "string" ||
    proof.topicId.trim() === ""
  ) {
    throw new Error("sin proof VERIFIED: falta topicId de referencia");
  }
  // RF-01: lote completo de PAJ-BRAF, entero y positivo.
  if (!Number.isInteger(params.pajuelaCount) || params.pajuelaCount <= 0) {
    throw new Error("pajuelaCount debe ser entero > 0");
  }
  // RF-02: supply de BULL hasta 10 unidades (por defecto 10).
  const bullSupply = normalizeBullSupply(params.bullSupply);
  // Treasury del token: cuenta de la cabaña, requerida no-vacía.
  if (typeof params.cabanaAccountId !== "string" || params.cabanaAccountId.trim() === "") {
    throw new Error("cabanaAccountId requerido");
  }
  return {
    tokenization: {
      bullId: params.bullId,
      pajuelaCount: params.pajuelaCount,
      bullSupply,
      cabanaAccountId: params.cabanaAccountId,
      contractId: params.contractId,
    },
  };
}

// RF-01/RF-02: compone la salida de tokenización a partir de los recibos crudos
// de los token managers. Cubre SOLO el par de tokens (PAJ-BRAF + BULL); los
// txId de allowance NO forman parte de esta salida (pertenecen a RF-06).
function composeTokenizationResult(rawReceipts) {
  if (rawReceipts === null || typeof rawReceipts !== "object") {
    throw new Error("recibos de tokenización inválidos");
  }
  if (typeof rawReceipts.pajBrafTokenId !== "string" || rawReceipts.pajBrafTokenId.trim() === "") {
    throw new Error("pajBrafTokenId requerido");
  }
  if (typeof rawReceipts.bullTokenId !== "string" || rawReceipts.bullTokenId.trim() === "") {
    throw new Error("bullTokenId requerido");
  }
  const { pajBrafTokenId, bullTokenId, bullSupply, pajBrafTxId, bullTxId } = rawReceipts;
  return {
    pajBrafTokenId,
    bullTokenId,
    bullSupply,
    txIds: {
      pajBraf: pajBrafTxId,
      bull: bullTxId,
    },
    hashscanUrls: {
      pajBraf: hashscanTokenUrl(pajBrafTokenId),
      bull: hashscanTokenUrl(bullTokenId),
    },
  };
}

module.exports = {
  validateTokenizationParams,
  normalizeBullSupply,
  composeTokenizationResult,
};
