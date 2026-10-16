// Tests T4 (Spec 005): reglas puras de compra y composición del resultado
// (RF-07, RF-08, RF-09). Comentarios en español; código en inglés.
// TDD: rojo antes de implementar. Sin SDK, sin red, sin process.env.
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { validatePurchaseInput, composePurchaseResult } = require("../src/logic/purchaseRules.js");

// Listado PAJ_BRAF canónico EA-01: 10 pajuelas a $24.50 con 5% de regalía.
function pajListing(overrides = {}) {
  return {
    assetType: "PAJ_BRAF",
    unitPriceUsd: 24.5,
    royaltyPct: 5,
    available: 10,
    cancelled: false,
    ...overrides,
  };
}

// Listado BULL canónico: equity fraccionable a $73,500 con 5% de regalía.
function bullListing(overrides = {}) {
  return {
    assetType: "BULL",
    unitPriceUsd: 73500,
    royaltyPct: 5,
    available: 10,
    cancelled: false,
    ...overrides,
  };
}

describe("T4 RF-07/RF-08 validatePurchaseInput: aceptación por activo", () => {
  it("RF-07 acepta PAJ_BRAF entero: 10 pajuelas a 24.50 → total 245.00", () => {
    const { purchase } = validatePurchaseInput(
      { listingId: "L1", assetType: "PAJ_BRAF", quantity: 10, unitPriceUsd: 24.5 },
      pajListing()
    );
    assert.equal(purchase.totalUsd, 245.0);
    assert.equal(purchase.quantity, 10);
    assert.equal(purchase.assetType, "PAJ_BRAF");
  });

  it("RF-08 acepta fracción BULL de 4 decimales: 0.0001 a 73500 → total 7.35", () => {
    const { purchase } = validatePurchaseInput(
      { listingId: "L2", assetType: "BULL", quantity: 0.0001, unitPriceUsd: 73500 },
      bullListing()
    );
    assert.equal(purchase.totalUsd, 7.35);
  });

  it("RF-08 acepta BULL en el límite de supply: 10 unidades", () => {
    const { purchase } = validatePurchaseInput(
      { listingId: "L2", assetType: "BULL", quantity: 10, unitPriceUsd: 73500 },
      bullListing()
    );
    assert.equal(purchase.quantity, 10);
  });
});

describe("T4 RF-09 rechazos pre-red (sin ejecutar transacción)", () => {
  it("rechaza PAJ_BRAF fraccionado (1.5)", () => {
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "L1", assetType: "PAJ_BRAF", quantity: 1.5, unitPriceUsd: 24.5 },
          pajListing()
        ),
      /pajuela indivisible/
    );
  });

  it("rechaza BULL con más de 4 decimales (0.00001)", () => {
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "L2", assetType: "BULL", quantity: 0.00001, unitPriceUsd: 73500 },
          bullListing()
        ),
      /fracción inválida/
    );
  });

  it("rechaza BULL que excede el supply 10 (10.0001)", () => {
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "L2", assetType: "BULL", quantity: 10.0001, unitPriceUsd: 73500 },
          bullListing({ available: 100 })
        ),
      /excede supply 10/
    );
  });

  it("rechaza cantidad que excede el disponible del listado", () => {
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "L1", assetType: "PAJ_BRAF", quantity: 11, unitPriceUsd: 24.5 },
          pajListing()
        ),
      /saldo insuficiente/
    );
  });

  it("rechaza precio unitario 0 (regla de listado de 003)", () => {
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "L1", assetType: "PAJ_BRAF", quantity: 1, unitPriceUsd: 0 },
          pajListing()
        ),
      /precio debe ser > 0/
    );
  });

  it("rechaza precio unitario negativo o no finito", () => {
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "L1", assetType: "PAJ_BRAF", quantity: 1, unitPriceUsd: -1 },
          pajListing()
        ),
      /precio debe ser > 0/
    );
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "L1", assetType: "PAJ_BRAF", quantity: 1, unitPriceUsd: Number.NaN },
          pajListing()
        ),
      /precio debe ser > 0/
    );
  });

  it("rechaza listado cancelado", () => {
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "L1", assetType: "PAJ_BRAF", quantity: 1, unitPriceUsd: 24.5 },
          pajListing({ cancelled: true })
        ),
      /listado cerrado/
    );
  });

  it("rechaza listingId vacío", () => {
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "  ", assetType: "PAJ_BRAF", quantity: 1, unitPriceUsd: 24.5 },
          pajListing()
        ),
      /listingId requerido/
    );
  });
});

describe("T4 reutilización de la regla de 003 (sin duplicar)", () => {
  it("marketplace.js exporta assertQuantityForAsset y countDecimals (T4 solo exports)", () => {
    const marketplace = require("../src/logic/marketplace.js");
    assert.equal(typeof marketplace.assertQuantityForAsset, "function");
    assert.equal(typeof marketplace.countDecimals, "function");
    // La comparación de rechazo de cantidad coincide con la regla de 003.
    assert.throws(() => marketplace.assertQuantityForAsset(1.5, "PAJ_BRAF"), /pajuela indivisible/);
    assert.throws(() => marketplace.assertQuantityForAsset(0.00001, "BULL"), /fracción inválida/);
    assert.equal(marketplace.countDecimals(0.0001), 4);
  });

  it("reutiliza roundHalfUp2 de marketplace.js para el total", () => {
    const { roundHalfUp2 } = require("../src/logic/marketplace.js");
    const { purchase } = validatePurchaseInput(
      { listingId: "L1", assetType: "PAJ_BRAF", quantity: 10, unitPriceUsd: 24.5 },
      pajListing()
    );
    assert.equal(purchase.totalUsd, roundHalfUp2(24.5 * 10));
  });
});

describe("T4 NB-2/NB-3 coherencia con el listado", () => {
  it("NB-2 rechaza precio divergente del listado (24.51 vs 24.50)", () => {
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "L1", assetType: "PAJ_BRAF", quantity: 10, unitPriceUsd: 24.51 },
          pajListing()
        ),
      /precio no coincide con el listado/
    );
  });

  it("NB-2 acepta precio idéntico al del listado", () => {
    const { purchase } = validatePurchaseInput(
      { listingId: "L1", assetType: "PAJ_BRAF", quantity: 10, unitPriceUsd: 24.5 },
      pajListing()
    );
    assert.equal(purchase.totalUsd, 245.0);
  });

  it("NB-2 sin unitPriceUsd en el listado no rompe compras válidas (compatibilidad)", () => {
    const listingSinPrecio = { assetType: "PAJ_BRAF", royaltyPct: 5, available: 10, cancelled: false };
    const { purchase } = validatePurchaseInput(
      { listingId: "L1", assetType: "PAJ_BRAF", quantity: 10, unitPriceUsd: 24.5 },
      listingSinPrecio
    );
    assert.equal(purchase.totalUsd, 245.0);
  });

  it("NB-3 rechaza assetType de la compra distinto al del listado", () => {
    assert.throws(
      () =>
        validatePurchaseInput(
          { listingId: "L1", assetType: "BULL", quantity: 1, unitPriceUsd: 24.5 },
          pajListing()
        ),
      /activo no coincide con el listado/
    );
  });

  it("NB-3 acepta assetType coincidente con el listado", () => {
    const { purchase } = validatePurchaseInput(
      { listingId: "L2", assetType: "BULL", quantity: 1, unitPriceUsd: 73500 },
      bullListing()
    );
    assert.equal(purchase.assetType, "BULL");
  });
});

describe("T4 composePurchaseResult: salida de compra", () => {
  function receipt(overrides = {}) {
    return {
      atomicTxId: "0.0.999999@1.2",
      purchaseId: "PURCHASE-001",
      buyerBalanceBase: 10n,
      sellerBalanceBase: 290n,
      ...overrides,
    };
  }

  it("compone purchaseId, atomicTxId, split, balances y hashscanUrl", () => {
    const split = { totalUsd: 245.0, royaltyUsd: 12.25, sellerUsd: 232.75 };
    const result = composePurchaseResult(receipt(), split);
    assert.equal(result.purchaseId, "PURCHASE-001");
    assert.equal(result.atomicTxId, "0.0.999999@1.2");
    assert.deepEqual(result.split, split);
    assert.deepEqual(result.balances, { buyer: 10n, seller: 290n });
    assert.ok(result.hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    assert.ok(result.hashscanUrl.includes("0.0.999999@1.2"));
  });

  it("lanza si falta atomicTxId (sin receipt no hay compra atómica)", () => {
    assert.throws(
      () => composePurchaseResult(receipt({ atomicTxId: "" }), {}),
      /atomicTxId/
    );
    assert.throws(() => composePurchaseResult(receipt({ atomicTxId: undefined }), {}), /atomicTxId/);
  });

  it("lanza si falta purchaseId", () => {
    assert.throws(() => composePurchaseResult(receipt({ purchaseId: "" }), {}), /purchaseId/);
    assert.throws(() => composePurchaseResult(receipt({ purchaseId: undefined }), {}), /purchaseId/);
  });

  it("lanza si el receipt no es objeto", () => {
    assert.throws(() => composePurchaseResult(null, {}), /recibo/);
  });
});
