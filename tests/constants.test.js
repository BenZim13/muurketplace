// Test humo T1: verifica esqueleto constants + stubs (sin RF).
// Comentarios en español; código en inglés.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("T1 esqueleto constants + stubs", () => {
  it("los 4 modulos se pueden requerir sin lanzar", () => {
    assert.doesNotThrow(() => require("../src/logic/constants.js"));
    assert.doesNotThrow(() => require("../src/logic/validator.js"));
    assert.doesNotThrow(() => require("../src/logic/pricing.js"));
    assert.doesNotThrow(() => require("../src/logic/evaluateBull.js"));
  });

  it("expone valores base 30000 y 10", () => {
    const c = require("../src/logic/constants.js");
    assert.strictEqual(c.VALOR_BASE_TORO_USD, 30000);
    assert.strictEqual(c.VALOR_BASE_DOSIS_USD, 10);
  });

  it("expone umbrales PEGBraf esperados", () => {
    const c = require("../src/logic/constants.js");
    assert.strictEqual(c.EDAD_DESTETE_MIN_DIAS, 100);
    assert.strictEqual(c.EDAD_DESTETE_MAX_DIAS, 300);
    assert.strictEqual(c.EDAD_FINAL_MIN_DIAS, 450);
    assert.strictEqual(c.EDAD_FINAL_MAX_DIAS, 730);
    assert.strictEqual(c.CE_MIN_CM, 1.5);
    assert.strictEqual(c.MOTILIDAD_MIN_PCT, 70);
    assert.strictEqual(c.PESO_NACER_MAX_DEP, 0.0);
    assert.strictEqual(c.PESO_DESTETE_MIN_DEP, 15.0);
    assert.strictEqual(c.PESO_FINAL_MIN_DEP, 30.0);
    assert.strictEqual(c.AOB_INTERMEDIA_MIN_CM2, 2.0);
    assert.strictEqual(c.AOB_PREMIUM_MIN_CM2, 3.0);
  });

  it("expone bonos aditivos esperados", () => {
    const c = require("../src/logic/constants.js");
    assert.strictEqual(c.BONUS_FACILIDAD_PARTO, 0.5);
    assert.strictEqual(c.BONUS_CRECIMIENTO, 0.15);
    assert.strictEqual(c.BONUS_AOB_PREMIUM, 0.5);
    assert.strictEqual(c.BONUS_AOB_INTERMEDIA, 0.2);
    assert.strictEqual(c.BONUS_MARMOLEADO, 0.3);
  });

  it("constantes estan congeladas con Object.freeze", () => {
    const c = require("../src/logic/constants.js");
    assert.strictEqual(Object.isFrozen(c), true);
  });

  it("stubs restantes lanzan Error no implementado (pricing T6: tasación ya implementada; evaluateBull parcial T3)", () => {
    const { calculateMTotal, calculateBullPrice, calculateDosePrice, roundHalfUp2 } = require("../src/logic/pricing.js");
    assert.doesNotThrow(() => calculateMTotal({
      pesoNacerDep: 0.01,
      pesoDestateDep: 10.0,
      pesoFinalDep: 20.0,
      areaOjoBifeCm2: 1.99,
      grasaIntramuscularTop5: false,
    }));
    // T6: tasación RF-14/RF-15 implementada — ya no lanzan, devuelven valores.
    assert.strictEqual(calculateBullPrice(1.0), 30000);
    assert.strictEqual(calculateDosePrice(1.0), 10);
    assert.strictEqual(roundHalfUp2(1.0), 1);
    // T3: evaluateBull ya no es stub puro — con {} (todo ausente) devuelve
    // rechazo triple-null según RF-06 en vez de lanzar.
    const { evaluateBull } = require("../src/logic/evaluateBull.js");
    const r = evaluateBull({});
    assert.strictEqual(r.apto, false);
    assert.strictEqual(r.mTotal, null);
    assert.strictEqual(r.tasacionToroUsd, null);
    assert.strictEqual(r.tasacionDosisUsd, null);
  });
});
