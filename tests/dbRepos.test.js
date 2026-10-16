"use strict";

// Tests T5 (spec 004, RF-01/RF-02/RF-07): cliente Supabase y repos de toros y
// valuaciones con mock sin red.
// Comentarios en español; código en inglés camelCase.
// TDD rojo: src/db/ aún no existe → estos tests deben fallar.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { evaluateBull } = require("../src/logic/evaluateBull.js");
const {
  buildBullRecord,
  buildValuationRecord,
} = require("../src/logic/mirrorRules.js");
const { createSupabaseClient } = require("../src/db/supabaseClient.js");
const { saveBull, getBull } = require("../src/db/bullsRepo.js");
const { saveValuation, getValuation } = require("../src/db/valuationsRepo.js");

// URL y claves ficticias: formato válido, nunca reales.
const FAKE_URL = "https://xyzcompany.supabase.co";
const FAKE_ANON_KEY = "fake-anon-key-for-format-only";
const FAKE_SERVICE_KEY = "fake-service-role-key-for-format-only";

// Toro APTO con bullId y los 11 inputs PEGBraf.
function aptBullInput(overrides = {}) {
  return {
    bullId: "TORO-T5-001",
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

function aptBullRecord() {
  const input = aptBullInput();
  return buildBullRecord(input, evaluateBull(input));
}

function aptValuationRecord() {
  const input = aptBullInput();
  return buildValuationRecord(input, evaluateBull(input), { publishedAt: PUBLISHED_AT });
}

// Doble en memoria del cliente Supabase: soporta from().upsert().select() y
// from().select().eq() sin red ni credenciales. Registra llamadas para auditar
// que cada guardado hace un solo upsert con la clave de conflicto correcta.
function createMockSupabase(seed = {}) {
  const store = {
    bulls: { ...(seed.bulls || {}) },
    valuations: { ...(seed.valuations || {}) },
  };
  const calls = { upsert: [], selectEq: [] };
  let nextUpsertError = null;
  const api = {
    calls,
    store,
    // Programa el próximo upsert para fallar (ej. conflicto 23505/409).
    // sideEffect opcional simula al ganador concurrente ya persistido en el motor.
    failNextUpsertOnce(error, sideEffect) {
      nextUpsertError = { error, sideEffect };
    },
    from(table) {
      return {
        upsert(row, options) {
          calls.upsert.push({ table, row, options });
          return {
            select: async () => {
              if (nextUpsertError) {
                const failed = nextUpsertError;
                nextUpsertError = null;
                if (typeof failed.sideEffect === "function") {
                  failed.sideEffect();
                }
                return { data: null, error: failed.error };
              }
              const key = table === "bulls" ? row.bull_id : row.valuation_key;
              store[table][key] = row;
              return { data: [row], error: null };
            },
          };
        },
        select() {
          return {
            eq: async (column, value) => {
              calls.selectEq.push({ table, column, value });
              const rows = Object.values(store[table] || {}).filter(
                (r) => r[column] === value
              );
              return { data: rows, error: null };
            },
          };
        },
      };
    },
  };
  return api;
}

describe("T5 supabaseClient factory sin red", () => {
  it("lanza sin URL/clave antes de tocar red", () => {
    assert.throws(() => createSupabaseClient({}), /credenciales Supabase ausentes/);
    assert.throws(
      () => createSupabaseClient({ url: FAKE_URL }),
      /credenciales Supabase ausentes/
    );
    assert.throws(
      () => createSupabaseClient({ key: FAKE_SERVICE_KEY }),
      /credenciales Supabase ausentes/
    );
  });

  it("acepta SDK inyectado y crea el cliente sin red real", () => {
    let seen = null;
    const fakeSdk = {
      createClient(url, key) {
        seen = { url, key };
        return { fake: "client" };
      },
    };
    const client = createSupabaseClient(
      { url: FAKE_URL, key: FAKE_SERVICE_KEY },
      { supabaseJs: fakeSdk }
    );
    assert.deepStrictEqual(client, { fake: "client" });
    assert.strictEqual(seen.url, FAKE_URL);
    assert.strictEqual(seen.key, FAKE_SERVICE_KEY);
  });
});

describe("T5 RF-01 bullsRepo.saveBull/getBull con un upsert por bullId", () => {
  it("saveBull hace un solo upsert con onConflict bull_id y sin red", async () => {
    const mock = createMockSupabase();
    const record = aptBullRecord();
    const out = await saveBull(mock, record);
    assert.strictEqual(mock.calls.upsert.length, 1);
    assert.strictEqual(mock.calls.upsert[0].table, "bulls");
    assert.strictEqual(mock.calls.upsert[0].options.onConflict, "bull_id");
    assert.strictEqual(mock.calls.upsert[0].row.bull_id, "TORO-T5-001");
    assert.strictEqual(out.existed, false);
    assert.strictEqual(out.bull.bullId, "TORO-T5-001");
  });

  it("saveBull valida en puro antes de red: registro incompleto lanza con cero escrituras", async () => {
    const mock = createMockSupabase();
    await assert.rejects(() => saveBull(mock, null), /incompleto|requerido|no inventa/i);
    assert.strictEqual(mock.calls.upsert.length, 0);
  });

  it("getBull devuelve el toro guardado por bullId", async () => {
    const mock = createMockSupabase();
    const record = aptBullRecord();
    await saveBull(mock, record);
    const found = await getBull(mock, "TORO-T5-001");
    assert.strictEqual(found.record.bullId, "TORO-T5-001");
    assert.strictEqual(found.record.mTotal, record.mTotal);
  });

  it("getBull de toro ausente devuelve ausencia explícita sin inventar", async () => {
    const mock = createMockSupabase();
    const found = await getBull(mock, "TORO-INEXISTENTE");
    assert.strictEqual(found.record, null);
    assert.strictEqual(found.mirrorUrl, null);
    assert.strictEqual(found.hashscanUrl, null);
    assert.strictEqual(found.unverified, true);
  });
});

describe("T5 RF-02 valuationsRepo.saveValuation idempotente por valuationKey", () => {
  it("saveValuation hace un solo upsert con onConflict valuation_key", async () => {
    const mock = createMockSupabase();
    const record = aptValuationRecord();
    const out = await saveValuation(mock, record);
    assert.strictEqual(mock.calls.upsert.length, 1);
    assert.strictEqual(mock.calls.upsert[0].table, "valuations");
    assert.strictEqual(mock.calls.upsert[0].options.onConflict, "valuation_key");
    assert.strictEqual(mock.calls.upsert[0].row.valuation_key, record.valuationKey);
    assert.strictEqual(out.existed, false);
    assert.strictEqual(out.valuation.record.valuationKey, record.valuationKey);
    assert.strictEqual(out.valuation.record.mTotal, record.mTotal);
  });

  it("reintento idéntico de valuationKey devuelve el original sin duplicar", async () => {
    const mock = createMockSupabase();
    const record = aptValuationRecord();
    const first = await saveValuation(mock, record);
    const second = await saveValuation(mock, { ...record });
    assert.strictEqual(second.existed, true);
    assert.strictEqual(second.valuation.record.valuationKey, first.valuation.record.valuationKey);
    assert.strictEqual(second.valuation.record.mTotal, first.valuation.record.mTotal);
    assert.strictEqual(second.valuation.record.priceBullUsd, first.valuation.record.priceBullUsd);
    assert.strictEqual(Object.keys(mock.store.valuations).length, 1);
  });

  it("ante conflicto 23505 del motor converge releyendo y devuelve el original", async () => {
    const record = aptValuationRecord();
    const seedRow = {
      valuation_key: record.valuationKey,
      bull_id: record.bullId,
      spec_version: "001",
      m_total: record.mTotal,
      price_bull_usd: record.priceBullUsd,
      price_dose_usd: record.priceDoseUsd,
      canonical_json: record.canonicalJson,
    };
    const mock = createMockSupabase();
    // Carrera de reintentos: la pre-lectura no ve nada, el upsert choca en el
    // motor (23505) porque un concurrente persistió la misma valuación idéntica.
    mock.failNextUpsertOnce({ code: "23505", message: "duplicate key" }, () => {
      mock.store.valuations[record.valuationKey] = seedRow;
    });
    const out = await saveValuation(mock, { ...record });
    assert.strictEqual(out.existed, true);
    assert.strictEqual(out.valuation.record.valuationKey, record.valuationKey);
    assert.strictEqual(out.valuation.record.mTotal, record.mTotal);
  });

  it("misma clave con input distinto (CE 1.5 vs 1.6) lanza sin duplicar", async () => {
    const mock = createMockSupabase();
    const record = aptValuationRecord();
    await saveValuation(mock, record);
    const otherInput = aptBullInput({ circunferenciaEscrotalCm: 1.5 });
    const otherResult = evaluateBull(otherInput);
    // Si el otro input también es APTO, su clave difiere; forzamos colisión
    // reutilizando la valuationKey original con contenido distinto.
    const tampered = { ...aptValuationRecord(), valuationKey: record.valuationKey };
    // Garantiza contenido distinto aunque la clave se reutilice.
    tampered.mTotal = record.mTotal + 0.01;
    void otherResult;
    await assert.rejects(() => saveValuation(mock, tampered), /colisión|otra valuación|no idempotente/i);
    assert.strictEqual(Object.keys(mock.store.valuations).length, 1);
  });

  it("getValuation devuelve vista pública con ausencia explícita si no existe", async () => {
    const mock = createMockSupabase();
    const view = await getValuation(mock, "clave-inexistente");
    assert.strictEqual(view.record, null);
    assert.strictEqual(view.mirrorUrl, null);
    assert.strictEqual(view.hashscanUrl, null);
    assert.strictEqual(view.unverified, true);
  });

  it("getValuation devuelve vista pública con referencia Testnet cuando hay proof", async () => {
    const mock = createMockSupabase();
    const record = aptValuationRecord();
    await saveValuation(mock, record);
    const proof = {
      valuationKey: record.valuationKey,
      topicId: "0.0.123456",
      sequenceNumber: 42,
      consensusTimestamp: "2026-10-16T00:00:00.000000000Z",
      transactionId: "0.0.789@1729000000.123456789",
      status: "VERIFIED",
    };
    const view = await getValuation(mock, record.valuationKey, proof);
    assert.strictEqual(view.record.valuationKey, record.valuationKey);
    assert.ok(view.mirrorUrl.includes("testnet.mirrornode.hedera.com"));
    assert.ok(view.hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    assert.strictEqual(view.unverified, false);
  });
});

// ---------------------------------------------------------------------------
// T6 (spec 004, RF-03/RF-04/RF-05/RF-06/RF-08): repos de proofs y marketplace
// con mock sin red, veto sin escritura.
// Comentarios en español; código en inglés camelCase.
// TDD rojo: src/db/proofsRepo.js y src/db/listingsRepo.js aún no existen.
const { saveProof, getProof, updateProofStatus } = require("../src/db/proofsRepo.js");
const {
  saveListing,
  savePurchase,
  settlePurchase,
} = require("../src/db/listingsRepo.js");

// Mock extendido: mismas primitivas from().upsert().select()/from().select().eq()
// sin red, con tablas proofs/listings/purchases y conteo de escrituras para el
// veto (cero llamadas ante MISMATCH/PENDING) más error 42501 programable.
function createMockSupabaseT6(seed = {}) {
  const store = {
    bulls: {},
    valuations: {},
    proofs: { ...(seed.proofs || {}) },
    listings: { ...(seed.listings || {}) },
    purchases: { ...(seed.purchases || {}) },
  };
  const calls = { upsert: [], selectEq: [] };
  let nextUpsertError = null;
  function keyOf(table, row) {
    if (table === "bulls") return row.bull_id;
    if (table === "valuations" || table === "proofs") return row.valuation_key;
    if (table === "listings") return row.listing_id;
    if (table === "purchases") return row.purchase_id;
    return row.id;
  }
  const api = {
    calls,
    store,
    failNextUpsertOnce(error, sideEffect) {
      nextUpsertError = { error, sideEffect };
    },
    from(table) {
      return {
        upsert(row, options) {
          calls.upsert.push({ table, row, options });
          return {
            select: async () => {
              if (nextUpsertError) {
                const failed = nextUpsertError;
                nextUpsertError = null;
                if (typeof failed.sideEffect === "function") {
                  failed.sideEffect();
                }
                return { data: null, error: failed.error };
              }
              store[table][keyOf(table, row)] = row;
              return { data: [row], error: null };
            },
          };
        },
        select() {
          return {
            eq: async (column, value) => {
              calls.selectEq.push({ table, column, value });
              const rows = Object.values(store[table] || {}).filter(
                (r) => r[column] === value
              );
              return { data: rows, error: null };
            },
          };
        },
      };
    },
  };
  return api;
}

// Proof PENDING ligada a una valuationKey (ficticia, nunca real).
function pendingProof(overrides = {}) {
  return {
    valuationKey: "VAL-T6-001",
    topicId: "0.0.123456",
    sequenceNumber: 7,
    consensusTimestamp: "2026-10-16T00:00:00.000000000Z",
    transactionId: "0.0.789@1729000000.000000007",
    status: "PENDING",
    ...overrides,
  };
}

// Movimiento de compra espejado tal cual lo decidió 003 (ficticio, sin red).
function purchaseMovement(overrides = {}) {
  return {
    listingId: "LIST-T6-001",
    purchaseId: "BUY-T6-001",
    valuationKey: "VAL-T6-001",
    assetType: "PAJ_BRAF",
    unitPriceUsd: 12.25,
    quantity: 20,
    royaltyPct: 5,
    royaltyUsd: 12.25,
    sellerUsd: 232.75,
    totalUsd: 245,
    purchaseTxId: "0.0.789@1729000000.000000042",
    settlementTxId: null,
    settled: false,
    ...overrides,
  };
}

describe("T6 RF-03/RF-08 proofsRepo.saveProof/getProof/updateProofStatus con mock", () => {
  it("saveProof guarda la proof con un upsert por valuation_key", async () => {
    const mock = createMockSupabaseT6();
    const out = await saveProof(mock, pendingProof(), { status: "PENDING" });
    assert.strictEqual(mock.calls.upsert.length, 1);
    assert.strictEqual(mock.calls.upsert[0].table, "proofs");
    assert.strictEqual(mock.calls.upsert[0].options.onConflict, "valuation_key");
    assert.strictEqual(out.proof.valuationKey, "VAL-T6-001");
    assert.strictEqual(out.proof.status, "PENDING");
  });

  it("saveProof con reclamo VERIFIED pero verdad distinta fuerza MISMATCH (veto)", async () => {
    const mock = createMockSupabaseT6();
    const claimed = pendingProof({ status: "VERIFIED" });
    const out = await saveProof(mock, claimed, { status: "MISMATCH" });
    assert.strictEqual(out.proof.status, "MISMATCH");
  });

  it("getProof devuelve la proof guardada ligada a su valuationKey", async () => {
    const mock = createMockSupabaseT6();
    await saveProof(mock, pendingProof(), { status: "PENDING" });
    const view = await getProof(mock, "VAL-T6-001");
    assert.strictEqual(view.record.valuationKey, "VAL-T6-001");
    assert.strictEqual(view.unverified, true);
  });

  it("updateProofStatus promueve PENDING a VERIFIED solo con veredicto inyectado", async () => {
    const mock = createMockSupabaseT6();
    await saveProof(mock, pendingProof(), { status: "PENDING" });
    const out = await updateProofStatus(mock, "VAL-T6-001", "VERIFIED", {
      status: "VERIFIED",
    });
    assert.strictEqual(out.proof.status, "VERIFIED");
    assert.strictEqual(out.updated, true);
  });

  it("updateProofStatus sin prueba de verdad lanza (nunca autopromoción)", async () => {
    const mock = createMockSupabaseT6();
    await saveProof(mock, pendingProof(), { status: "PENDING" });
    const writesBefore = mock.calls.upsert.length;
    await assert.rejects(
      () => updateProofStatus(mock, "VAL-T6-001", "VERIFIED", null),
      /autoverifica|prueba de verdad/i
    );
    assert.strictEqual(mock.calls.upsert.length, writesBefore);
  });
});

describe("T6 RF-04/RF-05 veto de listado sin escritura ante MISMATCH/PENDING", () => {
  it("saveListing con proof PENDING bloquea con cero llamadas de escritura", async () => {
    const mock = createMockSupabaseT6();
    const listing = {
      listingId: "LIST-T6-001",
      valuationKey: "VAL-T6-001",
      assetType: "PAJ_BRAF",
      unitPriceUsd: 12.25,
      quantity: 20,
    };
    await assert.rejects(
      () => saveListing(mock, listing, "PENDING"),
      /sin proof VERIFIED/i
    );
    assert.strictEqual(mock.calls.upsert.length, 0);
  });

  it("saveListing con proof MISMATCH bloquea con cero llamadas de escritura", async () => {
    const mock = createMockSupabaseT6();
    const listing = {
      listingId: "LIST-T6-001",
      valuationKey: "VAL-T6-001",
      assetType: "PAJ_BRAF",
      unitPriceUsd: 12.25,
      quantity: 20,
    };
    await assert.rejects(
      () => saveListing(mock, listing, "MISMATCH"),
      /sin proof VERIFIED/i
    );
    assert.strictEqual(mock.calls.upsert.length, 0);
  });

  it("saveListing con proof VERIFIED escribe con un upsert por listing_id", async () => {
    const mock = createMockSupabaseT6();
    const listing = {
      listingId: "LIST-T6-001",
      valuationKey: "VAL-T6-001",
      assetType: "PAJ_BRAF",
      unitPriceUsd: 12.25,
      quantity: 20,
    };
    const out = await saveListing(mock, listing, "VERIFIED");
    assert.strictEqual(mock.calls.upsert.length, 1);
    assert.strictEqual(mock.calls.upsert[0].table, "listings");
    assert.strictEqual(mock.calls.upsert[0].options.onConflict, "listing_id");
    assert.strictEqual(out.listing.listingId, "LIST-T6-001");
  });
});

describe("T6 RF-06 savePurchase idempotente y settlePurchase sin doble liquidación", () => {
  it("savePurchase idempotente por purchaseId devuelve el original sin duplicar", async () => {
    const mock = createMockSupabaseT6();
    const first = await savePurchase(mock, purchaseMovement());
    const second = await savePurchase(mock, purchaseMovement());
    assert.strictEqual(second.existed, true);
    assert.strictEqual(second.purchase.purchaseId, first.purchase.purchaseId);
    assert.strictEqual(second.purchase.totalUsd, 245);
    assert.strictEqual(Object.keys(mock.store.purchases).length, 1);
  });

  it("savePurchase con mismo purchaseId e importes distintos lanza", async () => {
    const mock = createMockSupabaseT6();
    await savePurchase(mock, purchaseMovement());
    await assert.rejects(
      () => savePurchase(mock, purchaseMovement({ totalUsd: 999 })),
      /otra compra|importes distintos/i
    );
    assert.strictEqual(Object.keys(mock.store.purchases).length, 1);
  });

  it("settlePurchase liquida una vez y el segundo settle lanza sin segunda liquidación", async () => {
    const mock = createMockSupabaseT6();
    await savePurchase(mock, purchaseMovement());
    const settled = await settlePurchase(
      mock,
      "BUY-T6-001",
      "0.0.789@1729000000.000000099"
    );
    assert.strictEqual(settled.purchase.settled, true);
    assert.strictEqual(
      settled.purchase.settlementTxId,
      "0.0.789@1729000000.000000099"
    );
    await assert.rejects(
      () => settlePurchase(mock, "BUY-T6-001", "0.0.789@1729000000.000000100"),
      /doble liquidación/i
    );
  });

  it("error 42501 de escritura con anon se propaga como denegación", async () => {
    const mock = createMockSupabaseT6();
    mock.failNextUpsertOnce({
      code: "42501",
      message: 'permission denied for table proofs with anon role',
    });
    await assert.rejects(
      () => saveProof(mock, pendingProof(), { status: "PENDING" }),
      /denegada|42501/i
    );
  });
});

// ---------------------------------------------------------------------------
// T7 (spec 004, RF-07 + RF-01 a RF-06 como lectura, RF-08): consultas públicas
// verificables sin credenciales, con rol anon sobre el mock.
// Comentarios en español; código en inglés camelCase.
// TDD rojo: findBulls, findValuationsByBullId, getListing, getPurchase y
// findProofsByStatus aún no existen → estos tests deben fallar.
const { findBulls } = require("../src/db/bullsRepo.js");
const { findValuationsByBullId } = require("../src/db/valuationsRepo.js");
const { findProofsByStatus } = require("../src/db/proofsRepo.js");
const { getListing, getPurchase } = require("../src/db/listingsRepo.js");

// Mock T7 con rol anon: solo SELECT abierto por RLS, sin credenciales de
// operador ni red. Soporta from().upsert().select() para sembrar y
// from().select().eq() más from().select() (listar) para leer. Cuenta
// escrituras para probar que leer nunca escribe ni llama on-chain.
function createMockSupabaseT7() {
  const store = { bulls: {}, valuations: {}, proofs: {}, listings: {}, purchases: {} };
  const calls = { upsert: [], selectEq: [], selectAll: [] };
  function keyOf(table, row) {
    if (table === "bulls") return row.bull_id;
    if (table === "valuations" || table === "proofs") return row.valuation_key;
    if (table === "listings") return row.listing_id;
    if (table === "purchases") return row.purchase_id;
    return row.id;
  }
  const api = {
    calls,
    store,
    // Rol visible para la prueba: anon solo lee (RLS SELECT abierto).
    role: "anon",
    from(table) {
      return {
        upsert(row, options) {
          calls.upsert.push({ table, row, options });
          return {
            select: async () => {
              store[table][keyOf(table, row)] = row;
              return { data: [row], error: null };
            },
          };
        },
        select() {
          calls.selectAll.push({ table });
          const allRows = () => Object.values(store[table] || {});
          const query = {
            eq: async (column, value) => {
              calls.selectEq.push({ table, column, value });
              const rows = allRows().filter((r) => r[column] === value);
              return { data: rows, error: null };
            },
          };
          // Listar todo sin filtro: objeto awaitable (then) + eq para filtrar.
          query.then = (resolve, reject) =>
            Promise.resolve({ data: allRows(), error: null }).then(resolve, reject);
          return query;
        },
      };
    },
  };
  return api;
}

// Proof VERIFIED ficticia ligada a una valuationKey (nunca real).
function verifiedProofT7(valuationKey, overrides = {}) {
  return {
    valuationKey,
    topicId: "0.0.123456",
    sequenceNumber: 42,
    consensusTimestamp: "2026-10-16T00:00:00.000000000Z",
    transactionId: "0.0.789@1729000000.123456789",
    status: "VERIFIED",
    ...overrides,
  };
}

describe("T7 RF-07 consultas públicas con anon: por toro y valuationKey", () => {
  it("getBull con anon devuelve el toro y ausencia explícita si no existe", async () => {
    const anon = createMockSupabaseT7();
    const record = aptBullRecord();
    await saveBull(anon, record);
    const writesBefore = anon.calls.upsert.length;
    const found = await getBull(anon, "TORO-T5-001");
    assert.strictEqual(found.record.bullId, "TORO-T5-001");
    // Toro solo: sin proof aún → ausencia explícita de referencia, no verificado.
    assert.strictEqual(found.mirrorUrl, null);
    assert.strictEqual(found.hashscanUrl, null);
    assert.strictEqual(found.unverified, true);
    const missing = await getBull(anon, "TORO-INEXISTENTE-T7");
    assert.strictEqual(missing.record, null);
    assert.strictEqual(missing.mirrorUrl, null);
    assert.strictEqual(missing.hashscanUrl, null);
    assert.strictEqual(missing.unverified, true);
    // Leer no escribe ni exige credenciales de operador.
    assert.strictEqual(anon.calls.upsert.length, writesBefore);
    assert.strictEqual(anon.role, "anon");
  });

  it("findBulls con anon lista toros con ausencia explícita y sin escrituras", async () => {
    const anon = createMockSupabaseT7();
    await saveBull(anon, aptBullRecord());
    const writesBefore = anon.calls.upsert.length;
    const views = await findBulls(anon);
    assert.strictEqual(views.length, 1);
    assert.strictEqual(views[0].record.bullId, "TORO-T5-001");
    assert.strictEqual(views[0].mirrorUrl, null);
    assert.strictEqual(views[0].hashscanUrl, null);
    assert.strictEqual(views[0].unverified, true);
    assert.strictEqual(anon.calls.upsert.length, writesBefore);
  });

  it("findValuationsByBullId con anon adjunta referencia Testnet o ausencia explícita", async () => {
    const anon = createMockSupabaseT7();
    const record = aptValuationRecord();
    await saveValuation(anon, record);
    const writesBefore = anon.calls.upsert.length;
    // Sin proof → ausencia explícita + no verificado.
    const pending = await findValuationsByBullId(anon, record.bullId);
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].record.valuationKey, record.valuationKey);
    assert.strictEqual(pending[0].mirrorUrl, null);
    assert.strictEqual(pending[0].hashscanUrl, null);
    assert.strictEqual(pending[0].unverified, true);
    // Con proof VERIFIED → referencia mirror/HashScan Testnet construida (sin red).
    const withRef = await findValuationsByBullId(anon, record.bullId, {
      [record.valuationKey]: verifiedProofT7(record.valuationKey),
    });
    assert.ok(withRef[0].mirrorUrl.includes("testnet.mirrornode.hedera.com"));
    assert.ok(withRef[0].hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    assert.strictEqual(withRef[0].unverified, false);
    // Toro sin valuaciones → lista vacía (ausencia explícita), sin escrituras.
    const empty = await findValuationsByBullId(anon, "TORO-SIN-VALUACIONES");
    assert.deepStrictEqual(empty, []);
    assert.strictEqual(anon.calls.upsert.length, writesBefore);
  });

  it("getValuation/getProof con anon devuelven referencia Testnet o ausencia explícita", async () => {
    const anon = createMockSupabaseT7();
    const record = aptValuationRecord();
    await saveValuation(anon, record);
    await saveProof(anon, { ...verifiedProofT7(record.valuationKey), status: "PENDING" }, { status: "PENDING" });
    const writesBefore = anon.calls.upsert.length;
    const noProof = await getValuation(anon, record.valuationKey);
    assert.strictEqual(noProof.mirrorUrl, null);
    assert.strictEqual(noProof.unverified, true);
    const withProof = await getValuation(anon, record.valuationKey, verifiedProofT7(record.valuationKey));
    assert.ok(withProof.mirrorUrl.includes("testnet.mirrornode.hedera.com"));
    assert.ok(withProof.hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    assert.strictEqual(withProof.unverified, false);
    const proofView = await getProof(anon, record.valuationKey);
    assert.strictEqual(proofView.record.valuationKey, record.valuationKey);
    assert.strictEqual(proofView.unverified, true);
    const missingVal = await getValuation(anon, "clave-inexistente-t7");
    assert.strictEqual(missingVal.record, null);
    assert.strictEqual(missingVal.unverified, true);
    const missingProof = await getProof(anon, "clave-inexistente-t7");
    assert.strictEqual(missingProof.record, null);
    assert.strictEqual(missingProof.unverified, true);
    assert.strictEqual(anon.calls.upsert.length, writesBefore);
  });
});

describe("T7 RF-07 consultas públicas con anon: por listingId/purchaseId y estado", () => {
  it("getListing/getPurchase con anon devuelven referencia o ausencia explícita", async () => {
    const anon = createMockSupabaseT7();
    const listing = {
      listingId: "LIST-T7-001",
      valuationKey: "VAL-T7-001",
      assetType: "PAJ_BRAF",
      unitPriceUsd: 12.25,
      quantity: 20,
    };
    await saveListing(anon, listing, "VERIFIED");
    await savePurchase(anon, purchaseMovement({ listingId: "LIST-T7-001", purchaseId: "BUY-T7-001", valuationKey: "VAL-T7-001" }));
    const writesBefore = anon.calls.upsert.length;
    const proof = verifiedProofT7("VAL-T7-001");
    const listingView = await getListing(anon, "LIST-T7-001", proof);
    assert.strictEqual(listingView.record.listingId, "LIST-T7-001");
    assert.ok(listingView.mirrorUrl.includes("testnet.mirrornode.hedera.com"));
    assert.ok(listingView.hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    assert.strictEqual(listingView.unverified, false);
    const listingBare = await getListing(anon, "LIST-T7-001");
    assert.strictEqual(listingBare.mirrorUrl, null);
    assert.strictEqual(listingBare.unverified, true);
    const purchaseView = await getPurchase(anon, "BUY-T7-001", proof);
    assert.strictEqual(purchaseView.record.purchaseId, "BUY-T7-001");
    assert.ok(purchaseView.mirrorUrl.includes("testnet.mirrornode.hedera.com"));
    assert.strictEqual(purchaseView.unverified, false);
    const missingListing = await getListing(anon, "LIST-INEXISTENTE-T7");
    assert.strictEqual(missingListing.record, null);
    assert.strictEqual(missingListing.mirrorUrl, null);
    assert.strictEqual(missingListing.unverified, true);
    const missingPurchase = await getPurchase(anon, "BUY-INEXISTENTE-T7");
    assert.strictEqual(missingPurchase.record, null);
    assert.strictEqual(missingPurchase.unverified, true);
    // Solo lecturas: cero escrituras nuevas y rol anon sin credenciales.
    assert.strictEqual(anon.calls.upsert.length, writesBefore);
    assert.strictEqual(anon.role, "anon");
  });

  it("findProofsByStatus con anon filtra por estado con referencia y vacío explícito", async () => {
    const anon = createMockSupabaseT7();
    await saveProof(anon, pendingProof({ valuationKey: "VAL-T7-A", status: "PENDING" }), { status: "PENDING" });
    await saveProof(anon, pendingProof({ valuationKey: "VAL-T7-B", status: "VERIFIED" }), { status: "VERIFIED" });
    const writesBefore = anon.calls.upsert.length;
    const pending = await findProofsByStatus(anon, "PENDING");
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].record.valuationKey, "VAL-T7-A");
    assert.strictEqual(pending[0].unverified, true);
    assert.ok(pending[0].mirrorUrl.includes("testnet.mirrornode.hedera.com"));
    const verified = await findProofsByStatus(anon, "VERIFIED");
    assert.strictEqual(verified.length, 1);
    assert.strictEqual(verified[0].unverified, false);
    assert.ok(verified[0].hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    // Estado sin filas → ausencia explícita como lista vacía, sin escrituras.
    const mismatch = await findProofsByStatus(anon, "MISMATCH");
    assert.deepStrictEqual(mismatch, []);
    assert.strictEqual(anon.calls.upsert.length, writesBefore);
  });
});
