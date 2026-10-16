// Mensaje canónico del oráculo HCS (RF-05, specVersion 001).
// Lógica 100% pura: solo node:crypto (hash), sin SDK, sin process.env, sin red,
// sin fs, sin Date.now, sin Math.random. publishedAt llega por parámetro.
"use strict";

const { createHash } = require("node:crypto");

// Los 11 campos PEGBraf evaluados (copia exacta, sin redondeo).
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

// Serializa con claves ordenadas alfabéticamente de forma recursiva.
// Los números se serializan sin redondeo (JSON.stringify nativo).
function toCanonicalJson(value) {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(toCanonicalJson).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const parts = keys.map((k) => JSON.stringify(k) + ":" + toCanonicalJson(value[k]));
    return "{" + parts.join(",") + "}";
  }
  return JSON.stringify(value);
}

// Hash hexadecimal estable para idempotencia (valuationKey).
function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// Construye el mensaje canónico a partir de la entrada PEGBraf y el resultado APTO.
// Lanza si apto !== true, si falta tasación o si specVersion !== "001".
function buildOracleMessage(bullInput, bullResult, meta) {
  if (!bullResult || bullResult.apto !== true) {
    throw new Error("solo APTOS registrables: apto debe ser true");
  }
  if (
    bullResult.mTotal === null ||
    bullResult.mTotal === undefined ||
    bullResult.tasacionToroUsd === null ||
    bullResult.tasacionToroUsd === undefined ||
    bullResult.tasacionDosisUsd === null ||
    bullResult.tasacionDosisUsd === undefined
  ) {
    throw new Error("tasación ausente: mTotal y tasaciones son requeridas");
  }
  const params = meta || {};
  const specVersion = params.specVersion === undefined ? "001" : params.specVersion;
  if (specVersion !== "001") {
    throw new Error("spec-version no soportada: solo 001");
  }
  if (!params.publishedAt || typeof params.publishedAt !== "string") {
    throw new Error("publishedAt requerido: instante ISO-8601 por parámetro");
  }
  const input = bullInput || {};
  const bullId = input.bullId !== undefined ? input.bullId : input.lote;
  if (typeof bullId !== "string" || bullId.length === 0) {
    throw new Error("bullId requerido: identificación no vacía del toro/lote");
  }
  // Copia exacta de los 11 campos PEGBraf (sin redondeo, sin campos extra).
  const inputs = {};
  for (const field of INPUT_FIELDS) {
    inputs[field] = input[field];
  }
  // Mensaje sin valuationKey para derivar el hash estable.
  const messageSinKey = {
    specVersion,
    schemaVersion: 1,
    bullId,
    inputs,
    verdict: { apto: true },
    mTotal: bullResult.mTotal,
    valuationsUsd: {
      bull: bullResult.tasacionToroUsd,
      dose: bullResult.tasacionDosisUsd,
    },
    publishedAt: params.publishedAt,
  };
  const valuationKey = sha256Hex(toCanonicalJson(messageSinKey));
  const message = { ...messageSinKey, valuationKey };
  return { message, canonicalJson: toCanonicalJson(message), valuationKey };
}

// Compara por valor (números con ===, sin tolerancia) dos mensajes.
// Acepta string JSON u objeto en ambos lados. Orden de claves irrelevante:
// 24.5 vs 24.50 es VERIFIED; 2.45 vs 2.46 es MISMATCH con diff de rutas.
function verifyMessageContent(retrievedJson, expectedMessage) {
  const retrieved =
    typeof retrievedJson === "string" ? JSON.parse(retrievedJson) : retrievedJson;
  const expected =
    typeof expectedMessage === "string" ? JSON.parse(expectedMessage) : expectedMessage;
  const diff = diffDeep(retrieved, expected, "");
  if (diff.length === 0) {
    return { status: "VERIFIED" };
  }
  return { status: "MISMATCH", diff };
}

// Diferencia profunda: devuelve rutas de campos que difieren o faltan.
function diffDeep(actual, expected, path) {
  // Comparación exacta de primitivos (números por valor, sin epsilon).
  if (actual === expected) {
    return [];
  }
  const actualIsObj =
    actual !== null && typeof actual === "object" && !Array.isArray(actual);
  const expectedIsObj =
    expected !== null && typeof expected === "object" && !Array.isArray(expected);
  if (actualIsObj && expectedIsObj) {
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    const out = [];
    for (const key of keys) {
      const childPath = path === "" ? key : path + "." + key;
      if (!(key in actual) || !(key in expected)) {
        out.push(childPath);
      } else {
        out.push(...diffDeep(actual[key], expected[key], childPath));
      }
    }
    return out;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      return [path === "" ? "(root)" : path];
    }
    const out = [];
    for (let i = 0; i < actual.length; i++) {
      out.push(...diffDeep(actual[i], expected[i], path + "[" + i + "]"));
    }
    return out;
  }
  // Tipos distintos, valores distintos o uno ausente (undefined vs valor).
  return [path === "" ? "(root)" : path];
}

module.exports = { buildOracleMessage, toCanonicalJson, verifyMessageContent };
