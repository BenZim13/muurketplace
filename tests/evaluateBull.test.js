// Tests T3 (RF-06 parcial fachada): rechazo total vía evaluateBull → triple-null.
// Comentarios en español; código en inglés.
// TDD: este test debe fallar en rojo con el stub actual (lanza "no implementado").
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { evaluateBull } = require("../src/logic/evaluateBull.js");

// Toro canónico APTO (mismo que validator.test.js).
function aptBull(overrides = {}) {
  return {
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

describe("T3 RF-06 evaluateBull triple-null sin tasación parcial", () => {
  it("barrera fallida (edad 99) → triple-null con motivos", () => {
    const r = evaluateBull(aptBull({ edadDesteDias: 99 }));
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 1);
    assert.strictEqual(r.mTotal, null);
    assert.strictEqual(r.tasacionToroUsd, null);
    assert.strictEqual(r.tasacionDosisUsd, null);
  });

  it("campo ausente (motilidad undefined) → triple-null con motivo explícito", () => {
    const input = aptBull();
    delete input.motilidadSeminalPct;
    const r = evaluateBull(input);
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.some((m) => m.includes("campo ausente: motilidadSeminalPct")));
    assert.strictEqual(r.mTotal, null);
    assert.strictEqual(r.tasacionToroUsd, null);
    assert.strictEqual(r.tasacionDosisUsd, null);
  });

  it("multi-barrera simultánea → todos los motivos y triple-null", () => {
    const r = evaluateBull(
      aptBull({ edadDesteDias: 99, motilidadSeminalPct: 69 })
    );
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 2);
    assert.strictEqual(r.mTotal, null);
    assert.strictEqual(r.tasacionToroUsd, null);
    assert.strictEqual(r.tasacionDosisUsd, null);
  });
});

// Tests T7 (RF-16 + EA-01): fachada completa APTO y caso canónico 2.45.
// TDD rojo: la rama APTO de evaluateBull aún lanza "no implementado".
describe("T7 RF-16 salida APTO + EA-01 canónico 2.45", () => {
  // Entrada canónica EA-01 con los 9 campos de referencia.
  function canonicalBull() {
    return {
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

  it("toro APTO → salida completa non-null con motivos [] (RF-16)", () => {
    const r = evaluateBull(canonicalBull());
    assert.strictEqual(r.apto, true);
    assert.deepStrictEqual(r.motivosRechazo, []);
    assert.ok(r.mTotal !== null && r.mTotal !== undefined);
    assert.ok(r.tasacionToroUsd !== null && r.tasacionToroUsd !== undefined);
    assert.ok(r.tasacionDosisUsd !== null && r.tasacionDosisUsd !== undefined);
  });

  it("rechazo vía fachada → triple-null sin tasación parcial (RF-06)", () => {
    const r = evaluateBull(canonicalBull());
    delete r.mTotal;
    const bad = evaluateBull({ ...canonicalBull(), edadDesteDias: 99 });
    assert.strictEqual(bad.apto, false);
    assert.strictEqual(bad.mTotal, null);
    assert.strictEqual(bad.tasacionToroUsd, null);
    assert.strictEqual(bad.tasacionDosisUsd, null);
    assert.ok(bad.motivosRechazo.length >= 1);
  });

  it("EA-01 canónico → 1.0+0.50+0.15+0.50+0.30=2.45, $73500 / $24.50", () => {
    const r = evaluateBull(canonicalBull());
    assert.strictEqual(r.apto, true);
    // mTotal con tolerancia 1e-9 por representación binaria (riesgo R-01).
    assert.ok(Math.abs(r.mTotal - 2.45) < 1e-9);
    // Enteros y dosis con igualdad estricta.
    assert.strictEqual(r.tasacionToroUsd, 73500);
    assert.strictEqual(r.tasacionDosisUsd, 24.5);
    // Resto del contrato con deepStrictEqual (mTotal aparte por tolerancia).
    assert.deepStrictEqual(
      {
        apto: r.apto,
        motivosRechazo: r.motivosRechazo,
        tasacionToroUsd: r.tasacionToroUsd,
        tasacionDosisUsd: r.tasacionDosisUsd,
      },
      {
        apto: true,
        motivosRechazo: [],
        tasacionToroUsd: 73500,
        tasacionDosisUsd: 24.5,
      }
    );
  });
});
