// Tests T2 spec 004 (RF-01, RF-02, D-02): reglas puras de toro y valuación idempotente.
// Comentarios en español; código en inglés camelCase.
// TDD rojo: src/logic/mirrorRules.js aún no existe → estos tests deben fallar.
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { evaluateBull } = require("../src/logic/evaluateBull.js");
const { buildOracleMessage } = require("../src/logic/oracleMessage.js");
const {
  buildBullRecord,
  buildValuationRecord,
  decideValuationPut,
} = require("../src/logic/mirrorRules.js");

// Toro APTO con bullId y los 11 inputs PEGBraf.
function aptBullInput(overrides = {}) {
  return {
    bullId: "TORO-T2-001",
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
    ...overrides,
  };
}

const PUBLISHED_AT = "2026-10-16T00:00:00.000Z";

describe("T2 RF-01 buildBullRecord guarda 11 inputs PEGBraf más veredicto", () => {
  it("construye el registro de toro con bullId, 11 inputs, apto y tasaciones", () => {
    const input = aptBullInput();
    const result = evaluateBull(input);
    assert.strictEqual(result.apto, true);
    const record = buildBullRecord(input, result);
    assert.strictEqual(record.bullId, "TORO-T2-001");
    // Los 11 inputs PEGBraf presentes con copia exacta.
    assert.strictEqual(record.inputs.pesoNacerDep, -0.5);
    assert.strictEqual(record.inputs.pesoDestateDep, 16.0);
    assert.strictEqual(record.inputs.edadDesteDias, 210);
    assert.strictEqual(record.inputs.pesoFinalDep, 32.0);
    assert.strictEqual(record.inputs.edadPesoFinalDias, 540);
    assert.strictEqual(record.inputs.circunferenciaEscrotalCm, 2.0);
    assert.strictEqual(record.inputs.areaOjoBifeCm2, 3.2);
    assert.strictEqual(record.inputs.grasaIntramuscularTop5, true);
    assert.strictEqual(record.inputs.motilidadSeminalPct, 80);
    assert.strictEqual(record.inputs.volumenEyaculadoMl, 200);
    assert.strictEqual(record.inputs.pajuelasProducidas, 300);
    // Veredicto del motor asociado tal cual.
    assert.strictEqual(record.apto, true);
    assert.ok(Math.abs(record.mTotal - 2.45) < 1e-9);
    assert.strictEqual(record.priceBullUsd, 73500);
    assert.strictEqual(record.priceDoseUsd, 24.5);
  });

  it("lanza ante registro incompleto: el espejo no inventa", () => {
    const input = aptBullInput();
    delete input.motilidadSeminalPct;
    const result = evaluateBull(input);
    assert.strictEqual(result.apto, false);
    assert.throws(() => buildBullRecord(input, result), /incompleto|no inventa|APTO/i);
  });
});

describe("T2 RF-02 buildValuationRecord con valuationKey estable y specVersion 001", () => {
  it("genera valuationKey estable reutilizando la clave del oráculo sin duplicarla", () => {
    const input = aptBullInput();
    const result = evaluateBull(input);
    const record = buildValuationRecord(input, result, { publishedAt: PUBLISHED_AT });
    assert.strictEqual(record.specVersion, "001");
    assert.strictEqual(record.bullId, "TORO-T2-001");
    assert.ok(Math.abs(record.mTotal - 2.45) < 1e-9);
    assert.strictEqual(record.priceBullUsd, 73500);
    assert.strictEqual(record.priceDoseUsd, 24.5);
    // Misma clave determinista que el oráculo existente para los mismos datos.
    const { valuationKey } = buildOracleMessage(input, result, {
      specVersion: "001",
      publishedAt: PUBLISHED_AT,
    });
    assert.strictEqual(record.valuationKey, valuationKey);
    // Estable: segunda construcción idéntica da la misma clave.
    const again = buildValuationRecord(input, result, { publishedAt: PUBLISHED_AT });
    assert.strictEqual(again.valuationKey, record.valuationKey);
  });

  it("CE distinto genera clave distinta: sin colisión natural (1.5 vs 1.6)", () => {
    const base = aptBullInput();
    const input15 = { ...base, circunferenciaEscrotalCm: 1.5 };
    const input16 = { ...base, circunferenciaEscrotalCm: 1.6 };
    const record15 = buildValuationRecord(input15, evaluateBull(input15), {
      publishedAt: PUBLISHED_AT,
    });
    const record16 = buildValuationRecord(input16, evaluateBull(input16), {
      publishedAt: PUBLISHED_AT,
    });
    assert.notStrictEqual(record15.valuationKey, record16.valuationKey);
  });

  it("specVersion 002 lanza: D-02 sin migración en esta spec", () => {
    const input = aptBullInput();
    const result = evaluateBull(input);
    assert.throws(
      () => buildValuationRecord(input, result, { specVersion: "002", publishedAt: PUBLISHED_AT }),
      /spec-version|001/
    );
  });
});

describe("T2 RF-02 decideValuationPut idempotente por valuationKey", () => {
  it("sin existente devuelve inserción", () => {
    const input = aptBullInput();
    const incoming = buildValuationRecord(input, evaluateBull(input), {
      publishedAt: PUBLISHED_AT,
    });
    const out = decideValuationPut(null, incoming);
    assert.strictEqual(out.decision, "insert");
    assert.strictEqual(out.record.valuationKey, incoming.valuationKey);
  });

  it("reintento idéntico devuelve el original con mismo mTotal/precios sin duplicar", () => {
    const input = aptBullInput();
    const first = buildValuationRecord(input, evaluateBull(input), {
      publishedAt: PUBLISHED_AT,
    });
    const retry = buildValuationRecord(input, evaluateBull(input), {
      publishedAt: PUBLISHED_AT,
    });
    const out = decideValuationPut(first, retry);
    assert.strictEqual(out.decision, "return-existing");
    assert.strictEqual(out.record.valuationKey, first.valuationKey);
    assert.strictEqual(out.record.mTotal, first.mTotal);
    assert.strictEqual(out.record.priceBullUsd, first.priceBullUsd);
    assert.strictEqual(out.record.priceDoseUsd, first.priceDoseUsd);
  });

  it("misma clave con input distinto (CE 1.5 vs 1.6) se rechaza: es otra valuación", () => {
    const base = aptBullInput();
    const existing = buildValuationRecord(
      { ...base, circunferenciaEscrotalCm: 1.5 },
      evaluateBull({ ...base, circunferenciaEscrotalCm: 1.5 }),
      { publishedAt: PUBLISHED_AT }
    );
    const incoming = buildValuationRecord(
      { ...base, circunferenciaEscrotalCm: 1.6 },
      evaluateBull({ ...base, circunferenciaEscrotalCm: 1.6 }),
      { publishedAt: PUBLISHED_AT }
    );
    // Reutilización forzada de la clave con contenido distinto: colisión.
    const forged = { ...incoming, valuationKey: existing.valuationKey };
    assert.throws(() => decideValuationPut(existing, forged), /colisi|distinto|otra valuaci/i);
  });
});

// Tests T3 spec 004 (RF-03, RF-04, RF-08): proof, veto de inválido y solo-desde-verdad.
// TDD rojo: mirrorRules.js aún no expone estas decisiones → deben fallar.
const {
  decideProofPut,
  decideListingPut,
  decideProofStatusUpdate,
  decidePurchasePut,
  decidePurchaseSettle,
  toPublicView,
} = require("../src/logic/mirrorRules.js");

// Proof HCS ligada a una valuationKey real del oráculo.
function proofInput(valuationKey, overrides = {}) {
  return {
    valuationKey,
    topicId: "0.0.123456",
    sequenceNumber: 42,
    consensusTimestamp: "1728950000.000000000",
    transactionId: "0.0.999@1728950000.000000000",
    status: "PENDING",
    ...overrides,
  };
}

function valuationKeyFixture() {
  const input = aptBullInput();
  const result = evaluateBull(input);
  return buildValuationRecord(input, result, { publishedAt: PUBLISHED_AT }).valuationKey;
}

describe("T3 RF-03 decideProofPut conserva proof y estado ligado a valuationKey", () => {
  it("guarda topicId, sequenceNumber, consensusTimestamp, transactionId y estado", () => {
    const valuationKey = valuationKeyFixture();
    const incoming = proofInput(valuationKey, { status: "PENDING" });
    const out = decideProofPut(null, incoming, { status: "PENDING" });
    assert.strictEqual(out.decision, "insert");
    assert.strictEqual(out.record.valuationKey, valuationKey);
    assert.strictEqual(out.record.topicId, "0.0.123456");
    assert.strictEqual(out.record.sequenceNumber, 42);
    assert.strictEqual(out.record.consensusTimestamp, "1728950000.000000000");
    assert.strictEqual(out.record.transactionId, "0.0.999@1728950000.000000000");
    assert.strictEqual(out.record.status, "PENDING");
  });

  it("reintento idéntico devuelve el original sin duplicar", () => {
    const valuationKey = valuationKeyFixture();
    const first = proofInput(valuationKey, { status: "PENDING" });
    const saved = decideProofPut(null, first, { status: "PENDING" }).record;
    const out = decideProofPut(saved, first, { status: "PENDING" });
    assert.strictEqual(out.decision, "return-existing");
    assert.strictEqual(out.record.valuationKey, valuationKey);
  });
});

describe("T3 RF-04 veto: MISMATCH forzado y nunca VERIFIED sin verdad", () => {
  it("mTotal 2.45 vs 2.46 reclamado VERIFIED se fuerza a MISMATCH", () => {
    const valuationKey = valuationKeyFixture();
    // La proof reclama VERIFIED pero la verdad dice MISMATCH (2.45 vs 2.46).
    const claimed = proofInput(valuationKey, { status: "VERIFIED" });
    const out = decideProofPut(null, claimed, {
      status: "MISMATCH",
      reason: "content-mismatch",
      diff: ["mTotal"],
    });
    assert.strictEqual(out.record.status, "MISMATCH");
    assert.notStrictEqual(out.record.status, "VERIFIED");
  });

  it("MISMATCH/PENDING nunca habilitan listado ni compra", () => {
    const valuationKey = valuationKeyFixture();
    const listing = { listingId: "LST-T3-001", valuationKey, unitPriceUsd: 24.5, quantity: 10 };
    const blockedMismatch = decideListingPut(null, listing, "MISMATCH");
    const blockedPending = decideListingPut(null, listing, "PENDING");
    assert.strictEqual(blockedMismatch.decision, "block-unverified");
    assert.strictEqual(blockedPending.decision, "block-unverified");
    // VERIFIED sí habilita.
    const allowed = decideListingPut(null, listing, "VERIFIED");
    assert.strictEqual(allowed.decision, "insert");
  });

  it("vista pública marca MISMATCH/PENDING como no verificado, nunca VERIFIED", () => {
    const valuationKey = valuationKeyFixture();
    const record = { valuationKey, mTotal: 2.45 };
    const pendingView = toPublicView(record, proofInput(valuationKey, { status: "PENDING" }));
    const mismatchView = toPublicView(record, proofInput(valuationKey, { status: "MISMATCH" }));
    assert.strictEqual(pendingView.unverified, true);
    assert.strictEqual(mismatchView.unverified, true);
    assert.ok(!String(pendingView.hashscanUrl || "").includes("mainnet"));
    const verifiedView = toPublicView(record, proofInput(valuationKey, { status: "VERIFIED" }));
    assert.strictEqual(verifiedView.unverified, false);
    assert.ok(String(verifiedView.hashscanUrl).includes("testnet"));
  });
});

describe("T3 RF-08 decideProofStatusUpdate solo PENDING→VERIFIED|MISMATCH con verdad", () => {
  it("PENDING→VERIFIED con prueba de verdad conserva proof, valuationKey y txIds", () => {
    const valuationKey = valuationKeyFixture();
    const saved = decideProofPut(null, proofInput(valuationKey, { status: "PENDING" }), {
      status: "PENDING",
    }).record;
    const out = decideProofStatusUpdate(saved, "VERIFIED", { status: "VERIFIED" });
    assert.strictEqual(out.decision, "update-status");
    assert.strictEqual(out.record.status, "VERIFIED");
    assert.strictEqual(out.record.valuationKey, valuationKey);
    assert.strictEqual(out.record.topicId, saved.topicId);
    assert.strictEqual(out.record.sequenceNumber, saved.sequenceNumber);
    assert.strictEqual(out.record.transactionId, saved.transactionId);
  });

  it("PENDING→MISMATCH con prueba de verdad conserva historia", () => {
    const valuationKey = valuationKeyFixture();
    const saved = decideProofPut(null, proofInput(valuationKey, { status: "PENDING" }), {
      status: "PENDING",
    }).record;
    const out = decideProofStatusUpdate(saved, "MISMATCH", {
      status: "MISMATCH",
      diff: ["mTotal"],
    });
    assert.strictEqual(out.decision, "update-status");
    assert.strictEqual(out.record.status, "MISMATCH");
    assert.strictEqual(out.record.valuationKey, valuationKey);
    assert.strictEqual(out.record.transactionId, saved.transactionId);
  });

  it("autopromoción sin prueba lanza: el espejo no se autoverifica", () => {
    const valuationKey = valuationKeyFixture();
    const saved = decideProofPut(null, proofInput(valuationKey, { status: "PENDING" }), {
      status: "PENDING",
    }).record;
    assert.throws(() => decideProofStatusUpdate(saved, "VERIFIED", { status: "PENDING" }), /autoverifica|prueba|verdad/i);
    assert.throws(() => decideProofStatusUpdate(saved, "VERIFIED", null), /autoverifica|prueba|verdad/i);
  });

  it("VERIFIED o MISMATCH ya finales no transicionan", () => {
    const valuationKey = valuationKeyFixture();
    const verified = decideProofPut(null, proofInput(valuationKey, { status: "VERIFIED" }), {
      status: "VERIFIED",
    }).record;
    assert.throws(
      () => decideProofStatusUpdate(verified, "MISMATCH", { status: "MISMATCH" }),
      /solo PENDING|final/i
    );
  });
});

// Tests T4 spec 004 (RF-05, RF-06, RF-07): movimientos, idempotencia de compra y vista pública.
// TDD rojo: decidePurchasePut/decidePurchaseSettle aún no existen → deben fallar.

// Movimiento del marketplace ya ejecutado: el espejo solo refleja splits/txIds, sin recalcular.
function movementInput(valuationKey, overrides = {}) {
  return {
    listingId: "LST-T4-001",
    purchaseId: "PUR-T4-001",
    valuationKey,
    assetType: "PAJ_BRAF",
    unitPriceUsd: 24.5,
    quantity: 10,
    royaltyPct: 5,
    royaltyUsd: 12.25,
    sellerUsd: 232.75,
    totalUsd: 245,
    purchaseTxId: "0.0.999@1728950000.000000000",
    settlementTxId: null,
    settled: false,
    ...overrides,
  };
}

describe("T4 RF-05 decidePurchasePut refleja movimientos ligados a valuationKey", () => {
  it("guarda listingId, purchaseId, royaltyPct, splits y txIds sin recalcular", () => {
    const valuationKey = valuationKeyFixture();
    const incoming = movementInput(valuationKey);
    const out = decidePurchasePut(null, incoming);
    assert.strictEqual(out.decision, "insert");
    assert.strictEqual(out.record.listingId, "LST-T4-001");
    assert.strictEqual(out.record.purchaseId, "PUR-T4-001");
    assert.strictEqual(out.record.valuationKey, valuationKey);
    assert.strictEqual(out.record.royaltyPct, 5);
    assert.strictEqual(out.record.royaltyUsd, 12.25);
    assert.strictEqual(out.record.sellerUsd, 232.75);
    assert.strictEqual(out.record.totalUsd, 245);
    assert.strictEqual(out.record.purchaseTxId, "0.0.999@1728950000.000000000");
  });

  it("regalías 0% y 100% se reflejan tal cual con $0 explícito", () => {
    const valuationKey = valuationKeyFixture();
    const zero = decidePurchasePut(
      null,
      movementInput(valuationKey, {
        purchaseId: "PUR-T4-ZERO",
        royaltyPct: 0,
        royaltyUsd: 0,
        sellerUsd: 245,
      })
    );
    assert.strictEqual(zero.record.royaltyPct, 0);
    assert.strictEqual(zero.record.royaltyUsd, 0);
    assert.strictEqual(zero.record.sellerUsd, 245);
    const full = decidePurchasePut(
      null,
      movementInput(valuationKey, {
        purchaseId: "PUR-T4-FULL",
        royaltyPct: 100,
        royaltyUsd: 245,
        sellerUsd: 0,
      })
    );
    assert.strictEqual(full.record.royaltyPct, 100);
    assert.strictEqual(full.record.royaltyUsd, 245);
    assert.strictEqual(full.record.sellerUsd, 0);
  });

  it("lanza ante registro incompleto: el espejo no inventa", () => {
    const valuationKey = valuationKeyFixture();
    const broken = movementInput(valuationKey);
    delete broken.purchaseId;
    assert.throws(() => decidePurchasePut(null, broken), /incompleto|no inventa|purchaseId/i);
  });
});

describe("T4 RF-06 decidePurchasePut idempotente por purchaseId", () => {
  it("mismo purchaseId idéntico devuelve el original sin reacreditar", () => {
    const valuationKey = valuationKeyFixture();
    const first = movementInput(valuationKey);
    const saved = decidePurchasePut(null, first).record;
    const out = decidePurchasePut(saved, movementInput(valuationKey));
    assert.strictEqual(out.decision, "return-existing");
    assert.strictEqual(out.record.purchaseId, "PUR-T4-001");
    assert.strictEqual(out.record.royaltyUsd, 12.25);
    assert.strictEqual(out.record.sellerUsd, 232.75);
  });

  it("purchaseId reutilizado con importes distintos lanza", () => {
    const valuationKey = valuationKeyFixture();
    const saved = decidePurchasePut(null, movementInput(valuationKey)).record;
    const forged = movementInput(valuationKey, { totalUsd: 250, royaltyUsd: 12.5, sellerUsd: 237.5 });
    assert.throws(() => decidePurchasePut(saved, forged), /distinto|reutilizado|otra compra/i);
  });
});

describe("T4 RF-06/RF-08 decidePurchaseSettle sin segunda liquidación", () => {
  it("liquida una vez conservando splits y txIds, y el segundo settle lanza", () => {
    const valuationKey = valuationKeyFixture();
    const saved = decidePurchasePut(null, movementInput(valuationKey)).record;
    const settled = decidePurchaseSettle(saved, "0.0.999@1728950001.000000001").record;
    assert.strictEqual(settled.settled, true);
    assert.strictEqual(settled.settlementTxId, "0.0.999@1728950001.000000001");
    assert.strictEqual(settled.purchaseId, "PUR-T4-001");
    assert.strictEqual(settled.royaltyUsd, 12.25);
    assert.strictEqual(settled.sellerUsd, 232.75);
    assert.throws(
      () => decidePurchaseSettle(settled, "0.0.999@1728950002.000000002"),
      /doble|ya liquidado|segunda/i
    );
  });

  it("reintento de compra ya liquidada con importes distintos lanza sin reacreditar", () => {
    const valuationKey = valuationKeyFixture();
    const saved = decidePurchasePut(null, movementInput(valuationKey)).record;
    const settled = decidePurchaseSettle(saved, "0.0.999@1728950001.000000001").record;
    const forged = movementInput(valuationKey, {
      totalUsd: 250,
      royaltyUsd: 12.5,
      sellerUsd: 237.5,
      settled: true,
    });
    assert.throws(() => decidePurchasePut(settled, forged), /distinto|reutilizado|doble|otra compra/i);
  });
});

describe("T4 RF-07 vista pública de movimientos con referencia o ausencia explícita", () => {
  it("movimiento con proof y tx adjunta referencia Testnet", () => {
    const valuationKey = valuationKeyFixture();
    const movement = decidePurchasePut(null, movementInput(valuationKey)).record;
    const view = toPublicView(movement, proofInput(valuationKey, { status: "VERIFIED" }));
    assert.ok(String(view.mirrorUrl).includes("testnet.mirrornode.hedera.com"));
    assert.ok(String(view.hashscanUrl).includes("hashscan.io/testnet"));
    assert.strictEqual(view.unverified, false);
  });

  it("movimiento sin referencia declara ausencia explícita sin inventar", () => {
    const valuationKey = valuationKeyFixture();
    const movement = movementInput(valuationKey, { purchaseTxId: null });
    const view = toPublicView(movement, null);
    assert.strictEqual(view.mirrorUrl, null);
    assert.strictEqual(view.hashscanUrl, null);
    assert.strictEqual(view.unverified, true);
  });
});
