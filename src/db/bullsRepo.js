// Repo de toros espejo en Supabase (T5 spec 004, RF-01/RF-07).
// Un solo upsert por bull_id por guardado, sin tocar red real en tests (mock
// inyectado). Validación pura antes de red: el espejo no inventa.
"use strict";

const { toPublicView } = require("../logic/mirrorRules.js");

// Convierte el registro espejo (camelCase) a fila Supabase (snake_case).
function toBullRow(record) {
  return {
    bull_id: record.bullId,
    inputs: record.inputs,
    apto: record.apto,
    motivos: record.motivos,
    m_total: record.mTotal,
    price_bull_usd: record.priceBullUsd,
    price_dose_usd: record.priceDoseUsd,
  };
}

// Convierte la fila Supabase de vuelta a registro espejo (camelCase).
function fromBullRow(row) {
  return {
    bullId: row.bull_id,
    inputs: row.inputs,
    apto: row.apto,
    motivos: row.motivos,
    mTotal: row.m_total,
    priceBullUsd: row.price_bull_usd,
    priceDoseUsd: row.price_dose_usd,
  };
}

// Validación pura antes de red: exige registro completo, sin inventar datos.
function assertBullRecord(record) {
  if (!record || typeof record.bullId !== "string" || record.bullId.length === 0) {
    throw new Error("registro incompleto: bullId requerido, el espejo no inventa");
  }
  if (!record.inputs || typeof record.inputs !== "object") {
    throw new Error("registro incompleto: inputs PEGBraf requeridos, el espejo no inventa");
  }
  for (const field of ["mTotal", "priceBullUsd", "priceDoseUsd"]) {
    if (typeof record[field] !== "number" || !Number.isFinite(record[field])) {
      throw new Error("registro incompleto: " + field + " requerido, el espejo no inventa");
    }
  }
}

// Guarda el toro con un solo upsert atómico por bull_id (idempotente en motor).
async function saveBull(supabase, bullRecord) {
  assertBullRecord(bullRecord);
  const row = toBullRow(bullRecord);
  const { data, error } = await supabase.from("bulls").upsert(row, { onConflict: "bull_id" }).select();
  if (error) {
    throw new Error("espejo no disponible: no se pudo guardar el toro");
  }
  return { bull: fromBullRow(data[0]), existed: false };
}

// Lee el toro por bull_id y devuelve vista pública (referencia o ausencia explícita).
async function getBull(supabase, bullId, proof = null) {
  const { data, error } = await supabase.from("bulls").select("*").eq("bull_id", bullId);
  if (error) {
    throw new Error("espejo no disponible: no se pudo leer el toro");
  }
  if (!data || data.length === 0) {
    return toPublicView(null, null);
  }
  return toPublicView(fromBullRow(data[0]), proof);
}

// Lista toros para consulta pública con rol anon (RF-07): solo lectura,
// sin credenciales de operador ni llamada on-chain. Cada resultado lleva
// referencia Testnet construida si hay proof en el mapa, o ausencia
// explícita con marca de no verificado si aún no existe.
async function findBulls(supabase, proofsByBullId = {}) {
  const { data, error } = await supabase.from("bulls").select("*");
  if (error) {
    throw new Error("espejo no disponible: no se pudo listar los toros");
  }
  const rows = data || [];
  return rows.map((row) => {
    const record = fromBullRow(row);
    const proof = (proofsByBullId || {})[record.bullId] || null;
    return toPublicView(record, proof);
  });
}

module.exports = { saveBull, getBull, findBulls, toBullRow, fromBullRow };
