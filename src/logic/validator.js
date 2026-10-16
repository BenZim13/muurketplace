// Validador biológico del Toro Líder (RF-02 a RF-05 + RF-07).
// Lógica pura: solo requiere constantes propias, sin SDK ni red ni fs ni Date.
// T2: implementa las 4 barreras con comparaciones inclusivas exactas sin epsilon.
// Acumula todos los motivos sin cortocircuito; guarda "SI existe" para no
// duplicar motivos de ausencia (los ausentes/inválidos se tratan en T3/RF-06).
"use strict";

const {
  EDAD_DESTETE_MIN_DIAS,
  EDAD_DESTETE_MAX_DIAS,
  EDAD_FINAL_MIN_DIAS,
  EDAD_FINAL_MAX_DIAS,
  CE_MIN_CM,
  MOTILIDAD_MIN_PCT,
} = require("./constants.js");

// Verifica que el campo exista (no ausente ni nulo) antes de evaluar barreras.
// Ausentes/inválidos pertenecen a T3 (RF-06); aquí solo se evita el doble motivo.
function exists(value) {
  return value !== undefined && value !== null;
}

function validateBull(data) {
  // Motivos legibles en español, códigos estables para auditoría (plan T-08).
  const motivosRechazo = [];

  // RF-06a — Campos requeridos 1–9 ausentes o nulos (T-05: === undefined || === null, nunca falsy).
  // 0 y false son valores válidos presentes; solo undefined/null es ausencia.
  const requiredFields = [
    "pesoNacerDep",
    "pesoDestateDep",
    "edadDesteDias",
    "pesoFinalDep",
    "edadPesoFinalDias",
    "circunferenciaEscrotalCm",
    "areaOjoBifeCm2",
    "grasaIntramuscularTop5",
    "motilidadSeminalPct",
  ];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      motivosRechazo.push(`campo ausente: ${field}`);
    }
  }

  // RF-06b — Físicamente imposibles (solo si el campo existe; no duplica ausencia).
  if (exists(data.edadDesteDias) && data.edadDesteDias <= 0) {
    motivosRechazo.push("edad destete inválida");
  }
  if (exists(data.edadPesoFinalDias) && data.edadPesoFinalDias <= 0) {
    motivosRechazo.push("edad final inválida");
  }
  if (exists(data.circunferenciaEscrotalCm) && data.circunferenciaEscrotalCm <= 0) {
    motivosRechazo.push("CE inválida");
  }
  if (
    exists(data.motilidadSeminalPct) &&
    (data.motilidadSeminalPct < 0 || data.motilidadSeminalPct > 100)
  ) {
    motivosRechazo.push("motilidad inválida");
  }
  if (exists(data.areaOjoBifeCm2) && data.areaOjoBifeCm2 < 0) {
    motivosRechazo.push("AOB inválida");
  }

  // RF-02 — Edad al destete: rechaza SI < 100 O > 300 (100 y 300 válidos).
  if (exists(data.edadDesteDias)) {
    if (data.edadDesteDias < EDAD_DESTETE_MIN_DIAS || data.edadDesteDias > EDAD_DESTETE_MAX_DIAS) {
      motivosRechazo.push("edad de destete fuera de rango");
    }
  }

  // RF-03 — Edad a la medición final: rechaza SI < 450 O > 730 (ambos válidos).
  if (exists(data.edadPesoFinalDias)) {
    if (data.edadPesoFinalDias < EDAD_FINAL_MIN_DIAS || data.edadPesoFinalDias > EDAD_FINAL_MAX_DIAS) {
      motivosRechazo.push("edad final fuera de rango");
    }
  }

  // RF-04 — Circunferencia escrotal: rechaza SI < 1.5 (1.5 válido).
  if (exists(data.circunferenciaEscrotalCm)) {
    if (data.circunferenciaEscrotalCm < CE_MIN_CM) {
      motivosRechazo.push("fertilidad insuficiente");
    }
  }

  // RF-05 — Viabilidad seminal: rechaza SI < 70 (70 válido).
  if (exists(data.motilidadSeminalPct)) {
    if (data.motilidadSeminalPct < MOTILIDAD_MIN_PCT) {
      motivosRechazo.push("viabilidad seminal insuficiente");
    }
  }

  // RF-01 es invariante de precisión: aquí NO se redondea nada.
  // Campos 10-11 (volumen, pajuelas) se ignoran por completo en validación.
  return { apto: motivosRechazo.length === 0, motivosRechazo };
}

module.exports = { validateBull };
