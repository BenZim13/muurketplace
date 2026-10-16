// Repo de proofs HCS espejo en Supabase (T6 spec 004, RF-03/RF-04/RF-08).
// Upsert atómico por valuation_key; el veredicto de verdad se exige inyectado
// (nunca autopromoción). Validación y veto en puro antes de red vía
// decideProofPut/decideProofStatusUpdate. Mock inyectado en tests, sin red.
"use strict";

const {
  decideProofPut,
  decideProofStatusUpdate,
  toPublicView,
} = require("../logic/mirrorRules.js");

// Convierte el registro espejo (camelCase) a fila Supabase (snake_case).
function toProofRow(record) {
  return {
    valuation_key: record.valuationKey,
    topic_id: record.topicId,
    sequence_number:
      record.sequenceNumber === undefined ? null : record.sequenceNumber,
    consensus_timestamp: record.consensusTimestamp,
    transaction_id: record.transactionId,
    status: record.status,
  };
}

// Convierte la fila Supabase de vuelta a registro espejo (camelCase).
function fromProofRow(row) {
  return {
    valuationKey: row.valuation_key,
    topicId: row.topic_id,
    sequenceNumber: row.sequence_number,
    consensusTimestamp: row.consensus_timestamp,
    transactionId: row.transaction_id,
    status: row.status,
  };
}

// Indica si el error del motor es denegación RLS al rol anon (solo lectura).
function isDeniedError(error) {
  return (
    error &&
    (error.code === "42501" || /permission denied|denegad/i.test(error.message || ""))
  );
}

// Lee la fila cruda por valuationKey (null si ausente).
async function readProofRow(supabase, valuationKey) {
  const { data, error } = await supabase
    .from("proofs")
    .select("*")
    .eq("valuation_key", valuationKey);
  if (error) {
    throw new Error("espejo no disponible: no se pudo leer la proof");
  }
  if (!data || data.length === 0) {
    return null;
  }
  return data[0];
}

// Guarda la proof ligada a su valuationKey: un solo upsert con la clave de
// conflicto correcta. Si reclama VERIFIED sin verdad VERIFIED, el motor puro
// fuerza MISMATCH (veto). El error 42501 (anon) se propaga como denegación.
async function saveProof(supabase, proofRecord, verdict) {
  const existingRow = await readProofRow(supabase, proofRecord && proofRecord.valuationKey);
  const existing = existingRow ? fromProofRow(existingRow) : null;
  const decided = decideProofPut(existing, proofRecord, verdict);
  if (decided.decision === "return-existing") {
    return { proof: decided.record, existed: true };
  }
  const row = toProofRow(decided.record);
  const { data, error } = await supabase
    .from("proofs")
    .upsert(row, { onConflict: "valuation_key" })
    .select();
  if (error) {
    if (isDeniedError(error)) {
      throw new Error("escritura denegada: rol anon solo lectura (42501)");
    }
    throw new Error("espejo no disponible: no se pudo guardar la proof");
  }
  return { proof: fromProofRow(data[0]), existed: false };
}

// Lee la proof por valuationKey y devuelve vista pública (referencia Testnet
// construida o ausencia explícita; MISMATCH/PENDING nunca como VERIFIED).
async function getProof(supabase, valuationKey) {
  const row = await readProofRow(supabase, valuationKey);
  if (!row) {
    return toPublicView(null, null);
  }
  const record = fromProofRow(row);
  return toPublicView(record, record);
}

// Promueve PENDING → VERIFIED|MISMATCH solo con prueba de verdad coincidente;
// conserva proof, valuationKey y txIds. La autopromoción lanza sin escribir.
async function updateProofStatus(supabase, valuationKey, nextStatus, proofOfTruth) {
  const existingRow = await readProofRow(supabase, valuationKey);
  const existing = existingRow ? fromProofRow(existingRow) : null;
  const decided = decideProofStatusUpdate(existing, nextStatus, proofOfTruth);
  const row = toProofRow(decided.record);
  const { data, error } = await supabase
    .from("proofs")
    .upsert(row, { onConflict: "valuation_key" })
    .select();
  if (error) {
    if (isDeniedError(error)) {
      throw new Error("escritura denegada: rol anon solo lectura (42501)");
    }
    throw new Error("espejo no disponible: no se pudo actualizar la proof");
  }
  return { proof: fromProofRow(data[0]), updated: true };
}

// Busca proofs por estado para consulta pública con rol anon (RF-07, RF-04):
// solo lectura, sin credenciales de operador ni llamada on-chain. Cada
// resultado lleva su referencia Testnet construida (la proof porta su
// topicId/txId); sin filas devuelve lista vacía (ausencia explícita).
async function findProofsByStatus(supabase, status) {
  if (status !== "VERIFIED" && status !== "MISMATCH" && status !== "PENDING") {
    throw new Error("estado inválido: solo VERIFIED|MISMATCH|PENDING");
  }
  const { data, error } = await supabase.from("proofs").select("*").eq("status", status);
  if (error) {
    throw new Error("espejo no disponible: no se pudo buscar por estado");
  }
  const rows = data || [];
  return rows.map((row) => {
    const record = fromProofRow(row);
    return toPublicView(record, record);
  });
}

module.exports = { saveProof, getProof, updateProofStatus, findProofsByStatus, toProofRow, fromProofRow };
