// Test E2E Testnet gateado (T7: RF-04 + RF-06 con red real).
// Comentarios en español; código en inglés.
// Gateado: se salta salvo RUN_HCS_INTEGRATION=1 + MY_ACCOUNT_ID +
// MY_PRIVATE_KEY (+ HCS_VALUATIONS_TOPIC_ID o permiso de crear).
// Sin la variable, `node --test tests/` sigue en verde sin tocar la red.
// Único test con red de la spec (plan §4.5, R-08). Solo Testnet.
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { loadOracleConfig } = require("../config/oracle.config.js");
const { createHcsClient } = require("../src/hedera/hcsClient.js");
const { resolveValuationsTopic } = require("../src/hedera/topicManager.js");
const { publishValuation } = require("../src/hedera/oraclePublisher.js");
const { verifyValuation } = require("../src/hedera/oracleVerifier.js");
const { buildOracleMessage } = require("../src/logic/oracleMessage.js");

// Gate: solo corre con red cuando el operador lo pide explícitamente.
const RUN_INTEGRATION = process.env.RUN_HCS_INTEGRATION === "1";

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

// Espera simple entre reintentos de verificación contra el mirror.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("T7 E2E Testnet gateado (RF-04 publica + RF-06 verifica)", { skip: !RUN_INTEGRATION }, () => {
  it("publica EA-01 real, mirror da VERIFIED y lo alterado da MISMATCH", { timeout: 120000 }, async () => {
    const accountId = process.env.MY_ACCOUNT_ID;
    const privateKey = process.env.MY_PRIVATE_KEY;
    assert.ok(accountId, "MY_ACCOUNT_ID requerido con RUN_HCS_INTEGRATION=1");
    assert.ok(privateKey, "MY_PRIVATE_KEY requerido con RUN_HCS_INTEGRATION=1");

    // Topic configurado o null (el manager crea uno si hay permiso).
    const oracleConfig = loadOracleConfig(process.env);
    const client = createHcsClient({ accountId, privateKey });
    const topicId = await resolveValuationsTopic(client, oracleConfig.topicId);
    assert.match(topicId, /^0\.0\.\d+$/, "topicId válido en Testnet");

    // publishedAt único por corrida (evita colisión de valuationKey).
    const publishedAt = new Date().toISOString();
    const bullInput = canonicalBullInput();
    const bullResult = canonicalBullResult();

    // Publicación real contra Testnet (sin submitFn inyectado).
    const proof = await publishValuation(client, topicId, bullInput, bullResult, {
      publishedAt,
      maxRetries: oracleConfig.maxRetries,
      baseDelayMs: oracleConfig.baseDelayMs,
    });
    assert.strictEqual(proof.topicId, topicId);
    for (const field of ["sequenceNumber", "consensusTimestamp", "transactionId"]) {
      assert.ok(
        typeof proof[field] === "string" && proof[field].length > 0,
        "proof." + field + " presente tras receipt"
      );
    }

    // Enlaces HashScan para verificación manual.
    console.log("HashScan topic: https://hashscan.io/testnet/topic/" + topicId);
    console.log("HashScan tx: https://hashscan.io/testnet/transaction/" + proof.transactionId);

    // Mensaje esperado idéntico al publicado (mismo publishedAt).
    const expected = buildOracleMessage(bullInput, bullResult, {
      publishedAt,
      specVersion: "001",
    }).message;

    // Reintenta contra el mirror real hasta 60 s hasta VERIFIED.
    const deadlineMs = Date.now() + 60000;
    let verdict = null;
    for (;;) {
      verdict = await verifyValuation(proof, expected, {});
      if (verdict.status === "VERIFIED") {
        break;
      }
      assert.strictEqual(verdict.status, "PENDING", "mirror en gracia: PENDING, no falso negativo");
      assert.ok(Date.now() < deadlineMs, "mirror debió sincronizar en 60 s, último: " + verdict.reason);
      await sleep(5000);
    }
    assert.strictEqual(verdict.status, "VERIFIED");

    // Lo alterado (dosis +0.01) contra la misma prueba da MISMATCH.
    const tampered = {
      ...expected,
      valuationsUsd: { ...expected.valuationsUsd, dose: 24.51 },
    };
    const mismatch = await verifyValuation(proof, tampered, {});
    assert.strictEqual(mismatch.status, "MISMATCH");
    assert.ok(Array.isArray(mismatch.diff) && mismatch.diff.length > 0);
  });
});
