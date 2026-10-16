// Constantes del motor de validación y tasación (fuente PEGBraf).
// Lógica 100% pura: sin SDK, sin red, sin fs, sin fecha, sin aleatoriedad.
// Comentarios en español; identificadores de código en inglés (IDs PEGBraf eximidos).
"use strict";

// Valores base de tasación en USD (spec § Supuesto 2).
// Umbrales de validación (RF-02 a RF-05, RF-07) y de bonos (RF-09 a RF-12).
// Bonos aditivos sobre base M = 1.0 (RF-08).
module.exports = Object.freeze({
  // Tasación base.
  VALOR_BASE_TORO_USD: 30000,
  VALOR_BASE_DOSIS_USD: 10,

  // Base del multiplicador (RF-08).
  M_BASE: 1.0,

  // Umbrales de validación biológica (inclusivos, RF-07).
  EDAD_DESTETE_MIN_DIAS: 100,
  EDAD_DESTETE_MAX_DIAS: 300,
  EDAD_FINAL_MIN_DIAS: 450,
  EDAD_FINAL_MAX_DIAS: 730,
  CE_MIN_CM: 1.5,
  MOTILIDAD_MIN_PCT: 70,

  // Umbrales de bonos de tasación.
  PESO_NACER_MAX_DEP: 0.0,
  PESO_DESTETE_MIN_DEP: 15.0,
  PESO_FINAL_MIN_DEP: 30.0,
  AOB_INTERMEDIA_MIN_CM2: 2.0,
  AOB_PREMIUM_MIN_CM2: 3.0,

  // Bonos aditivos de M_TOTAL.
  BONUS_FACILIDAD_PARTO: 0.5,
  BONUS_CRECIMIENTO: 0.15,
  BONUS_AOB_PREMIUM: 0.5,
  BONUS_AOB_INTERMEDIA: 0.2,
  BONUS_MARMOLEADO: 0.3,
});
