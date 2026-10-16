// Tests T2 Spec 002 RF-05: mensaje canónico puro oracleMessage.
// Comentarios en español; código en inglés. TDD: rojo antes de implementar.
// Sin red, sin SDK, solo lógica pura + caso EA-01 Spec 001 (mTotal 2.45, $73,500 / $24.50).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildOracleMessage,
  toCanonicalJson,
  verifyMessageContent,
} = require("../src/logic/oracleMessage.js");

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

const PUBLISHED_AT = "2026-10-16T00:00:00.000Z";

describe("T2 RF-05 contenido mínimo del mensaje EA-01", () => {
  it("caso EA-01 produce specVersion 001, bullId, 11 inputs, mTotal y tasaciones", () => {
    const { message, canonicalJson, valuationKey } = buildOracleMessage(
      canonicalBullInput(),
      canonicalBullResult(),
      { publishedAt: PUBLISHED_AT }
    );
    // Sobre de versión.
    assert.strictEqual(message.specVersion, "001");
    assert.strictEqual(message.schemaVersion, 1);
    // Identificación.
    assert.strictEqual(message.bullId, "BRAF-001");
    // Inputs: copia exacta de los 11 campos PEGBraf sin redondeo.
    assert.deepStrictEqual(message.inputs, {
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
    });
    // Veredicto siempre APTO aquí.
    assert.deepStrictEqual(message.verdict, { apto: true });
    // Tasación EA-01 exacta.
    assert.strictEqual(message.mTotal, 2.45);
    assert.deepStrictEqual(message.valuationsUsd, { bull: 73500, dose: 24.5 });
    // Instante por parámetro (pureza: sin Date.now interno).
    assert.strictEqual(message.publishedAt, PUBLISHED_AT);
    // valuationKey estable: hex de 64 caracteres presente en mensaje y retorno.
    assert.match(valuationKey, /^[0-9a-f]{64}$/);
    assert.strictEqual(message.valuationKey, valuationKey);
    // canonicalJson con claves ordenadas: specVersion abre el objeto.
    assert.ok(typeof canonicalJson === "string");
    assert.ok(canonicalJson.indexOf('"specVersion":"001"') !== -1);
    assert.ok(canonicalJson.indexOf('"valuationKey":"') !== -1);
  });

  it("doble build idéntico → mismo canonicalJson y valuationKey (determinista)", () => {
    const first = buildOracleMessage(canonicalBullInput(), canonicalBullResult(), {
      publishedAt: PUBLISHED_AT,
    });
    const second = buildOracleMessage(canonicalBullInput(), canonicalBullResult(), {
      publishedAt: PUBLISHED_AT,
    });
    assert.strictEqual(second.canonicalJson, first.canonicalJson);
    assert.strictEqual(second.valuationKey, first.valuationKey);
  });

  it("toCanonicalJson ordena claves recursivamente", () => {
    const json = toCanonicalJson({ z: 1, a: { d: 4, b: 2 }, m: [3, { y: 1, x: 2 }] });
    assert.strictEqual(json, '{"a":{"b":2,"d":4},"m":[3,{"x":2,"y":1}],"z":1}');
  });
});

describe("T2 RF-05 vetos del constructor (anticipa RF-03)", () => {
  it("apto=false lanza sin construir mensaje", () => {
    assert.throws(
      () =>
        buildOracleMessage(
          canonicalBullInput(),
          { apto: false, motivosRechazo: ["edad de destete fuera de rango"], mTotal: null, tasacionToroUsd: null, tasacionDosisUsd: null },
          { publishedAt: PUBLISHED_AT }
        ),
      /solo APTOS registrables/
    );
  });

  it("tasación ausente (mTotal null) lanza", () => {
    assert.throws(
      () =>
        buildOracleMessage(
          canonicalBullInput(),
          { apto: true, motivosRechazo: [], mTotal: null, tasacionToroUsd: null, tasacionDosisUsd: null },
          { publishedAt: PUBLISHED_AT }
        ),
      /tasación ausente/
    );
  });

  it("specVersion distinta de 001 lanza", () => {
    assert.throws(
      () =>
        buildOracleMessage(canonicalBullInput(), canonicalBullResult(), {
          publishedAt: PUBLISHED_AT,
          specVersion: "002",
        }),
      /spec-version no soportada/
    );
  });
});

describe("T2 RF-05 verifyMessageContent (comparación numérica exacta)", () => {
  it("24.5 vs 24.50 → VERIFIED (mismo valor numérico)", () => {
    const built = buildOracleMessage(canonicalBullInput(), canonicalBullResult(), {
      publishedAt: PUBLISHED_AT,
    });
    // Mismo mensaje pero serializado con dose 24.50 (formato distinto, valor igual).
    const retrieved = JSON.parse(built.canonicalJson);
    retrieved.valuationsUsd.dose = 24.5; // 24.50 parsea al mismo número
    const result = verifyMessageContent(JSON.stringify(retrieved), built.message);
    assert.strictEqual(result.status, "VERIFIED");
  });

  it("2.45 vs 2.46 → MISMATCH con diff", () => {
    const built = buildOracleMessage(canonicalBullInput(), canonicalBullResult(), {
      publishedAt: PUBLISHED_AT,
    });
    const retrieved = JSON.parse(built.canonicalJson);
    retrieved.mTotal = 2.46;
    const result = verifyMessageContent(retrieved, built.message);
    assert.strictEqual(result.status, "MISMATCH");
    assert.ok(Array.isArray(result.diff));
    assert.ok(result.diff.some((d) => d.includes("mTotal")));
  });
});
