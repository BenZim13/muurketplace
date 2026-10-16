// Tests T2: barreras inclusivas RF-02 a RF-05 + RF-07 (validator.js).
// Comentarios en español; código en inglés.
// TDD: este test debe fallar en rojo antes de implementar validator.js.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { validateBull } = require("../src/logic/validator.js");

// Toro canónico APTO: resto de inputs que superan las 4 barreras.
// (Campos 10-11 informativos incluidos para realismo, el validador los ignora.)
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

describe("T2 RF-02 edad destete 100-300 inclusivo", () => {
  it("rechaza 99 (justo-fuera inferior)", () => {
    const r = validateBull(aptBull({ edadDesteDias: 99 }));
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 1);
  });

  it("acepta 100 (borde inferior inclusivo)", () => {
    const r = validateBull(aptBull({ edadDesteDias: 100 }));
    assert.strictEqual(r.apto, true);
    assert.deepStrictEqual(r.motivosRechazo, []);
  });

  it("acepta 300 (borde superior inclusivo)", () => {
    const r = validateBull(aptBull({ edadDesteDias: 300 }));
    assert.strictEqual(r.apto, true);
    assert.deepStrictEqual(r.motivosRechazo, []);
  });

  it("rechaza 301 (justo-fuera superior)", () => {
    const r = validateBull(aptBull({ edadDesteDias: 301 }));
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 1);
  });
});

describe("T2 RF-03 edad final 450-730 inclusivo", () => {
  it("rechaza 449 (justo-fuera inferior)", () => {
    const r = validateBull(aptBull({ edadPesoFinalDias: 449 }));
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 1);
  });

  it("acepta 450 (borde inferior inclusivo)", () => {
    const r = validateBull(aptBull({ edadPesoFinalDias: 450 }));
    assert.strictEqual(r.apto, true);
    assert.deepStrictEqual(r.motivosRechazo, []);
  });

  it("acepta 730 (borde superior inclusivo)", () => {
    const r = validateBull(aptBull({ edadPesoFinalDias: 730 }));
    assert.strictEqual(r.apto, true);
    assert.deepStrictEqual(r.motivosRechazo, []);
  });

  it("rechaza 731 (justo-fuera superior)", () => {
    const r = validateBull(aptBull({ edadPesoFinalDias: 731 }));
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 1);
  });
});

describe("T2 RF-04 CE >= 1.5 inclusivo", () => {
  it("rechaza 1.49 (justo-fuera)", () => {
    const r = validateBull(aptBull({ circunferenciaEscrotalCm: 1.49 }));
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 1);
  });

  it("acepta 1.5 (borde inclusivo)", () => {
    const r = validateBull(aptBull({ circunferenciaEscrotalCm: 1.5 }));
    assert.strictEqual(r.apto, true);
    assert.deepStrictEqual(r.motivosRechazo, []);
  });
});

describe("T2 RF-05 motilidad >= 70 inclusivo", () => {
  it("rechaza 69 (justo-fuera)", () => {
    const r = validateBull(aptBull({ motilidadSeminalPct: 69 }));
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 1);
  });

  it("acepta 70 (borde inclusivo)", () => {
    const r = validateBull(aptBull({ motilidadSeminalPct: 70 }));
    assert.strictEqual(r.apto, true);
    assert.deepStrictEqual(r.motivosRechazo, []);
  });
});

describe("T2 RF-07 bordes inclusivos simultáneos + acumulación sin cortocircuito", () => {
  it("APTO con todos los umbrales mínimos a la vez (100+450+1.5+70)", () => {
    const r = validateBull(
      aptBull({
        edadDesteDias: 100,
        edadPesoFinalDias: 450,
        circunferenciaEscrotalCm: 1.5,
        motilidadSeminalPct: 70,
      })
    );
    assert.strictEqual(r.apto, true);
    assert.deepStrictEqual(r.motivosRechazo, []);
  });

  it("APTO con todos los umbrales máximos a la vez (300+730+CE alta+motilidad alta)", () => {
    const r = validateBull(
      aptBull({
        edadDesteDias: 300,
        edadPesoFinalDias: 730,
        circunferenciaEscrotalCm: 2.0,
        motilidadSeminalPct: 100,
      })
    );
    assert.strictEqual(r.apto, true);
    assert.deepStrictEqual(r.motivosRechazo, []);
  });

  it("acumula todos los motivos sin cortocircuito (multi-barrera)", () => {
    const r = validateBull(
      aptBull({
        edadDesteDias: 99,
        edadPesoFinalDias: 731,
        circunferenciaEscrotalCm: 1.49,
        motilidadSeminalPct: 69,
      })
    );
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 2);
    assert.strictEqual(r.motivosRechazo.length, 4);
  });
});

// Tests T3 RF-06: rechazo total (ausentes con === null/undefined, inválidos físicos).
// 9 campos requeridos 1–9; físicamente imposibles solo si el campo existe.
describe("T3 RF-06 campos ausentes (9 requeridos, nunca falsy)", () => {
  const requiredFields = [
    "pesoNacerDep",
    "pesoDestateDep",
    "edadDesteDias",
    "pesoFinalDep",
    "edadPesoFinalDias",
    "circunferenciaEscrotalCm",
    "areaOjoBifeCm2",
    "grasaIntramuscularTop5",
    "motilidadSeminalPct",
  ];

  for (const field of requiredFields) {
    it(`rechaza con motivo explícito si falta ${field} (undefined)`, () => {
      const input = aptBull();
      delete input[field];
      const r = validateBull(input);
      assert.strictEqual(r.apto, false);
      assert.ok(
        r.motivosRechazo.some((m) => m.includes(`campo ausente: ${field}`)),
        `esperaba motivo "campo ausente: ${field}" en ${JSON.stringify(r.motivosRechazo)}`
      );
    });

    it(`rechaza con motivo explícito si ${field} es null`, () => {
      const r = validateBull(aptBull({ [field]: null }));
      assert.strictEqual(r.apto, false);
      assert.ok(
        r.motivosRechazo.some((m) => m.includes(`campo ausente: ${field}`)),
        `esperaba motivo "campo ausente: ${field}" en ${JSON.stringify(r.motivosRechazo)}`
      );
    });
  }

  it("no trata 0 falsy como ausente (pesoNacerDep = 0 es válido y presente)", () => {
    const r = validateBull(aptBull({ pesoNacerDep: 0 }));
    // 0 no debe generar motivo de ausencia para pesoNacerDep.
    assert.ok(
      !r.motivosRechazo.some((m) => m.includes("campo ausente: pesoNacerDep")),
      `0 no es ausente: ${JSON.stringify(r.motivosRechazo)}`
    );
  });

  it("no trata false falsy como ausente (grasaIntramuscularTop5 = false es válido)", () => {
    const r = validateBull(aptBull({ grasaIntramuscularTop5: false }));
    assert.ok(
      !r.motivosRechazo.some((m) => m.includes("campo ausente: grasaIntramuscularTop5")),
      `false no es ausente: ${JSON.stringify(r.motivosRechazo)}`
    );
  });
});

describe("T3 RF-06 inválidos físicamente imposibles (solo si existe)", () => {
  it("rechaza edad destete <= 0", () => {
    for (const v of [0, -5]) {
      const r = validateBull(aptBull({ edadDesteDias: v }));
      assert.strictEqual(r.apto, false);
      assert.ok(r.motivosRechazo.length >= 1);
    }
  });

  it("rechaza edad final <= 0", () => {
    for (const v of [0, -10]) {
      const r = validateBull(aptBull({ edadPesoFinalDias: v }));
      assert.strictEqual(r.apto, false);
      assert.ok(r.motivosRechazo.length >= 1);
    }
  });

  it("rechaza CE <= 0", () => {
    for (const v of [0, -1.5]) {
      const r = validateBull(aptBull({ circunferenciaEscrotalCm: v }));
      assert.strictEqual(r.apto, false);
      assert.ok(r.motivosRechazo.length >= 1);
    }
  });

  it("rechaza motilidad < 0 o > 100", () => {
    for (const v of [-1, 101]) {
      const r = validateBull(aptBull({ motilidadSeminalPct: v }));
      assert.strictEqual(r.apto, false);
      assert.ok(r.motivosRechazo.length >= 1);
    }
  });

  it("rechaza AOB < 0", () => {
    const r = validateBull(aptBull({ areaOjoBifeCm2: -0.1 }));
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 1);
  });

  it("campo ausente no duplica motivo de inválido (un solo motivo de ausencia)", () => {
    const input = aptBull();
    delete input.edadDesteDias;
    const r = validateBull(input);
    assert.strictEqual(r.apto, false);
    const ausentes = r.motivosRechazo.filter((m) =>
      m.includes("campo ausente: edadDesteDias")
    );
    assert.strictEqual(ausentes.length, 1);
  });
});

describe("T3 RF-06 multi-barrera simultánea vía validator", () => {
  it("dos barreras fallidas → motivosRechazo.length >= 2", () => {
    const r = validateBull(aptBull({ edadDesteDias: 99, motilidadSeminalPct: 69 }));
    assert.strictEqual(r.apto, false);
    assert.ok(r.motivosRechazo.length >= 2);
  });
});
