// Tests T4: invariante precisión RF-01 + crecimiento RF-10 (pricing.js).
// Comentarios en español; código en inglés.
// TDD: este test debe fallar en rojo con el stub actual (lanza "no implementado").
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { calculateMTotal, calculateBullPrice, calculateDosePrice, roundHalfUp2 } = require("../src/logic/pricing.js");

// Base sin bonos: resto de inputs que NO bonifican en RF-09/RF-11/RF-12/RF-13
// (pesoNacerDep > 0, AOB < 2.0, GI false) para aislar el efecto de RF-10.
// Así los tests de T4 no se rompen al completar T5.
function baseBull(overrides = {}) {
  return {
    pesoNacerDep: 0.01,
    pesoDestateDep: 10.0,
    pesoFinalDep: 20.0,
    edadDesteDias: 210,
    edadPesoFinalDias: 540,
    circunferenciaEscrotalCm: 2.0,
    areaOjoBifeCm2: 1.99,
    grasaIntramuscularTop5: false,
    motilidadSeminalPct: 80,
    volumenEyaculadoMl: 200,
    pajuelasProducidas: 300,
    ...overrides,
  };
}

// Tolerancia para suma flotante (riesgo R-01): 1.15 no es exacto en binario.
function assertMTotal(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `esperaba M_TOTAL ~ ${expected}, obtuvo ${actual}`
  );
}

describe("T4 RF-08 base M_TOTAL = 1.0 sin bonos", () => {
  it("toro sin bono RF-10 → M_TOTAL = 1.0", () => {
    const m = calculateMTotal(baseBull());
    assertMTotal(m, 1.0);
  });
});

describe("T4 RF-10 crecimiento superior (AND estricto > 15.0 Y > 30.0)", () => {
  it("ambos OK (16.0 y 32.0) → +0.15 (M = 1.15)", () => {
    const m = calculateMTotal(baseBull({ pesoDestateDep: 16.0, pesoFinalDep: 32.0 }));
    assertMTotal(m, 1.15);
  });

  it("solo destete OK (16.0 y 30.0 exacto) → sin bono (M = 1.0)", () => {
    const m = calculateMTotal(baseBull({ pesoDestateDep: 16.0, pesoFinalDep: 30.0 }));
    assertMTotal(m, 1.0);
  });

  it("solo final OK (15.0 exacto y 32.0) → sin bono (M = 1.0)", () => {
    const m = calculateMTotal(baseBull({ pesoDestateDep: 15.0, pesoFinalDep: 32.0 }));
    assertMTotal(m, 1.0);
  });

  it("ninguno OK (15.0 y 30.0 exactos) → sin bono (M = 1.0)", () => {
    const m = calculateMTotal(baseBull({ pesoDestateDep: 15.0, pesoFinalDep: 30.0 }));
    assertMTotal(m, 1.0);
  });

  it("ninguno OK (10.0 y 20.0) → sin bono (M = 1.0)", () => {
    const m = calculateMTotal(baseBull({ pesoDestateDep: 10.0, pesoFinalDep: 20.0 }));
    assertMTotal(m, 1.0);
  });
});

describe("T4 RF-01 precisión exacta anti-redondeo 5/10", () => {
  it("16.4/32.6 exactos otorgan el bono RF-10 (M = 1.15)", () => {
    const m = calculateMTotal(baseBull({ pesoDestateDep: 16.4, pesoFinalDep: 32.6 }));
    assertMTotal(m, 1.15);
  });

  it("documenta invariante: si 16.4 se redondeara a 15 daría M = 1.0 (distinto)", () => {
    // El valor exacto bonifica; su variante redondeada a múltiplo de 5 no.
    // Esto prueba que la implementación NO redondea (RF-01).
    const exacto = calculateMTotal(baseBull({ pesoDestateDep: 16.4, pesoFinalDep: 32.6 }));
    const redondeado = calculateMTotal(baseBull({ pesoDestateDep: 15.0, pesoFinalDep: 32.6 }));
    assertMTotal(exacto, 1.15);
    assertMTotal(redondeado, 1.0);
    assert.ok(
      Math.abs(exacto - redondeado) > 0.1,
      `redondear cambia M_TOTAL: exacto=${exacto} vs redondeado=${redondeado}`
    );
  });
});

// Tests T5: bonos RF-08, RF-09, RF-11/RF-12, RF-13 (pricing.js).
// Lógica pura; comparaciones directas sin epsilon; AOB con else-if no acumulable.
describe("T5 RF-08 base sin bonos → M_TOTAL = 1.0", () => {
  it("toro sin ningún bono → M_TOTAL = 1.0", () => {
    // pesoNacerDep > 0, sin crecimiento, AOB < 2.0, GI false.
    const m = calculateMTotal(baseBull());
    assertMTotal(m, 1.0);
  });
});

describe("T5 RF-09 facilidad de parto (pesoNacerDep <= 0.0 → +0.50)", () => {
  it("-0.5 → +0.50 (M = 1.5)", () => {
    const m = calculateMTotal(baseBull({ pesoNacerDep: -0.5 }));
    assertMTotal(m, 1.5);
  });

  it("0.0 exacto → +0.50 (M = 1.5, borde inclusivo)", () => {
    const m = calculateMTotal(baseBull({ pesoNacerDep: 0.0 }));
    assertMTotal(m, 1.5);
  });

  it("0.01 → sin bono (M = 1.0)", () => {
    const m = calculateMTotal(baseBull({ pesoNacerDep: 0.01 }));
    assertMTotal(m, 1.0);
  });
});

describe("T5 RF-11/RF-12 AOB else-if no acumulable", () => {
  it("1.99 → sin bono (M = 1.0)", () => {
    const m = calculateMTotal(baseBull({ areaOjoBifeCm2: 1.99 }));
    assertMTotal(m, 1.0);
  });

  it("2.0 exacto → +0.20 (M = 1.2)", () => {
    const m = calculateMTotal(baseBull({ areaOjoBifeCm2: 2.0 }));
    assertMTotal(m, 1.2);
  });

  it("2.99 → +0.20 (M = 1.2)", () => {
    const m = calculateMTotal(baseBull({ areaOjoBifeCm2: 2.99 }));
    assertMTotal(m, 1.2);
  });

  it("3.0 exacto → +0.50 (M = 1.5, rama premium)", () => {
    const m = calculateMTotal(baseBull({ areaOjoBifeCm2: 3.0 }));
    assertMTotal(m, 1.5);
  });

  it("3.2 → +0.50 y nunca +0.70 (M = 1.5)", () => {
    const m = calculateMTotal(baseBull({ areaOjoBifeCm2: 3.2 }));
    assertMTotal(m, 1.5);
    // No-acumulación: premium e intermedia jamás se suman (+0.70 prohibido).
    assert.ok(
      Math.abs(m - 1.7) > 1e-9,
      `AOB premium no debe acumular intermedia: obtuvo ${m}`
    );
  });
});

describe("T5 RF-13 marmoleado (=== true estricto → +0.30)", () => {
  it("true → +0.30 (M = 1.3)", () => {
    const m = calculateMTotal(baseBull({ grasaIntramuscularTop5: true }));
    assertMTotal(m, 1.3);
  });

  it("false → sin bono (M = 1.0)", () => {
    const m = calculateMTotal(baseBull({ grasaIntramuscularTop5: false }));
    assertMTotal(m, 1.0);
  });

  it("1 (truthy no booleano) → sin bono (M = 1.0, igualdad estricta)", () => {
    const m = calculateMTotal(baseBull({ grasaIntramuscularTop5: 1 }));
    assertMTotal(m, 1.0);
  });
});

describe("T5 supuesto 3: campos 10-11 ignorados (R-05)", () => {
  it("mismo toro con distinto volumen/pajuelas → idéntico M_TOTAL", () => {
    // Toro con bonos RF-09 + RF-10 + RF-11 premium + RF-13 = 1.0+0.50+0.15+0.50+0.30 = 2.45.
    const toro = {
      pesoNacerDep: -0.5,
      pesoDestateDep: 16.0,
      pesoFinalDep: 32.0,
      edadDesteDias: 210,
      edadPesoFinalDias: 540,
      circunferenciaEscrotalCm: 2.0,
      areaOjoBifeCm2: 3.2,
      grasaIntramuscularTop5: true,
      motilidadSeminalPct: 80,
    };
    const mA = calculateMTotal({ ...toro, volumenEyaculadoMl: 200, pajuelasProducidas: 300 });
    const mB = calculateMTotal({ ...toro, volumenEyaculadoMl: 9999, pajuelasProducidas: 1 });
    assertMTotal(mA, 2.45);
    assertMTotal(mB, 2.45);
    assert.ok(mA === mB, `campos 10-11 no deben afectar M_TOTAL: ${mA} vs ${mB}`);
  });
});

// Tests T6: tasación RF-14 (toro entero) + RF-15 (dosis half-up 2 decimales).
// Lógica pura; half-up manual con EPSILON, sin toFixed ni librerías (plan T-03).
// Riesgo R-01: M_TOTAL real es binario (2.4499999999999997), se compara con tolerancia 1e-9
// pero las tasaciones deben dar valores exactos (73500 entero, 24.50).
describe("T6 RF-14 tasación del toro = 30000 * M_TOTAL (entero USD)", () => {
  it("1.0 → 30000 (base sin bonos)", () => {
    assert.strictEqual(calculateBullPrice(1.0), 30000);
  });

  it("2.45 literal → 73500 (máximo teórico)", () => {
    assert.strictEqual(calculateBullPrice(2.45), 73500);
  });

  it("M_TOTAL real calculado (2.4499999999999997) → 73500 entero (riesgo R-01)", () => {
    // El M_TOTAL canónico no es exacto en binario; la tasación igual debe ser entera exacta.
    const mReal = calculateMTotal({
      pesoNacerDep: -0.5,
      pesoDestateDep: 16.0,
      pesoFinalDep: 32.0,
      edadDesteDias: 210,
      edadPesoFinalDias: 540,
      circunferenciaEscrotalCm: 2.0,
      areaOjoBifeCm2: 3.2,
      grasaIntramuscularTop5: true,
      motilidadSeminalPct: 80,
      volumenEyaculadoMl: 200,
      pajuelasProducidas: 300,
    });
    assertMTotal(mReal, 2.45);
    assert.strictEqual(calculateBullPrice(mReal), 73500);
  });
});

describe("T6 RF-15 tasación de la dosis = roundHalfUp2(10 * M_TOTAL)", () => {
  it("1.0 → 10.00 (base sin bonos)", () => {
    assert.strictEqual(calculateDosePrice(1.0), 10);
  });

  it("2.45 literal → 24.50 (máximo teórico)", () => {
    assert.strictEqual(calculateDosePrice(2.45), 24.5);
  });

  it("M_TOTAL real calculado (10*M = 24.499999999999996) → 24.50 (riesgo R-01)", () => {
    const mReal = calculateMTotal({
      pesoNacerDep: -0.5,
      pesoDestateDep: 16.0,
      pesoFinalDep: 32.0,
      edadDesteDias: 210,
      edadPesoFinalDias: 540,
      circunferenciaEscrotalCm: 2.0,
      areaOjoBifeCm2: 3.2,
      grasaIntramuscularTop5: true,
      motilidadSeminalPct: 80,
      volumenEyaculadoMl: 200,
      pajuelasProducidas: 300,
    });
    assertMTotal(mReal, 2.45);
    assert.strictEqual(calculateDosePrice(mReal), 24.5);
  });

  it("borde half-up 1.005 → 1.01 (hacia arriba, no banker's)", () => {
    assert.strictEqual(roundHalfUp2(1.005), 1.01);
  });
});
