// Tests T2 (Spec 005): lógica pura de allowance HTS (RF-06, RF-11).
// Comentarios en español; código en inglés. TDD: rojo antes de implementar.
// Sin SDK, sin red, sin process.env: solo lógica pura de unidades base (RNF-01).
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  toBaseUnits,
  calculateRequiredAllowance,
  validateAllowanceState,
} = require("../src/logic/allowance.js");

describe("T2 RF-06 toBaseUnits: conversión sin pérdida a unidades base", () => {
  it("0 decimales: 300 pajuelas → 300 unidades base", () => {
    assert.equal(toBaseUnits(300, 0), 300n);
  });

  it("0 decimales: 10 pajuelas → 10 unidades base", () => {
    assert.equal(toBaseUnits(10, 0), 10n);
  });

  it("4 decimales: 1 BULL → 10000 unidades base", () => {
    assert.equal(toBaseUnits(1, 4), 10000n);
  });

  it("4 decimales: 10 BULL → 100000 unidades base", () => {
    assert.equal(toBaseUnits(10, 4), 100000n);
  });

  it("4 decimales: 0.0001 BULL → 1 unidad base (borde mínimo)", () => {
    assert.equal(toBaseUnits(0.0001, 4), 1n);
  });

  it("amount 0 devuelve 0n en cualquier decimal", () => {
    assert.equal(toBaseUnits(0, 0), 0n);
    assert.equal(toBaseUnits(0, 4), 0n);
  });

  it("devuelve bigint (no number) para cantidades grandes sin pérdida", () => {
    const result = toBaseUnits(73500, 4);
    assert.equal(typeof result, "bigint");
    assert.equal(result, 735000000n);
  });

  it("rechaza amount negativo", () => {
    assert.throws(() => toBaseUnits(-1, 4), /amount/);
  });

  it("rechaza amount no finito", () => {
    assert.throws(() => toBaseUnits(Number.NaN, 4), /amount/);
  });

  it("rechaza decimals negativo", () => {
    assert.throws(() => toBaseUnits(1, -1), /decimals/);
  });

  it("rechaza decimals no entero", () => {
    assert.throws(() => toBaseUnits(1, 1.5), /decimals/);
  });
});

describe("T2 RF-06 calculateRequiredAllowance: decimales por activo", () => {
  it("PAJ_BRAF con 0 decimales: 10 pajuelas → 10 unidades base", () => {
    assert.equal(calculateRequiredAllowance("PAJ_BRAF", 10, 0), 10n);
  });

  it("BULL con 4 decimales: 0.0001 → 1 unidad base", () => {
    assert.equal(calculateRequiredAllowance("BULL", 0.0001, 4), 1n);
  });

  it("BULL con 4 decimales: 10 → 100000 unidades base", () => {
    assert.equal(calculateRequiredAllowance("BULL", 10, 4), 100000n);
  });

  it("PAJ_BRAF con 4 decimales (discrepancia) lanza", () => {
    assert.throws(
      () => calculateRequiredAllowance("PAJ_BRAF", 10, 4),
      /decimales no coinciden con el activo/
    );
  });

  it("BULL con 0 decimales (discrepancia) lanza", () => {
    assert.throws(
      () => calculateRequiredAllowance("BULL", 10, 0),
      /decimales no coinciden con el activo/
    );
  });
});

describe("T2 RF-06/RF-11 validateAllowanceState: suficiente vs. insuficiente/revocada", () => {
  function allowanceState(overrides = {}) {
    return {
      spender: "0.0.999999",
      tokenId: "0.0.111111",
      amountBaseUnits: 100000n,
      ...overrides,
    };
  }

  it("allowance suficiente devuelve { ok: true }", () => {
    const result = validateAllowanceState(allowanceState(), 10n);
    assert.deepEqual(result, { ok: true });
  });

  it("borde: cantidad exactamente igual a la allowance es válida", () => {
    const result = validateAllowanceState(allowanceState({ amountBaseUnits: 10n }), 10n);
    assert.deepEqual(result, { ok: true });
  });

  it("allowance ausente (no objeto) lanza", () => {
    assert.throws(() => validateAllowanceState(null, 10n), /allowance ausente/);
    assert.throws(() => validateAllowanceState(undefined, 10n), /allowance ausente/);
  });

  it("allowance insuficiente lanza (9 < 10)", () => {
    assert.throws(
      () => validateAllowanceState(allowanceState({ amountBaseUnits: 9n }), 10n),
      /allowance insuficiente/
    );
  });

  it("allowance revocada (0 unidades) lanza", () => {
    assert.throws(
      () => validateAllowanceState(allowanceState({ amountBaseUnits: 0n }), 1n),
      /allowance insuficiente/
    );
  });

  it("spender vacío lanza allowance inválida", () => {
    assert.throws(
      () => validateAllowanceState(allowanceState({ spender: "" }), 10n),
      /allowance inválida/
    );
  });

  it("tokenId vacío lanza allowance inválida", () => {
    assert.throws(
      () => validateAllowanceState(allowanceState({ tokenId: "  " }), 10n),
      /allowance inválida/
    );
  });

  it("acepta amountBaseUnits como number convertible", () => {
    const result = validateAllowanceState(allowanceState({ amountBaseUnits: 100000 }), 100000n);
    assert.deepEqual(result, { ok: true });
  });

  // NB-1: un monto no convertible debe dar error de dominio, nunca un TypeError crudo.
  it("NB-1: amountBaseUnits undefined lanza error de dominio (no TypeError)", () => {
    assert.throws(
      () => validateAllowanceState(allowanceState({ amountBaseUnits: undefined }), 10n),
      (err) => err instanceof Error && !(err instanceof TypeError) && /allowance/.test(err.message)
    );
  });

  it("NB-1: amountBaseUnits null lanza error de dominio (no TypeError)", () => {
    assert.throws(
      () => validateAllowanceState(allowanceState({ amountBaseUnits: null }), 10n),
      (err) => err instanceof Error && !(err instanceof TypeError) && /allowance/.test(err.message)
    );
  });

  it("NB-1: amountBaseUnits no numérico (string) lanza error de dominio", () => {
    assert.throws(
      () => validateAllowanceState(allowanceState({ amountBaseUnits: "mucho" }), 10n),
      (err) => err instanceof Error && !(err instanceof TypeError) && /allowance/.test(err.message)
    );
  });
});
