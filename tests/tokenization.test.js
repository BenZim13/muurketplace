// Tests T1 (Spec 005): lógica pura de tokenización HTS (RF-01, RF-02, RF-03).
// Comentarios en español; código en inglés. TDD: rojo antes de implementar.
// Sin SDK, sin red, sin process.env: solo lógica pura (RNF-01).
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  validateTokenizationParams,
  normalizeBullSupply,
  composeTokenizationResult,
} = require("../src/logic/tokenization.js");

// Tasación certificada EA-01 (Spec 001): M_TOTAL 2.45 → toro $73,500 / dosis $24.50.
const certifiedValuation = {
  mTotal: 2.45,
  tasacionToroUsd: 73500,
  tasacionDosisUsd: 24.5,
};

// Proof canónica de la Spec 002 en estado VERIFIED (referencia de consenso).
const verifiedProof = {
  topicId: "0.0.123456",
  sequenceNumber: 1,
  consensusTimestamp: "2026-10-16T00:00:00.000Z",
  transactionId: "0.0.123456@1.2",
};

// Parámetros base de tokenización (lote completo de 300 pajuelas y 10 BULL).
function baseParams(overrides = {}) {
  return {
    bullId: "BRAF-001",
    pajuelaCount: 300,
    bullSupply: 10,
    cabanaAccountId: "0.0.111111",
    contractId: "0.0.999999",
    ...overrides,
  };
}

describe("T1 RF-01/RF-02 validateTokenizationParams: entrada válida", () => {
  it("acepta la tokenización canónica y devuelve el objeto normalizado", () => {
    const { tokenization } = validateTokenizationParams(
      baseParams(),
      certifiedValuation,
      verifiedProof
    );
    assert.equal(tokenization.bullId, "BRAF-001");
    assert.equal(tokenization.pajuelaCount, 300);
    assert.equal(tokenization.bullSupply, 10);
    assert.equal(tokenization.cabanaAccountId, "0.0.111111");
    assert.equal(tokenization.contractId, "0.0.999999");
  });

  it("RF-02: normaliza bullSupply por defecto a 10 cuando no viene", () => {
    const params = baseParams();
    delete params.bullSupply;
    const { tokenization } = validateTokenizationParams(params, certifiedValuation, verifiedProof);
    assert.equal(tokenization.bullSupply, 10);
  });
});

describe("T1 RF-03 precondición transversal: solo APTO (001) + VERIFIED (002)", () => {
  it("rechaza sin veredicto APTO (tasación certificada ausente)", () => {
    assert.throws(
      () => validateTokenizationParams(baseParams(), null, verifiedProof),
      /APTO/
    );
  });

  it("rechaza si la tasación certificada no trae mTotal/tasaciones", () => {
    assert.throws(
      () => validateTokenizationParams(baseParams(), { mTotal: 2.45 }, verifiedProof),
      /APTO/
    );
  });

  it("rechaza sin proof VERIFIED (proof sin topicId)", () => {
    assert.throws(
      () => validateTokenizationParams(baseParams(), certifiedValuation, { sequenceNumber: 1 }),
      /VERIFIED/
    );
  });

  it("rechaza si no hay proof", () => {
    assert.throws(
      () => validateTokenizationParams(baseParams(), certifiedValuation, null),
      /VERIFIED/
    );
  });
});

describe("T1 RF-01/RF-02 rechazos de parámetros", () => {
  it("rechaza bullId vacío", () => {
    assert.throws(
      () => validateTokenizationParams(baseParams({ bullId: "  " }), certifiedValuation, verifiedProof),
      /bullId/
    );
  });

  it("RF-01: rechaza pajuelaCount no entero", () => {
    assert.throws(
      () => validateTokenizationParams(baseParams({ pajuelaCount: 1.5 }), certifiedValuation, verifiedProof),
      /pajuelaCount/
    );
  });

  it("RF-01: rechaza pajuelaCount <= 0", () => {
    assert.throws(
      () => validateTokenizationParams(baseParams({ pajuelaCount: 0 }), certifiedValuation, verifiedProof),
      /pajuelaCount/
    );
  });

  it("rechaza cabanaAccountId vacío", () => {
    assert.throws(
      () =>
        validateTokenizationParams(baseParams({ cabanaAccountId: "" }), certifiedValuation, verifiedProof),
      /cabanaAccountId/
    );
  });
});

describe("T1 RF-02 normalizeBullSupply: 1..10 y por defecto 10", () => {
  it("undefined devuelve 10 (por defecto)", () => {
    assert.equal(normalizeBullSupply(undefined), 10);
  });

  it("acepta el límite inferior 1", () => {
    assert.equal(normalizeBullSupply(1), 1);
  });

  it("acepta el límite superior 10", () => {
    assert.equal(normalizeBullSupply(10), 10);
  });

  it("rechaza 0 por debajo del rango", () => {
    assert.throws(() => normalizeBullSupply(0), /bullSupply/);
  });

  it("rechaza 11 por encima del rango", () => {
    assert.throws(() => normalizeBullSupply(11), /bullSupply/);
  });

  it("rechaza valores no enteros", () => {
    assert.throws(() => normalizeBullSupply(1.5), /bullSupply/);
  });

  it("rechaza valores no numéricos", () => {
    assert.throws(() => normalizeBullSupply("10"), /bullSupply/);
  });
});

describe("T1 RF-01/RF-02 composeTokenizationResult: salida de tokenización", () => {
  it("compone txIds y hashscanUrls del par de tokens", () => {
    const result = composeTokenizationResult({
      pajBrafTokenId: "0.0.111111",
      bullTokenId: "0.0.777777",
      bullSupply: 10,
      pajBrafTxId: "0.0.111111@1.1",
      bullTxId: "0.0.777777@1.2",
    });
    assert.equal(result.pajBrafTokenId, "0.0.111111");
    assert.equal(result.bullTokenId, "0.0.777777");
    assert.equal(result.bullSupply, 10);
    assert.deepEqual(result.txIds, {
      pajBraf: "0.0.111111@1.1",
      bull: "0.0.777777@1.2",
    });
    assert.ok(result.hashscanUrls.pajBraf.includes("hashscan.io/testnet/token/"));
    assert.ok(result.hashscanUrls.pajBraf.includes("0.0.111111"));
    assert.ok(result.hashscanUrls.bull.includes("hashscan.io/testnet/token/"));
    assert.ok(result.hashscanUrls.bull.includes("0.0.777777"));
  });

  it("no incluye txIds de allowance (pertenecen a RF-06)", () => {
    const result = composeTokenizationResult({
      pajBrafTokenId: "0.0.111111",
      bullTokenId: "0.0.777777",
      bullSupply: 10,
      pajBrafTxId: "0.0.111111@1.1",
      bullTxId: "0.0.777777@1.2",
    });
    assert.equal(result.allowanceTxId, undefined);
    assert.equal(result.txIds.allowance, undefined);
    assert.equal(result.txIds.allowanceTxId, undefined);
    assert.equal(Object.keys(result.txIds).length, 2);
  });

  it("rechaza si falta el tokenId de PAJ-BRAF", () => {
    assert.throws(
      () =>
        composeTokenizationResult({
          bullTokenId: "0.0.777777",
          bullSupply: 10,
          bullTxId: "0.0.777777@1.2",
        }),
      /pajBrafTokenId/
    );
  });
});
