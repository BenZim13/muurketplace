// Tests T4 Spec 002 RF-03/RF-04: Publisher guarda APTO + publica 1 mensaje.
// Comentarios en español; código en inglés. TDD: rojo antes de implementar.
// Sin red: `submitFn` mock inyectado + clases SDK falsas vía `deps.sdk`.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  publishValuation,
  isRetryableError,
  computeBackoffMs,
  clearPublisherState,
} = require("../src/hedera/oraclePublisher.js");

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

// Fabrica clases SDK falsas espiables (sin red) que capturan topic y mensaje.
function makeDeps() {
  const seen = { messages: [], topicIds: [] };
  class FakeTopicMessageSubmitTransaction {
    setTopicId(topicId) {
      this._topicId = topicId;
      seen.topicIds.push(String(topicId));
      return this;
    }
    setMessage(message) {
      this._message = message;
      seen.messages.push(String(message));
      return this;
    }
  }
  const fakeClient = {};
  const deps = {
    sdk: { TopicMessageSubmitTransaction: FakeTopicMessageSubmitTransaction },
  };
  return { seen, fakeClient, deps };
}

describe("T4 RF-03 RECHAZADO no publica e informa motivos", () => {
  it("apto=false deja submitFn en 0 llamadas y lanza con motivos", async () => {
    const { fakeClient, deps } = makeDeps();
    let submitCalls = 0;
    const submitFn = async () => {
      submitCalls += 1;
      return {};
    };
    const rejected = {
      apto: false,
      motivosRechazo: ["edad de destete fuera de rango"],
      mTotal: null,
      tasacionToroUsd: null,
      tasacionDosisUsd: null,
    };
    await assert.rejects(
      () =>
        publishValuation(fakeClient, TOPIC_ID, canonicalBullInput(), rejected, {
          publishedAt: PUBLISHED_AT,
          baseDelayMs: 1,
          submitFn,
        }, deps),
      /rechazado|apto/i
    );
    assert.strictEqual(submitCalls, 0, "submitFn debe quedar en 0 llamadas si apto=false");
  });
});

describe("T4 RF-04 APTO publica exactamente 1 mensaje con proof de 4 campos", () => {
  it("apto=true EA-01 deja submitFn en 1 llamada y devuelve proof completo", async () => {
    const { seen, fakeClient, deps } = makeDeps();
    let submitCalls = 0;
    let submittedTx = null;
    const submitFn = async (tx) => {
      submitCalls += 1;
      submittedTx = tx;
      // Receipt falso sin red: prueba de consenso simulada.
      return {
        sequenceNumber: "42",
        consensusTimestamp: "1729000000.123456789",
        transactionId: "0.0.789@1729000000.123456789",
      };
    };
    const proof = await publishValuation(
      fakeClient,
      TOPIC_ID,
      canonicalBullInput(),
      canonicalBullResult(),
      { publishedAt: PUBLISHED_AT, baseDelayMs: 1, submitFn },
      deps
    );
    assert.strictEqual(submitCalls, 1, "submitFn debe llamarse exactamente 1 vez");
    // Proof con los 4 campos presentes (RF-04, RNF-04 solo tras receipt).
    assert.strictEqual(proof.topicId, TOPIC_ID);
    assert.ok(typeof proof.sequenceNumber === "string" && proof.sequenceNumber.length > 0);
    assert.ok(typeof proof.consensusTimestamp === "string" && proof.consensusTimestamp.length > 0);
    assert.ok(typeof proof.transactionId === "string" && proof.transactionId.length > 0);
    // El mensaje enviado es el JSON canónico con specVersion 001.
    assert.ok(submittedTx !== null);
    assert.strictEqual(seen.topicIds.length, 1);
    assert.strictEqual(seen.messages.length, 1);
    const sent = JSON.parse(seen.messages[0]);
    assert.strictEqual(sent.specVersion, "001");
    assert.strictEqual(sent.mTotal, 2.45);
    assert.deepStrictEqual(sent.valuationsUsd, { bull: 73500, dose: 24.5 });
  });
});

// Tests T5 Spec 002 RF-07/RF-08: reintentos acotados + idempotencia de borde.
// Sin red: `submitFn` mock + `sleepFn` inmediato (sin espera real).
// TDD rojo: requieren isRetryableError/computeBackoffMs + bucle con
// inFlight[valuationKey] y caché de proof (plan §1.4 T-03/T-04).
function noSleep() {
  return Promise.resolve();
}

function transientError() {
  const err = new Error("TIMEOUT: request timed out awaiting consensus");
  err.code = "TIMEOUT";
  return err;
}

describe("T5 RF-07 transitorio confirma en 2 intentos", () => {
  it("1 fallo transitorio → reintenta y confirma con proof completo", async () => {
    clearPublisherState();
    const { fakeClient, deps } = makeDeps();
    let submitCalls = 0;
    const submitFn = async () => {
      submitCalls += 1;
      if (submitCalls === 1) {
        throw transientError();
      }
      return {
        sequenceNumber: "7",
        consensusTimestamp: "1729000000.777777777",
        transactionId: "0.0.789@1729000000.777777777",
      };
    };
    const proof = await publishValuation(
      fakeClient,
      TOPIC_ID,
      { ...canonicalBullInput(), bullId: "BRAF-T5-RETRY" },
      canonicalBullResult(),
      { publishedAt: PUBLISHED_AT, baseDelayMs: 1, submitFn, sleepFn: noSleep },
      deps
    );
    assert.strictEqual(submitCalls, 2, "transitorio debe confirmar en 2 intentos");
    assert.strictEqual(proof.topicId, TOPIC_ID);
    assert.ok(proof.sequenceNumber.length > 0);
    assert.ok(proof.consensusTimestamp.length > 0);
    assert.ok(proof.transactionId.length > 0);
  });
});

describe("T5 RF-07 permanente falla en 4 intentos sin proof", () => {
  it("fallo retryable sostenido → 4 intentos y lanza sin proof", async () => {
    clearPublisherState();
    const { fakeClient, deps } = makeDeps();
    let submitCalls = 0;
    const submitFn = async () => {
      submitCalls += 1;
      const err = new Error("UNAVAILABLE: network unavailable");
      err.code = "UNAVAILABL";
      err.code = "UNAVAILABLE";
      throw err;
    };
    await assert.rejects(
      () =>
        publishValuation(
          fakeClient,
          TOPIC_ID,
          { ...canonicalBullInput(), bullId: "BRAF-T5-FAIL" },
          canonicalBullResult(),
          { publishedAt: PUBLISHED_AT, baseDelayMs: 1, submitFn, sleepFn: noSleep },
          deps
        ),
      /no confirmado|agotado|reintent/i
    );
    assert.strictEqual(submitCalls, 4, "1 intento inicial + 3 reintentos = 4 llamadas");
  });
});

describe("T5 RF-07 no-retryable no reintenta", () => {
  it("INSUFFICIENT_TX_FEE → 1 intento y lanza sin proof", async () => {
    clearPublisherState();
    const { fakeClient, deps } = makeDeps();
    let submitCalls = 0;
    const submitFn = async () => {
      submitCalls += 1;
      const err = new Error("INSUFFICIENT_TX_FEE: fee too low");
      err.code = "INSUFFICIENT_TX_FEE";
      throw err;
    };
    await assert.rejects(
      () =>
        publishValuation(
          fakeClient,
          TOPIC_ID,
          { ...canonicalBullInput(), bullId: "BRAF-T5-NORETRY" },
          canonicalBullResult(),
          { publishedAt: PUBLISHED_AT, baseDelayMs: 1, submitFn, sleepFn: noSleep },
          deps
        )
    );
    assert.strictEqual(submitCalls, 1, "error no-retryable debe hacer 1 solo intento");
  });
});

describe("T5 RF-08 concurrente misma valuationKey no duplica", () => {
  it("segundo concurrente lanza 'en curso' y submitFn sigue en 1", async () => {
    clearPublisherState();
    const { fakeClient, deps } = makeDeps();
    let submitCalls = 0;
    let releaseSubmit;
    const gate = new Promise((resolve) => {
      releaseSubmit = resolve;
    });
    const submitFn = () => {
      submitCalls += 1;
      return gate;
    };
    const bullInput = { ...canonicalBullInput(), bullId: "BRAF-T5-CONC" };
    const opts = {
      publishedAt: PUBLISHED_AT,
      baseDelayMs: 1,
      submitFn,
      sleepFn: noSleep,
    };
    // Primera publicación queda en vuelo (submit pendiente).
    const first = publishValuation(fakeClient, TOPIC_ID, bullInput, canonicalBullResult(), opts, deps);
    // Segunda concurrente con la misma tasación debe ser vetada sin reenviar.
    await assert.rejects(
      () => publishValuation(fakeClient, TOPIC_ID, bullInput, canonicalBullResult(), opts, deps),
      /en curso/i
    );
    // Se libera el vuelo y la primera confirma.
    releaseSubmit({
      sequenceNumber: "9",
      consensusTimestamp: "1729000000.999999999",
      transactionId: "0.0.789@1729000000.999999999",
    });
    const proof = await first;
    assert.strictEqual(proof.sequenceNumber, "9");
    assert.strictEqual(submitCalls, 1, "concurrente no debe lanzar un segundo execute");
  });

  it("tras receipt previo → devuelve prueba original sin reenviar", async () => {
    clearPublisherState();
    const { fakeClient, deps } = makeDeps();
    let submitCalls = 0;
    const submitFn = async () => {
      submitCalls += 1;
      return {
        sequenceNumber: "11",
        consensusTimestamp: "1729000000.111111111",
        transactionId: "0.0.789@1729000000.111111111",
      };
    };
    const bullInput = { ...canonicalBullInput(), bullId: "BRAF-T5-CACHE" };
    const opts = {
      publishedAt: PUBLISHED_AT,
      baseDelayMs: 1,
      submitFn,
      sleepFn: noSleep,
    };
    const first = await publishValuation(fakeClient, TOPIC_ID, bullInput, canonicalBullResult(), opts, deps);
    const second = await publishValuation(fakeClient, TOPIC_ID, bullInput, canonicalBullResult(), opts, deps);
    assert.deepStrictEqual(second, first, "idempotencia: misma prueba original");
    assert.strictEqual(submitCalls, 1, "caché de proof no debe reenviar");
  });
});

describe("T5 unitarios isRetryableError + computeBackoffMs", () => {
  it("clasifica retryables vs no-retryables según plan §1.4", () => {
    const retryable = (message, code) => {
      const err = new Error(message);
      if (code) {
        err.code = code;
      }
      return isRetryableError(err);
    };
    // Retryables: timeout, UNAVAILABLE, TRANSACTION_EXPIRED, fallo getReceipt sin receipt.
    assert.strictEqual(retryable("TIMEOUT: timed out", "TIMEOUT"), true);
    assert.strictEqual(retryable("UNAVAILABLE: upstream down", "UNAVAILABLE"), true);
    assert.strictEqual(retryable("TRANSACTION_EXPIRED: expired", "TRANSACTION_EXPIRED"), true);
    assert.strictEqual(retryable("failed to get receipt: empty", "TIMEOUT"), true);
    assert.strictEqual(
      retryable("registro no confirmado: sin prueba de consenso de la red"),
      true
    );
    // No-retryables: INSUFFICIENT_TX_FEE, credenciales, apto=false, topic inexistente.
    assert.strictEqual(retryable("INSUFFICIENT_TX_FEE: fee", "INSUFFICIENT_TX_FEE"), false);
    assert.strictEqual(retryable("credenciales ausentes"), false);
    assert.strictEqual(retryable("registro rechazado: solo APTOS registrables"), false);
    assert.strictEqual(retryable("topic configurado inexistente"), false);
    assert.strictEqual(retryable("topicId malformado"), false);
  });

  it("backoff exponencial base * 2^attempt + jitter 0..250", () => {
    for (let attempt = 0; attempt <= 3; attempt += 1) {
      const value = computeBackoffMs(attempt, 1000);
      const floor = 1000 * 2 ** attempt;
      assert.ok(
        value >= floor && value <= floor + 250,
        `attempt ${attempt}: ${value} debe estar en [${floor}, ${floor + 250}]`
      );
    }
    // Crecimiento exponencial: mínimo del nivel 1 supera máximo del nivel 0.
    assert.ok(1000 * 2 ** 1 > 1000 * 2 ** 0 + 250);
  });
});
