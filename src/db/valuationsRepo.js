// Repo de valuaciones espejo en Supabase (T5 spec 004, RF-02/RF-07).
// Upsert atómico por valuation_key con convergencia ante conflicto 23505/409:
// el motor resuelve la carrera, el repo relee y decide en puro con
// decideValuationPut (reintento idéntico ⇒ original, clave con input distinto
// ⇒ rechazo). Validación pura antes de red. Mock inyectado en tests, sin red.
"use strict";

const { decideValuationPut, toPublicView } = require("../logic/mirrorRules.js");

// Convierte el registro espejo (camelCase) a fila Supabase (snake_case).
function toValuationRow(record) {
  return {
    valuation_key: record.valuationKey,
    bull_id: record.bullId,
    spec_version: record.specVersion,
    m_total: record.mTotal,
    price_bull_usd: record.priceBullUsd,
    price_dose_usd: record.priceDoseUsd,
    canonical_json: record.canonicalJson,
  };
}

// Convierte la fila Supabase de vuelta a registro espejo (camelCase).
function fromValuationRow(row) {
  return {
    valuationKey: row.valuation_key,
    bullId: row.bull_id,
    specVersion: row.spec_version,
    mTotal: row.m_total,
    priceBullUsd: row.price_bull_usd,
    priceDoseUsd: row.price_dose_usd,
    canonicalJson: row.canonical_json,
  };
}

// Validación pura antes de red: exige clave, spec 001 y totales, sin inventar.
function assertValuationRecord(record) {
  if (!record || typeof record.valuationKey !== "string" || record.valuationKey.length === 0) {
    throw new Error("registro incompleto: valuationKey requerida, el espejo no inventa");
  }
  if (record.specVersion !== "001") {
    throw new Error("spec-version no soportada: solo 001");
  }
  if (typeof record.bullId !== "string" || record.bullId.length === 0) {
    throw new Error("registro incompleto: bullId requerido, el espejo no inventa");
  }
  for (const field of ["mTotal", "priceBullUsd", "priceDoseUsd"]) {
    if (typeof record[field] !== "number" || !Number.isFinite(record[field])) {
      throw new Error("registro incompleto: " + field + " requerido, el espejo no inventa");
    }
  }
  if (!record.canonicalJson || typeof record.canonicalJson !== "object") {
    throw new Error("registro incompleto: canonicalJson requerido, el espejo no inventa");
  }
}

// Lee la fila cruda por valuationKey (null si ausente).
async function readValuationRow(supabase, valuationKey) {
  const { data, error } = await supabase.from("valuations").select("*").eq("valuation_key", valuationKey);
  if (error) {
    throw new Error("espejo no disponible: no se pudo leer la valuación");
  }
  if (!data || data.length === 0) {
    return null;
  }
  return data[0];
}

// Indica si el error del motor es un conflicto de clave (carrera de reintentos).
function isConflictError(error) {
  return error && (error.code === "23505" || error.code === "409" || /duplicate|conflict/i.test(error.message || ""));
}

// Guarda la valuación idempotente por valuationKey: un solo upsert con la
// clave de conflicto correcta; ante conflicto del motor converge releyendo y
// decidiendo en puro (idéntico ⇒ original, distinto ⇒ lanza).
async function saveValuation(supabase, valuationRecord) {
  assertValuationRecord(valuationRecord);
  // Decisión pura con lo ya espejado: reintento idéntico no reescribe.
  const existingRow = await readValuationRow(supabase, valuationRecord.valuationKey);
  if (existingRow) {
    const decided = decideValuationPut(fromValuationRow(existingRow), valuationRecord);
    return { valuation: toPublicView(decided.record, null), existed: decided.decision === "return-existing" };
  }
  const row = toValuationRow(valuationRecord);
  const { data, error } = await supabase.from("valuations").upsert(row, { onConflict: "valuation_key" }).select();
  if (!error) {
    return { valuation: toPublicView(fromValuationRow(data[0]), null), existed: false };
  }
  // Carrera de reintentos: el motor ganó con la misma clave; converger
  // releyendo y decidiendo en puro, sin duplicar.
  if (isConflictError(error)) {
    const winnerRow = await readValuationRow(supabase, valuationRecord.valuationKey);
    const decided = decideValuationPut(winnerRow ? fromValuationRow(winnerRow) : null, valuationRecord);
    return { valuation: toPublicView(decided.record, null), existed: decided.decision !== "insert" };
  }
  throw new Error("espejo no disponible: no se pudo guardar la valuación");
}

// Lee la valuación por valuationKey y devuelve vista pública verificable
// (con referencia Testnet si hay proof, o ausencia explícita si no existe).
async function getValuation(supabase, valuationKey, proof = null) {
  const row = await readValuationRow(supabase, valuationKey);
  if (!row) {
    return toPublicView(null, null);
  }
  return toPublicView(fromValuationRow(row), proof);
}

// Busca valuaciones por toro para consulta pública con rol anon (RF-07):
// solo lectura, sin credenciales de operador ni llamada on-chain. Cada
// resultado lleva referencia Testnet construida si hay proof en el mapa,
// o ausencia explícita con marca de no verificado si aún no existe.
async function findValuationsByBullId(supabase, bullId, proofsByKey = {}) {
  if (typeof bullId !== "string" || bullId.length === 0) {
    throw new Error("registro incompleto: bullId requerido, el espejo no inventa");
  }
  const { data, error } = await supabase.from("valuations").select("*").eq("bull_id", bullId);
  if (error) {
    throw new Error("espejo no disponible: no se pudo leer las valuaciones del toro");
  }
  const rows = data || [];
  return rows.map((row) => {
    const record = fromValuationRow(row);
    const proof = (proofsByKey || {})[record.valuationKey] || null;
    return toPublicView(record, proof);
  });
}

module.exports = { saveValuation, getValuation, findValuationsByBullId, toValuationRow, fromValuationRow };
