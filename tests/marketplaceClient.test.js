"use strict";

// Tests T6 spec 003: client listar y comprar con guarda VERIFIED (RF-01/RF-02/RF-04).
// Comentarios en español; código en inglés.
// TDD rojo → verde: mocks inyectados sin red (verifyFn, contractExec).
// Criterio: proof no-VERIFIED deja contractExec en 0 llamadas;
// proof VERIFIED deja exactamente 1 llamada con identificadores y transacción.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { createListing, buy } = require("../src/hedera/marketplaceClient.js");

// Tasación certificada canónica EA-01: dosis 24.50 (M_TOTAL 2.45 half-up).
function baseListingParams(overrides = {}) {
  return {
    bullId: "BRAF-001",
    assetType: "PAJ_BRAF",
    unitPriceUsd: 24.5,
    quantity: 10,
    royaltyPct: 5,
    proof: { topicId: "0.0.123456", sequenceNumber: 1 },
    ...overrides,
  };
}

const certifiedDosis = { unitPriceUsd: 24.5 };
const expectedMessage = { specVersion: "001", mTotal: 2.45 };

// Doble mock de verificación: veredicto fijo sin red.
function mockVerifyFn(status) {
  return async () => ({ status });
}

// Doble mock del contrato: cuenta llamadas, no mueve fondos reales.
function mockContractExec() {
  const state = { createCalls: 0, buyCalls: 0 };
  return {
    state,
    createListing: async () => {
      state.createCalls += 1;
      return { listingId: "L-EA01", txId: "0.0.999@1234567890.000000000" };
    },
    buy: async () => {
      state.buyCalls += 1;
      return { purchaseId: "P-EA01", txId: "0.0.999@1234567891.000000000" };
    },
  };
}

describe("T6 RF-02 guarda VERIFIED en createListing (mocks, sin red)", () => {
  it("RF-02 proof MISMATCH rechaza listar sin mover fondos (0 llamadas)", async () => {
    const contractExec = mockContractExec();
    await assert.rejects(
      () =>
        createListing(null, "0.0.777777", baseListingParams(), certifiedDosis, baseListingParams().proof, expectedMessage, {
          verifyFn: mockVerifyFn("MISMATCH"),
          contractExec,
        }),
      /sin proof VERIFIED/
    );
    assert.equal(contractExec.state.createCalls, 0);
  });

  it("RF-02 proof PENDING rechaza listar sin mover fondos (0 llamadas)", async () => {
    const contractExec = mockContractExec();
    await assert.rejects(
      () =>
        createListing(null, "0.0.777777", baseListingParams(), certifiedDosis, baseListingParams().proof, expectedMessage, {
          verifyFn: mockVerifyFn("PENDING"),
          contractExec,
        }),
      /sin proof VERIFIED/
    );
    assert.equal(contractExec.state.createCalls, 0);
  });

  it("RF-03 tasación alterada en un decimal rechaza antes de red (0 llamadas)", async () => {
    const contractExec = mockContractExec();
    await assert.rejects(
      () =>
        createListing(
          null,
          "0.0.777777",
          baseListingParams({ unitPriceUsd: 24.51 }),
          certifiedDosis,
          baseListingParams().proof,
          expectedMessage,
          { verifyFn: mockVerifyFn("VERIFIED"), contractExec }
        ),
      /precio no coincide con tasación/
    );
    assert.equal(contractExec.state.createCalls, 0);
  });
});

describe("T6 RF-01 createListing VERIFIED crea listado (1 llamada)", () => {
  it("RF-01 proof VERIFIED deja exactamente 1 llamada con identificadores y transacción", async () => {
    const contractExec = mockContractExec();
    const result = await createListing(
      null,
      "0.0.777777",
      baseListingParams(),
      certifiedDosis,
      baseListingParams().proof,
      expectedMessage,
      { verifyFn: mockVerifyFn("VERIFIED"), contractExec }
    );
    assert.equal(contractExec.state.createCalls, 1);
    assert.equal(result.listingId, "L-EA01");
    assert.ok(typeof result.txId === "string" && result.txId.length > 0);
  });
});

describe("T6 RF-02/RF-04 buy con guarda VERIFIED (mocks, sin red)", () => {
  // Listado abierto canónico EA-01: 10 pajuelas a 24.50, 5% regalía.
  function openListing() {
    return {
      bullId: "BRAF-001",
      assetType: "PAJ_BRAF",
      unitPriceUsd: 24.5,
      available: 10,
      royaltyPct: 5,
    };
  }

  it("RF-02 proof no-VERIFIED rechaza comprar sin mover fondos (0 llamadas)", async () => {
    const contractExec = mockContractExec();
    await assert.rejects(
      () =>
        buy(
          null,
          "0.0.777777",
          { listingId: "L-EA01", quantity: 10, totalPaidUsd: 245.0 },
          openListing(),
          baseListingParams().proof,
          expectedMessage,
          { verifyFn: mockVerifyFn("MISMATCH"), contractExec }
        ),
      /sin proof VERIFIED/
    );
    assert.equal(contractExec.state.buyCalls, 0);
  });

  it("RF-04 compra con total que no cuadra rechaza antes de red (0 llamadas)", async () => {
    const contractExec = mockContractExec();
    await assert.rejects(
      () =>
        buy(
          null,
          "0.0.777777",
          { listingId: "L-EA01", quantity: 10, totalPaidUsd: 244.99 },
          openListing(),
          baseListingParams().proof,
          expectedMessage,
          { verifyFn: mockVerifyFn("VERIFIED"), contractExec }
        ),
      /total no coincide/
    );
    assert.equal(contractExec.state.buyCalls, 0);
  });

  it("RF-04 proof VERIFIED registra compra con cantidad y transacción verificables (1 llamada + split EA-01)", async () => {
    const contractExec = mockContractExec();
    const result = await buy(
      null,
      "0.0.777777",
      { listingId: "L-EA01", quantity: 10, totalPaidUsd: 245.0 },
      openListing(),
      baseListingParams().proof,
      expectedMessage,
      { verifyFn: mockVerifyFn("VERIFIED"), contractExec }
    );
    assert.equal(contractExec.state.buyCalls, 1);
    assert.equal(result.purchaseId, "P-EA01");
    assert.ok(typeof result.txId === "string" && result.txId.length > 0);
    // Reparto canónico EA-01 verificable en el resultado.
    assert.equal(result.split.totalUsd, 245.0);
    assert.equal(result.split.royaltyUsd, 12.25);
    assert.equal(result.split.sellerUsd, 232.75);
    assert.equal(result.split.royaltyUsd + result.split.sellerUsd, result.split.totalUsd);
  });
});

// Tests T7 spec 003: liquidar, cancelar y reembolso ante fallo (RF-06/RF-07/RF-08).
// Mocks inyectados sin red (contractExec que revierte, mirrorFetch).
// Criterio: fallo no acredita parciales, doble retiro denegado,
// cancelación preserva retiro pendiente, consultas sin claves.
const {
  withdrawRoyalties,
  cancelListing,
  getListing,
  getPurchase,
  getSettlement,
} = require("../src/hedera/marketplaceClient.js");

// Doble mock del contrato para T7: retiro único, cancelación y revert.
function mockSettlementExec() {
  const state = { withdrawCalls: 0, cancelCalls: 0, withdrawn: false };
  return {
    state,
    withdrawRoyalties: async () => {
      state.withdrawCalls += 1;
      if (state.withdrawn) {
        throw new Error("sin regalias pendientes");
      }
      state.withdrawn = true;
      return { txId: "0.0.999@1234567892.000000000", amountUsd: 12.25 };
    },
    cancelListing: async () => {
      state.cancelCalls += 1;
      return { txId: "0.0.999@1234567893.000000000" };
    },
  };
}

describe("T7 RF-06 withdrawRoyalties acredita retiro único EA-01 (mocks, sin red)", () => {
  it("RF-06 retiro acredita 12.25 al criador con transacción verificable", async () => {
    const contractExec = mockSettlementExec();
    const result = await withdrawRoyalties(null, "0.0.777777", "0.0.111111", { contractExec });
    assert.equal(contractExec.state.withdrawCalls, 1);
    assert.equal(result.amountUsd, 12.25);
    assert.ok(typeof result.txId === "string" && result.txId.length > 0);
  });

  it("RF-06 segundo retiro del mismo saldo denegado sin doble pago", async () => {
    const contractExec = mockSettlementExec();
    const first = await withdrawRoyalties(null, "0.0.777777", "0.0.111111", { contractExec });
    assert.equal(first.amountUsd, 12.25);
    await assert.rejects(
      () => withdrawRoyalties(null, "0.0.777777", "0.0.111111", { contractExec }),
      /doble retiro denegado/
    );
    assert.equal(contractExec.state.withdrawCalls, 2);
  });
});

describe("T7 RF-07 fallo del contrato revierte sin acreditar parciales", () => {
  it("RF-07 revert en buy propaga fallo sin purchaseId ni regalía", async () => {
    const revertingExec = {
      state: { buyCalls: 0 },
      buy: async () => {
        revertingExec.state.buyCalls += 1;
        throw new Error("revert: pago debe ser exacto al precio tasado");
      },
    };
    await assert.rejects(
      () =>
        buy(
          null,
          "0.0.777777",
          { listingId: "L-EA01", quantity: 10, totalPaidUsd: 245.0 },
          {
            bullId: "BRAF-001",
            assetType: "PAJ_BRAF",
            unitPriceUsd: 24.5,
            available: 10,
            royaltyPct: 5,
          },
          baseListingParams().proof,
          expectedMessage,
          { verifyFn: mockVerifyFn("VERIFIED"), contractExec: revertingExec }
        ),
      /revert|reembolso|fallo/
    );
    assert.equal(revertingExec.state.buyCalls, 1);
  });

  it("RF-07 fallo de red en retiro propaga reembolso sin acreditar parciales", async () => {
    const failingExec = {
      withdrawRoyalties: async () => {
        throw new Error("fallo de red tras pagar");
      },
    };
    await assert.rejects(
      () => withdrawRoyalties(null, "0.0.777777", "0.0.111111", { contractExec: failingExec }),
      /reembolso|fallo/
    );
  });
});

describe("T7 RF-08 cancelListing cierra compras y preserva pendientes", () => {
  it("RF-08 cancelar devuelve txId con cancelled true", async () => {
    const contractExec = mockSettlementExec();
    const result = await cancelListing(null, "0.0.777777", "L-EA01", { contractExec });
    assert.equal(contractExec.state.cancelCalls, 1);
    assert.equal(result.listingId, "L-EA01");
    assert.equal(result.cancelled, true);
    assert.ok(typeof result.txId === "string" && result.txId.length > 0);
  });

  it("RF-08 compra tras cancelación rechazada pero retiro posterior válido", async () => {
    const contractExec = mockSettlementExec();
    // La cancelación cierra el listado a nuevas compras (puro bloquea antes de red).
    const cancelledListing = {
      bullId: "BRAF-001",
      assetType: "PAJ_BRAF",
      unitPriceUsd: 24.5,
      available: 10,
      royaltyPct: 5,
      cancelled: true,
    };
    const execWithBuy = { ...contractExec, state: contractExec.state, buyCalls: 0, buy: async () => ({}) };
    await assert.rejects(
      () =>
        buy(
          null,
          "0.0.777777",
          { listingId: "L-EA01", quantity: 1, totalPaidUsd: 24.5 },
          cancelledListing,
          baseListingParams().proof,
          expectedMessage,
          { verifyFn: mockVerifyFn("VERIFIED"), contractExec: execWithBuy }
        ),
      /listado cerrado/
    );
    // Los saldos ya acreditados se preservan: el retiro posterior sigue válido.
    const settled = await withdrawRoyalties(null, "0.0.777777", "0.0.111111", { contractExec });
    assert.equal(settled.amountUsd, 12.25);
    assert.ok(typeof settled.txId === "string" && settled.txId.length > 0);
  });
});

describe("T7 R-REV-02 consultas públicas sin claves (solo lectura mirror)", () => {
  it("getListing devuelve estado + HashScan sin exigir claves", async () => {
    let calls = 0;
    const mirrorFetch = async (url) => {
      calls += 1;
      assert.ok(url.includes("testnet.mirrornode.hedera.com"));
      return { listingId: "L-EA01", unitPriceCents: 2450, proofRef: baseListingParams().proof };
    };
    const result = await getListing("0.0.777777", "L-EA01", { mirrorFetch });
    assert.equal(calls, 1);
    assert.equal(result.listingId, "L-EA01");
    assert.ok(result.hashscanUrl.includes("hashscan.io/testnet"));
  });

  it("getPurchase devuelve compra + HashScan sin exigir claves", async () => {
    const mirrorFetch = async () => ({
      purchaseId: "P-EA01",
      txId: "0.0.999@1234567891.000000000",
      totalCents: 24500,
    });
    const result = await getPurchase("0.0.777777", "P-EA01", { mirrorFetch });
    assert.equal(result.purchaseId, "P-EA01");
    assert.ok(result.hashscanUrl.includes("hashscan.io/testnet"));
  });

  it("getSettlement devuelve liquidación + HashScan sin exigir claves", async () => {
    const mirrorFetch = async () => ({
      purchaseId: "P-EA01",
      txId: "0.0.999@1234567892.000000000",
      royaltyCents: 1225,
    });
    const result = await getSettlement("0.0.777777", "P-EA01", { mirrorFetch });
    assert.equal(result.purchaseId, "P-EA01");
    assert.ok(result.hashscanUrl.includes("hashscan.io/testnet"));
  });
});
