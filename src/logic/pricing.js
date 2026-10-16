// Motor de tasación: M_TOTAL + precios de toro y dosis (RF-08 a RF-15).
// Lógica pura: sin imports externos salvo constantes propias.
// T4: calculateMTotal con base RF-08 + RF-10 (AND estricto, valores exactos RF-01).
// T5: RF-09 (PN <= 0.0), RF-11/RF-12 (AOB else-if), RF-13 (=== true).
// T6: RF-14/RF-15 tasación (calculateBullPrice, roundHalfUp2, calculateDosePrice).
"use strict";

const {
  VALOR_BASE_TORO_USD,
  VALOR_BASE_DOSIS_USD,
  M_BASE,
  PESO_NACER_MAX_DEP,
  PESO_DESTETE_MIN_DEP,
  PESO_FINAL_MIN_DEP,
  AOB_INTERMEDIA_MIN_CM2,
  AOB_PREMIUM_MIN_CM2,
  BONUS_FACILIDAD_PARTO,
  BONUS_CRECIMIENTO,
  BONUS_AOB_PREMIUM,
  BONUS_AOB_INTERMEDIA,
  BONUS_MARMOLEADO,
} = require("./constants.js");

function calculateMTotal(data) {
  // RF-08: base 1.0 para todo toro APTO antes de bonificaciones.
  let mTotal = M_BASE;
  // RF-09: facilidad de parto con borde inclusivo (DEP <= 0.0 bonifica).
  // Comparación directa sin epsilon; 0.0 exacto sí, 0.01 no.
  if (data.pesoNacerDep <= PESO_NACER_MAX_DEP) {
    mTotal += BONUS_FACILIDAD_PARTO;
  }
  // RF-10: crecimiento superior con AND estricto (ambos > umbral).
  // Comparaciones directas sin epsilon (plan T-04); 15.0/30.0 exactos no bonifican.
  // RF-01: se usan los decimales exactos (16.4 no se redondea a 15 ni 20).
  if (data.pesoDestateDep > PESO_DESTETE_MIN_DEP && data.pesoFinalDep > PESO_FINAL_MIN_DEP) {
    mTotal += BONUS_CRECIMIENTO;
  }
  // RF-11/RF-12: AOB con else-if no acumulable (plan T-02).
  // >= 3.0 otorga solo premium (+0.50); si no, >= 2.0 otorga intermedia (+0.20).
  if (data.areaOjoBifeCm2 >= AOB_PREMIUM_MIN_CM2) {
    mTotal += BONUS_AOB_PREMIUM;
  } else if (data.areaOjoBifeCm2 >= AOB_INTERMEDIA_MIN_CM2) {
    mTotal += BONUS_AOB_INTERMEDIA;
  }
  // RF-13: marmoleado solo con igualdad estricta === true (plan T-06).
  // Valores truthy no booleanos (1, "true") no bonifican.
  if (data.grasaIntramuscularTop5 === true) {
    mTotal += BONUS_MARMOLEADO;
  }
  // Campos 10-11 (volumen, pajuelas) jamás se leen aquí (supuesto 3, riesgo R-05).
  return mTotal;
}

function calculateBullPrice(mTotal) {
  // RF-14: tasación del toro entera en USD (30000 * M_TOTAL).
  // Math.round absorbe el error binario (riesgo R-01: 30000*2.4499999999999997
  // da 73499.99999999999 y debe devolver 73500 entero exacto).
  return Math.round(VALOR_BASE_TORO_USD * mTotal);
}

function roundHalfUp2(value) {
  // RF-15 helper: redondeo half-up a 2 decimales, sin toFixed ni librerías (plan T-03).
  // Number.EPSILON escalado por 100: el error de 1.005*100 (~1.4e-14) supera al
  // EPSILON solo (2.2e-16) y sin escala 1.005 daría 1.00 en vez de 1.01.
  return Math.floor(value * 100 + 0.5 + Number.EPSILON * 100) / 100;
}

function calculateDosePrice(mTotal) {
  // RF-15: tasación de la dosis half-up a 2 decimales (10 * M_TOTAL).
  // El EPSILON de roundHalfUp2 absorbe 10*2.4499999999999997 = 24.499999999999996 → 24.50.
  return roundHalfUp2(VALOR_BASE_DOSIS_USD * mTotal);
}

module.exports = { calculateMTotal, calculateBullPrice, calculateDosePrice, roundHalfUp2 };
