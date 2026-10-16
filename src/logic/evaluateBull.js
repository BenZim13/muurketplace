// Fachada pública del motor: orquesta validación + tasación (RF-06, RF-16, EA-01).
// Lógica pura: sin imports externos salvo módulos propios.
"use strict";

const { validateBull } = require("./validator.js");
const { calculateMTotal, calculateBullPrice, calculateDosePrice } = require("./pricing.js");

function evaluateBull(data) {
  // RF-02–RF-07 + RF-06: valida primero; si NO apto, triple-null sin tasación parcial.
  const { apto, motivosRechazo } = validateBull(data);
  if (!apto) {
    return {
      apto: false,
      motivosRechazo,
      mTotal: null,
      tasacionToroUsd: null,
      tasacionDosisUsd: null,
    };
  }
  // RF-08–RF-15: toro APTO → calcula M_TOTAL y tasaciones (RF-16 salida completa).
  const mTotal = calculateMTotal(data);
  return {
    apto: true,
    motivosRechazo: [],
    mTotal,
    tasacionToroUsd: calculateBullPrice(mTotal),
    tasacionDosisUsd: calculateDosePrice(mTotal),
  };
}

module.exports = { evaluateBull };
