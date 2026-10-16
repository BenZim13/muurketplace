// Tests T3 (Spec 005): mensaje canónico de compra en HCS y coincidencia pura
// (RF-13, RF-14, RF-16). Comentarios en español; código en inglés.
// TDD: rojo antes de implementar. Sin SDK, sin red, sin process.env:
// publishedAt llega por parámetro (pureza, RNF-01).
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPurchaseMessage,
  verifyPurchaseMessageContent,
} = require("../src/logic/purchaseMessage.js");

// Compra canónica EA-01 (coherente con la Spec 003): 10 pajuelas a $24.50.
function canonicalPurchase(overrides = {}) {
  return {
    bullId: "BRAF-001",
    assetType: "PAJ_BRAF",
    tokenId: "0.0.111111",
    quantity: 10,
    listingId: "LISTING-001",
    purchaseId: "PURCHASE-001",
    buyerAccountId: "0.0.777777",
    sellerAccountId: "0.0.999999",
    atomicTxId: "0.0.999999@1.2",
    ...overrides,
  };
}

const PUBLISHED_AT = "2026-10-16T00:00:00.000Z";

describe("T3 RF-13/RF-14 buildPurchaseMessage: mensaje canónico discriminado", () => {
  it("caso canónico produce kind purchase, specVersion 005 y schemaVersion 1", () => {
    const { message } = buildPurchaseMessage(canonicalPurchase(), { publishedAt: PUBLISHED_AT });
    assert.equal(message.kind, "purchase");
    assert.equal(message.specVersion, "005");
    assert.equal(message.schemaVersion, 1);
  });

  it("copia los campos de la compra y el publishedAt por parámetro", () => {
    const { message } = buildPurchaseMessage(canonicalPurchase(), { publishedAt: PUBLISHED_AT });
    assert.equal(message.bullId, "BRAF-001");
    assert.equal(message.assetType, "PAJ_BRAF");
    assert.equal(message.tokenId, "0.0.111111");
    assert.equal(message.quantity, 10);
    assert.equal(message.listingId, "LISTING-001");
    assert.equal(message.purchaseId, "PURCHASE-001");
    assert.equal(message.buyerAccountId, "0.0.777777");
    assert.equal(message.sellerAccountId, "0.0.999999");
    assert.equal(message.atomicTxId, "0.0.999999@1.2");
    assert.equal(message.publishedAt, PUBLISHED_AT);
  });

  it("purchaseKey es sha256 hex de 64 caracteres y está en mensaje y retorno", () => {
    const { message, purchaseKey } = buildPurchaseMessage(canonicalPurchase(), {
      publishedAt: PUBLISHED_AT,
    });
    assert.match(purchaseKey, /^[0-9a-f]{64}$/);
    assert.equal(message.purchaseKey, purchaseKey);
  });

  it("canonicalJson ordena claves: assetType antes de kind y purchaseKey al final por orden", () => {
    const { canonicalJson } = buildPurchaseMessage(canonicalPurchase(), {
      publishedAt: PUBLISHED_AT,
    });
    assert.equal(typeof canonicalJson, "string");
    assert.ok(canonicalJson.indexOf('"kind":"purchase"') !== -1);
    assert.ok(canonicalJson.indexOf('"specVersion":"005"') !== -1);
    assert.ok(canonicalJson.indexOf('"purchaseKey":"') !== -1);
    // Orden canónico alfabético: assetType precede a kind.
    assert.ok(canonicalJson.indexOf('"assetType"') < canonicalJson.indexOf('"kind"'));
  });

  it("determinista: mismo input → mismo canonicalJson y purchaseKey", () => {
    const first = buildPurchaseMessage(canonicalPurchase(), { publishedAt: PUBLISHED_AT });
    const second = buildPurchaseMessage(canonicalPurchase(), { publishedAt: PUBLISHED_AT });
    assert.equal(second.canonicalJson, first.canonicalJson);
    assert.equal(second.purchaseKey, first.purchaseKey);
  });

  it("un campo cambiado (quantity 10→11) produce purchaseKey distinta", () => {
    const base = buildPurchaseMessage(canonicalPurchase(), { publishedAt: PUBLISHED_AT });
    const changed = buildPurchaseMessage(canonicalPurchase({ quantity: 11 }), {
      publishedAt: PUBLISHED_AT,
    });
    assert.notEqual(changed.purchaseKey, base.purchaseKey);
  });

  it("assetType inválido lanza activo inválido", () => {
    assert.throws(
      () => buildPurchaseMessage(canonicalPurchase({ assetType: "NFT" }), { publishedAt: PUBLISHED_AT }),
      /activo inválido/
    );
  });

  it("publishedAt ausente lanza publishedAt requerido", () => {
    assert.throws(() => buildPurchaseMessage(canonicalPurchase(), {}), /publishedAt requerido/);
  });

  it("acepta assetType BULL", () => {
    const { message } = buildPurchaseMessage(
      canonicalPurchase({ assetType: "BULL", quantity: 0.0001 }),
      { publishedAt: PUBLISHED_AT }
    );
    assert.equal(message.assetType, "BULL");
    assert.equal(message.quantity, 0.0001);
  });
});

describe("T3 RF-16 verifyPurchaseMessageContent: VERIFIED vs MISMATCH", () => {
  function built() {
    return buildPurchaseMessage(canonicalPurchase(), { publishedAt: PUBLISHED_AT });
  }

  it("mensaje idéntico → VERIFIED", () => {
    const { message, canonicalJson } = built();
    const result = verifyPurchaseMessageContent(canonicalJson, message);
    assert.equal(result.status, "VERIFIED");
  });

  it("acepta ambos lados como objeto", () => {
    const { message } = built();
    const result = verifyPurchaseMessageContent(message, message);
    assert.equal(result.status, "VERIFIED");
  });

  it("campo alterado (quantity 10 vs 11) → MISMATCH con diff", () => {
    const { message } = built();
    const retrieved = JSON.parse(JSON.stringify(message));
    retrieved.quantity = 11;
    const result = verifyPurchaseMessageContent(retrieved, message);
    assert.equal(result.status, "MISMATCH");
    assert.ok(Array.isArray(result.diff));
    assert.ok(result.diff.some((d) => d.includes("quantity")));
  });

  it("RF-13 discriminador: specVersion 001 (mensaje de tasación de 002) → MISMATCH", () => {
    const { message } = built();
    const retrieved = JSON.parse(JSON.stringify(message));
    retrieved.specVersion = "001";
    const result = verifyPurchaseMessageContent(retrieved, message);
    assert.equal(result.status, "MISMATCH");
    assert.ok(Array.isArray(result.diff));
  });

  it("RF-13 discriminador: kind distinto de purchase → MISMATCH", () => {
    const { message } = built();
    const retrieved = JSON.parse(JSON.stringify(message));
    retrieved.kind = "valuation";
    const result = verifyPurchaseMessageContent(retrieved, message);
    assert.equal(result.status, "MISMATCH");
  });

  it("mensaje de tasación de 002 completo (specVersion 001) nunca VERIFIED", () => {
    const { message } = built();
    const valuation = {
      specVersion: "001",
      schemaVersion: 1,
      bullId: "BRAF-001",
      mTotal: 2.45,
      valuationKey: "x",
    };
    const result = verifyPurchaseMessageContent(valuation, message);
    assert.equal(result.status, "MISMATCH");
  });
});
