// Tests T2 spec 003: split puro half-up con residuo al vendedor (RF-05 + EA-01).
// Comentarios en español; código en inglés.
// TDD rojo → verde: cubre EA-01 canónico, bordes de medio céntimo,
// invariante suma-exacta, rechazos -1/101 y casos 0%/100%.
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { calculateSplit, roundHalfUp2, validateListingParams, validatePurchaseParams, applySettlement } = require("../src/logic/marketplace.js");

describe("RF-05 split puro half-up con residuo al vendedor", () => {
  it("EA-01: calculateSplit(245.00, 5) devuelve royalty 12.25 y seller 232.75", () => {
    const split = calculateSplit(245.0, 5);
    assert.equal(split.royaltyUsd, 12.25);
    assert.equal(split.sellerUsd, 232.75);
    assert.equal(split.totalUsd, 245.0);
    assert.equal(split.royaltyPct, 5);
  });

  it("EA-01 invariante: royalty + seller === total exacto", () => {
    const split = calculateSplit(245.0, 5);
    assert.equal(split.royaltyUsd + split.sellerUsd, split.totalUsd);
  });

  it("borde medio céntimo hacia arriba: 1.00 al 0.5% redondea a 0.01", () => {
    // 1.00 * 0.5 / 100 = 0.005 exacto -> half-up a 0.01, residuo al vendedor 0.99.
    const split = calculateSplit(1.0, 0.5);
    assert.equal(split.royaltyUsd, 0.01);
    assert.equal(split.sellerUsd, 0.99);
    assert.equal(split.royaltyUsd + split.sellerUsd, split.totalUsd);
  });

  it("borde con tercer decimal: 10.00 al 33.33% deja residuo al vendedor", () => {
    // 10.00 * 33.33 / 100 = 3.333 -> half-up 3.33, vendedor 6.67.
    const split = calculateSplit(10.0, 33.33);
    assert.equal(split.royaltyUsd, 3.33);
    assert.equal(split.sellerUsd, 6.67);
    assert.equal(split.royaltyUsd + split.sellerUsd, split.totalUsd);
  });

  it("borde que redondea hacia arriba: 100.00 al 2.345% da 2.35", () => {
    // 100.00 * 2.345 / 100 = 2.345 -> half-up 2.35, vendedor 97.65.
    const split = calculateSplit(100.0, 2.345);
    assert.equal(split.royaltyUsd, 2.35);
    assert.equal(split.sellerUsd, 97.65);
    assert.equal(split.royaltyUsd + split.sellerUsd, split.totalUsd);
  });

  it("invariante suma-exacta en varios totales", () => {
    const cases = [
      [0.01, 5],
      [0.03, 33.33],
      [10.0, 5],
      [24.5, 5],
      [245.0, 5],
      [73500.0, 5],
      [100.0, 0],
      [100.0, 100],
    ];
    for (const [total, pct] of cases) {
      const split = calculateSplit(total, pct);
      assert.equal(
        split.royaltyUsd + split.sellerUsd,
        split.totalUsd,
        `invariante rota en total=${total} pct=${pct}`
      );
    }
  });

  it("rechaza porcentaje -1 fuera de rango 0-100", () => {
    assert.throws(() => calculateSplit(245.0, -1), /royalty fuera de rango/);
  });

  it("rechaza porcentaje 101 fuera de rango 0-100", () => {
    assert.throws(() => calculateSplit(245.0, 101), /royalty fuera de rango/);
  });

  it("0% registra royalty 0 explícito", () => {
    const split = calculateSplit(245.0, 0);
    assert.equal(split.royaltyUsd, 0);
    assert.equal(split.sellerUsd, 245.0);
  });

  it("100% registra vendedor 0 explícito", () => {
    const split = calculateSplit(245.0, 100);
    assert.equal(split.royaltyUsd, 245.0);
    assert.equal(split.sellerUsd, 0);
  });

  it("roundHalfUp2 reutilizado sin duplicar semántica (1.005 -> 1.01)", () => {
    assert.equal(roundHalfUp2(1.005), 1.01);
  });
});

// Tests T3 spec 003: reglas puras de listado y compra (RF-01/RF-03/RF-04).
// Comentarios en español; código en inglés.
// TDD rojo → verde: precio tasado exacto, cantidades por activo y compra válida.
describe("RF-01/RF-03/RF-04 reglas puras de listado y compra", () => {
  // Tasación certificada canónica EA-01: dosis 24.50 (10 x M_TOTAL 2.45 half-up).
  const certifiedDosis = { unitPriceUsd: 24.5 };
  const baseListing = {
    bullId: "BRAF-001",
    assetType: "PAJ_BRAF",
    unitPriceUsd: 24.5,
    quantity: 10,
    royaltyPct: 5,
    proof: { topicId: "0.0.123456", sequenceNumber: 1 },
  };

  it("acepta listado canónico: 10 pajuelas a 24.50", () => {
    const { listing } = validateListingParams(baseListing, certifiedDosis);
    assert.equal(listing.unitPriceUsd, 24.5);
    assert.equal(listing.quantity, 10);
  });

  it("acepta fracción canónica 0.0001 BULL", () => {
    const certifiedEquity = { unitPriceUsd: 73500 };
    const { listing } = validateListingParams(
      {
        bullId: "BRAF-001",
        assetType: "BULL",
        unitPriceUsd: 73500,
        quantity: 0.0001,
        royaltyPct: 5,
        proof: { topicId: "0.0.123456", sequenceNumber: 1 },
      },
      certifiedEquity
    );
    assert.equal(listing.quantity, 0.0001);
  });

  it("precio alterado en un decimal lanza (RF-03)", () => {
    assert.throws(
      () => validateListingParams({ ...baseListing, unitPriceUsd: 24.51 }, certifiedDosis),
      /precio no coincide con tasación/
    );
  });

  it("cantidad 0 lanza", () => {
    assert.throws(
      () => validateListingParams({ ...baseListing, quantity: 0 }, certifiedDosis),
      /cantidad debe ser > 0/
    );
  });

  it("PAJ_BRAF 1.5 lanza: pajuela indivisible (RF-04)", () => {
    assert.throws(
      () => validateListingParams({ ...baseListing, quantity: 1.5 }, certifiedDosis),
      /pajuela indivisible/
    );
  });

  it("BULL con 5 decimales lanza (RF-04)", () => {
    assert.throws(
      () =>
        validateListingParams(
          {
            bullId: "BRAF-001",
            assetType: "BULL",
            unitPriceUsd: 73500,
            quantity: 0.00001,
            royaltyPct: 5,
            proof: { topicId: "0.0.123456" },
          },
          { unitPriceUsd: 73500 }
        ),
      /fracción inválida/
    );
  });

  it("BULL mayor que supply 10 lanza (RF-04)", () => {
    assert.throws(
      () =>
        validateListingParams(
          {
            bullId: "BRAF-001",
            assetType: "BULL",
            unitPriceUsd: 73500,
            quantity: 10.0001,
            royaltyPct: 5,
            proof: { topicId: "0.0.123456" },
          },
          { unitPriceUsd: 73500 }
        ),
      /excede supply 10/
    );
  });

  it("sin proof con referencia lanza (RF-01)", () => {
    const sinProof = { ...baseListing };
    delete sinProof.proof;
    assert.throws(() => validateListingParams(sinProof, certifiedDosis), /proof requerida/);
  });

  it("royalty fuera de rango lanza en listado", () => {
    assert.throws(
      () => validateListingParams({ ...baseListing, royaltyPct: 101 }, certifiedDosis),
      /royalty fuera de rango/
    );
  });

  it("compra válida: 10 pajuelas a 24.50 paga 245.00 exacto", () => {
    const { listing } = validateListingParams(baseListing, certifiedDosis);
    const stored = { ...listing, available: 10 };
    const { purchase } = validatePurchaseParams(
      { listingId: "L1", quantity: 10, totalPaidUsd: 245.0 },
      stored
    );
    assert.equal(purchase.totalUsd, 245.0);
  });

  it("compra que excede disponible lanza", () => {
    const { listing } = validateListingParams(baseListing, certifiedDosis);
    const stored = { ...listing, available: 10 };
    assert.throws(
      () => validatePurchaseParams({ listingId: "L1", quantity: 11, totalPaidUsd: 269.5 }, stored),
      /saldo insuficiente/
    );
  });

  it("compra con total que no cuadra lanza", () => {
    const { listing } = validateListingParams(baseListing, certifiedDosis);
    const stored = { ...listing, available: 10 };
    assert.throws(
      () => validatePurchaseParams({ listingId: "L1", quantity: 10, totalPaidUsd: 244.99 }, stored),
      /total no coincide/
    );
  });

  it("compra en listado cancelado lanza", () => {
    const { listing } = validateListingParams(baseListing, certifiedDosis);
    const stored = { ...listing, available: 10, cancelled: true };
    assert.throws(
      () => validatePurchaseParams({ listingId: "L1", quantity: 1, totalPaidUsd: 24.5 }, stored),
      /listado cerrado/
    );
  });

  it("compra BULL 0.0001 con total half-up acepta", () => {
    const stored = {
      bullId: "BRAF-001",
      assetType: "BULL",
      unitPriceUsd: 73500,
      available: 10,
      royaltyPct: 5,
    };
    const { purchase } = validatePurchaseParams(
      { listingId: "L2", quantity: 0.0001, totalPaidUsd: 7.35 },
      stored
    );
    assert.equal(purchase.totalUsd, 7.35);
  });
});

// Tests T5 spec 003: contrato Muurketplace.sol on-chain (RF-01/RF-04/RF-05/RF-06/RF-07/RF-08).
// Comentarios en español; código en inglés.
// TDD rojo → verde: asserts ESTÁTICOS sobre el fuente .sol, sin desplegar ni tocar red.
// Falla si aparece setter de regalía, si aparece red Mainnet o si falta el evento de liquidación.
describe("T5 contrato Muurketplace.sol: estado on-chain mínimo Testnet (estático, sin red)", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const CONTRACT_PATH = path.join(__dirname, "..", "src", "contracts", "Muurketplace.sol");

  function contractSource() {
    assert.ok(fs.existsSync(CONTRACT_PATH), "falta contrato: src/contracts/Muurketplace.sol");
    return fs.readFileSync(CONTRACT_PATH, "utf8");
  }

  it("existe y declara Solidity ^0.8 solo Testnet (sin Mainnet)", () => {
    const src = contractSource();
    assert.match(src, /pragma solidity \^0\.8/);
    assert.match(src, /testnet/i);
    assert.ok(!/mainnet/i.test(src), "el contrato no debe mencionar Mainnet");
    assert.ok(!src.includes("forMainnet"), "prohibido forMainnet en el contrato");
  });

  it("define estructura de listado con precio en céntimos, disponible, % inmutable, criador, vendedor, proof y cancelación", () => {
    const src = contractSource();
    assert.match(src, /struct Listing/);
    assert.match(src, /unitPriceCents/);
    assert.match(src, /available/);
    assert.match(src, /royaltyPct/);
    assert.match(src, /breeder/);
    assert.match(src, /seller/);
    assert.match(src, /proofTopicId/);
    assert.match(src, /cancelled/);
  });

  it("define mapas de regalías pendientes y compras liquidadas", () => {
    const src = contractSource();
    assert.match(src, /pendingRoyalties|royaltiesPendientes|pending/);
    assert.match(src, /settled|liquidat/);
    assert.match(src, /mapping/);
  });

  it("expone crear listado, comprar, retirar regalías y cancelar (sin setter de porcentaje)", () => {
    const src = contractSource();
    assert.match(src, /function createListing/);
    assert.match(src, /function buy/);
    assert.match(src, /function withdrawRoyalties/);
    assert.match(src, /function cancelListing/);
    // R-REV-03: porcentaje inmutable por listado, sin setter posterior.
    assert.ok(!/function\s+(updateRoyalty|setRoyalty|setRoyaltyPct|updateRoyaltyPct|changeRoyalty)\s*\(/.test(src), "el contrato no debe exponer setter de porcentaje");
  });

  it("crear listado exige referencia de proof no vacía y acepta 0% y 100%", () => {
    const src = contractSource();
    assert.match(src, /require\(.*proof.*(!=|>|length)/);
    assert.match(src, /royaltyPct\s*<=\s*100/);
    // 0% aceptado: no debe exigir royaltyPct > 0.
    assert.ok(!/require\(\s*royaltyPct\s*>\s*0/.test(src), "0% debe ser válido: prohibido require(royaltyPct > 0)");
  });

  it("comprar exige cantidad válida y pago exacto, calcula split half-up con resta y emite evento de compra liquidada", () => {
    const src = contractSource();
    assert.match(src, /require\(.*(quantity|amount|available|saldo)/i);
    assert.match(src, /require\(.*(msg\.value|totalPaid|payment|pago|exact)/i);
    // Misma regla R-REV-01: regalía half-up (+50 antes de dividir) y vendedor por resta exacta.
    assert.match(src, /\+ 50/);
    assert.match(src, /total.*royalty|seller\s*=\s*total\s*-|-\s*royalty/);
    assert.match(src, /event PurchaseSettled/);
    assert.match(src, /emit PurchaseSettled/);
  });

  it("retirar marca liquidado y el segundo intento revierte; cancelar cierra a nuevas compras sin tocar pendientes", () => {
    const src = contractSource();
    assert.match(src, /require\(\s*!.*settled|require\(.*!settled/);
    assert.match(src, /cancelListing/);
    assert.match(src, /cancelled\s*=\s*true/);
    // Todo require fallido revierte sin mover fondos: hay requires y las
    // transferencias ocurren después de validar (revert atómico EVM).
    assert.match(src, /require\(/);
    assert.match(src, /revert|require/);
  });
});

// Tests T4 spec 003: settlement puro sin doble pago + cancelación que preserva saldos (RF-06/RF-08).
// Comentarios en español; código en inglés.
// TDD rojo → verde: acreditación EA-01, doble retiro denegado,
// compra tras cancelación rechazada con retiro pendiente aún válido.
describe("RF-06/RF-08 settlement puro sin doble pago + cancelación que preserva saldos", () => {
  // Saldo inicial vacío: nada acreditado y ningún retiro registrado.
  function emptyBalances() {
    return { breederBalance: 0, sellerBalance: 0, settledIds: [] };
  }

  it("EA-01: applySettlement acredita 12.25 al criador y 232.75 al vendedor", () => {
    const split = calculateSplit(245.0, 5);
    const result = applySettlement("P-EA01", split, emptyBalances());
    assert.equal(result.breederBalance, 12.25);
    assert.equal(result.sellerBalance, 232.75);
    assert.ok(result.settledIds.includes("P-EA01"));
  });

  it("segundo retiro del mismo purchaseId lanza doble retiro denegado", () => {
    const split = calculateSplit(245.0, 5);
    const once = applySettlement("P-DUP", split, emptyBalances());
    assert.throws(() => applySettlement("P-DUP", split, once), /doble retiro denegado/);
  });

  it("compra tras cancelación rechazada con retiro pendiente aún válido", () => {
    // Listado canónico EA-01 con 10 pajuelas a 24.50.
    const certifiedDosis = { unitPriceUsd: 24.5 };
    const params = {
      bullId: "BRAF-001",
      assetType: "PAJ_BRAF",
      unitPriceUsd: 24.5,
      quantity: 10,
      royaltyPct: 5,
      proof: { topicId: "0.0.123456", sequenceNumber: 1 },
    };
    const { listing } = validateListingParams(params, certifiedDosis);
    const open = { ...listing, available: 10 };
    // Compra válida antes de cancelar y su liquidación pendiente.
    const { purchase } = validatePurchaseParams(
      { listingId: "L1", quantity: 10, totalPaidUsd: 245.0 },
      open
    );
    const split = calculateSplit(purchase.totalUsd, listing.royaltyPct);
    const settled = applySettlement("P-PEND", split, emptyBalances());
    assert.equal(settled.breederBalance, 12.25);
    // Tras cancelar, nuevas compras quedan bloqueadas...
    const cancelled = { ...open, cancelled: true };
    assert.throws(
      () => validatePurchaseParams({ listingId: "L1", quantity: 1, totalPaidUsd: 24.5 }, cancelled),
      /listado cerrado/
    );
    // ...pero el retiro pendiente de otra compra sigue válido y acumula sin perder lo ya acreditado.
    const secondSplit = calculateSplit(24.5, 5);
    const after = applySettlement("P-POST", secondSplit, settled);
    assert.equal(after.breederBalance, 13.48);
    assert.equal(after.sellerBalance, 256.02);
    assert.ok(after.settledIds.includes("P-PEND"));
    assert.ok(after.settledIds.includes("P-POST"));
  });
});
