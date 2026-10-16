// Tests T6 Spec 002 RF-06: verifier mirror REST con 3 estados (sin falsos negativos).
// Comentarios en español; código en inglés. TDD: rojo antes de implementar.
// Sin red: `mirrorFetch` mock inyectado, nunca fetch real.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { verifyValuation } = require("../src/hedera/oracleVerifier.js");
const { buildOracleMessage } = require("../src/logic/oracleMessage.js");

// Entrada canónica EA-01 Spec 001 (11 campos PEGBraf + bullId).
function canonicalBullInput() {
  return {
    bullId: "BRAF-001",
    pesoNacerDep: -0.5,
    pesoDestateDep: 16.0,
    edadDesteDias: 210,
    pesoFinalDep: 32.0,
    edadPesoFinalDias: 540,
    circunferenciaEscrotalCm: 2.0,
    areaOjoBifeCm2: 3.2,
    grasaIntramuscularTop5: true,
    motilidadSeminalPct: 80,
    volumenEyaculadoMl: 200,
    pajuelasProducidas: 300,
  };
}

// Resultado APTO EA-01: mTotal 2.45, toro $73,500, dosis $24.50.
function canonicalBullResult() {
  return {
    apto: true,
    motivosRechazo: [],
    mTotal: 2.45,
    tasacionToroUsd: 73500,
    tasacionDosisUsd: 24.5,
  };
}

const TOPIC_ID = "0.0.123456";
const PUBLISHED_AT = "2026-10-16T00:00:00.000Z";

// Mensaje esperado EA-01 (specVersion 001 exigida).
function expectedMessage() {
  const built = buildOracleMessage(canonicalBullInput(), canonicalBullResult(), {
    publishedAt: PUBLISHED_AT,
  });
  return built.message;
}

// Codifica un objeto a base64 como lo sirve el mirror node (contents).
function toMirrorPayload(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

// Proof reciente: consensusTimestamp a 10 s del nowMs (dentro de la gracia 60 s).
function recentProof(nowMs) {
  const consensusSec = Math.floor((nowMs - 10000) / 1000);
  return {
    topicId: TOPIC_ID,
    sequenceNumber: "42",
    consensusTimestamp: consensusSec + ".123456789",
    transactionId: TOPIC_ID + "@" + consensusSec + ".123456789",
  };
}

// Proof vieja: consensusTimestamp a 120 s del nowMs (fuera de la gracia 60 s).
function agedProof(nowMs) {
  const consensusSec = Math.floor((nowMs - 120000) / 1000);
  return {
    topicId: TOPIC_ID,
    sequenceNumber: "42",
    consensusTimestamp: consensusSec + ".123456789",
    transactionId: TOPIC_ID + "@" + consensusSec + ".123456789",
  };
}

describe("T6 RF-06 VERIFIED con contenido idéntico", () => {
  it("mensaje idéntico del mirror → VERIFIED", async () => {
    const expected = expectedMessage();
    const nowMs = Date.parse("2026-10-16T00:05:00.000Z");
    const seenUrls = [];
    const mirrorFetch = async (url) => {
      seenUrls.push(String(url));
      return {
        messages: [
          {
            // contents base64→utf8 del canónico idéntico.
            message: toMirrorPayload(expected),
            sequence_number: "42",
            consensus_timestamp: "1729000000.123456789",
          },
        ],
      };
    };
    const result = await verifyValuation(recentProof(nowMs), expected, {
      mirrorFetch,
      nowMs,
    });
    assert.strictEqual(result.status, "VERIFIED");
    // Consulta al endpoint de mensajes del topic con el sequenceNumber.
    assert.ok(seenUrls.length === 1);
    assert.ok(seenUrls[0].includes(TOPIC_ID));
    assert.ok(seenUrls[0].includes("42"));
  });
});

describe("T6 RF-06 MISMATCH con decimal alterado", () => {
  it("dose 24.51 en mirror → MISMATCH con reason y diff", async () => {
    const expected = expectedMessage();
    const altered = JSON.parse(JSON.stringify(expected));
    altered.valuationsUsd.dose = 24.51;
    const nowMs = Date.parse("2026-10-16T00:05:00.000Z");
    const mirrorFetch = async () => ({
      messages: [
        {
          message: toMirrorPayload(altered),
          sequence_number: "42",
          consensus_timestamp: "1729000000.123456789",
        },
      ],
    });
    const result = await verifyValuation(recentProof(nowMs), expected, {
      mirrorFetch,
      nowMs,
    });
    assert.strictEqual(result.status, "MISMATCH");
    assert.ok(typeof result.reason === "string" && result.reason.length > 0);
    assert.ok(Array.isArray(result.diff));
    assert.ok(result.diff.some((d) => d.includes("valuationsUsd")));
  });

  it("specVersion distinta de 001 → MISMATCH con motivo spec-version", async () => {
    const expected = expectedMessage();
    const altered = JSON.parse(JSON.stringify(expected));
    altered.specVersion = "002";
    const nowMs = Date.parse("2026-10-16T00:05:00.000Z");
    const mirrorFetch = async () => ({
      messages: [
        {
          message: toMirrorPayload(altered),
          sequence_number: "42",
          consensus_timestamp: "1729000000.123456789",
        },
      ],
    });
    const result = await verifyValuation(recentProof(nowMs), expected, {
      mirrorFetch,
      nowMs,
    });
    assert.strictEqual(result.status, "MISMATCH");
    assert.match(String(result.reason), /spec-version/i);
  });
});

describe("T6 RF-06 PENDING sin falsos negativos", () => {
  it("mirror vacío dentro de gracia → PENDING not-yet-synced con retryAfterMs", async () => {
    const expected = expectedMessage();
    const nowMs = Date.parse("2026-10-16T00:05:00.000Z");
    const mirrorFetch = async () => ({ messages: [] });
    const result = await verifyValuation(recentProof(nowMs), expected, {
      mirrorFetch,
      nowMs,
    });
    assert.strictEqual(result.status, "PENDING");
    assert.strictEqual(result.reason, "not-yet-synced");
    assert.ok(typeof result.retryAfterMs === "number" && result.retryAfterMs > 0);
  });

  it("mirror caído (throw transitorio) → PENDING mirror-unavailable", async () => {
    const expected = expectedMessage();
    const nowMs = Date.parse("2026-10-16T00:05:00.000Z");
    const mirrorFetch = async () => {
      throw new Error("fetch failed: mirror unavailable");
    };
    const result = await verifyValuation(recentProof(nowMs), expected, {
      mirrorFetch,
      nowMs,
    });
    assert.strictEqual(result.status, "PENDING");
    assert.strictEqual(result.reason, "mirror-unavailable");
    assert.ok(typeof result.retryAfterMs === "number" && result.retryAfterMs > 0);
  });

  it("mirror vacío tras la gracia → PENDING not-found-after-grace (nunca NOT_FOUND definitivo)", async () => {
    const expected = expectedMessage();
    const nowMs = Date.parse("2026-10-16T00:05:00.000Z");
    const mirrorFetch = async () => ({ messages: [] });
    const result = await verifyValuation(agedProof(nowMs), expected, {
      mirrorFetch,
      nowMs,
    });
    assert.strictEqual(result.status, "PENDING");
    assert.strictEqual(result.reason, "not-found-after-grace");
    // Nunca devuelve NOT_FOUND definitivo en esta spec.
    assert.notStrictEqual(result.status, "NOT_FOUND");
  });
});
