// Tests T5 (Spec 005): config de tokens + token manager de PAJ-BRAF (RF-01).
// Comentarios en español; código en inglés. TDD: rojo antes de implementar.
// Sin red: `deps.sdk` falso inyectable; sin claves reales (RNF-03).
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { loadTokenConfig } = require("../config/tokens.config.js");
const { tokenizePajBraf } = require("../src/hedera/pajBrafManager.js");

// Fabrica clases SDK falsas espiables (sin red) que capturan la config del token.
function makeMocks({ tokenId = "0.0.777777", totalSupply = 300, mintTxId = "0.0.111111@1.1" } = {}) {
  const calls = { create: 0, mint: 0, createCfg: null, mintCfg: null };
  class FakeTokenCreateTransaction {
    constructor() {
      calls.create += 1;
    }
    setTokenName(v) {
      this._name = v;
      return this;
    }
    setTokenSymbol(v) {
      this._symbol = v;
      return this;
    }
    setDecimals(v) {
      this._decimals = v;
      return this;
    }
    setInitialSupply(v) {
      this._initialSupply = v;
      return this;
    }
    setTreasuryAccountId(v) {
      this._treasury = v;
      return this;
    }
    setAdminKey(v) {
      this._adminKey = v;
      return this;
    }
    setSupplyKey(v) {
      this._supplyKey = v;
      return this;
    }
    async execute(client) {
      void client;
      calls.createCfg = {
        name: this._name,
        symbol: this._symbol,
        decimals: this._decimals,
        initialSupply: this._initialSupply,
        treasury: this._treasury,
        adminKey: this._adminKey,
        supplyKey: this._supplyKey,
      };
      return { getReceipt: async () => ({ tokenId: { toString: () => tokenId } }) };
    }
  }
  class FakeTokenMintTransaction {
    constructor() {
      calls.mint += 1;
    }
    setTokenId(v) {
      this._tokenId = v;
      return this;
    }
    setAmount(v) {
      this._amount = v;
      return this;
    }
    async execute(client) {
      void client;
      calls.mintCfg = { tokenId: this._tokenId, amount: this._amount };
      return {
        transactionId: mintTxId,
        getReceipt: async () => ({ totalSupply: { toString: () => String(totalSupply) } }),
      };
    }
  }
  const fakeClient = {};
  const deps = {
    sdk: {
      TokenCreateTransaction: FakeTokenCreateTransaction,
      TokenMintTransaction: FakeTokenMintTransaction,
    },
  };
  return { calls, fakeClient, deps, tokenId };
}

// Claves Admin/Supply ficticias (nunca claves reales).
function fakeKeys() {
  return { adminKey: { __fake: "admin" }, supplyKey: { __fake: "supply" } };
}

describe("T5 RF-01 tokenizePajBraf: crear token y emitir lote completo", () => {
  it("crea PAJ-BRAF 0 decimales con claves Admin/Treasury y treasury = cabaña", async () => {
    const { calls, fakeClient, deps } = makeMocks();
    await tokenizePajBraf(
      fakeClient,
      { treasuryAccountId: "0.0.111111", pajuelaCount: 300, ...fakeKeys() },
      deps
    );
    assert.strictEqual(calls.create, 1, "TokenCreate debe llamarse exactamente 1 vez");
    assert.strictEqual(calls.createCfg.decimals, 0, "PAJ-BRAF es entero (0 decimales)");
    assert.strictEqual(calls.createCfg.treasury, "0.0.111111", "treasury = cuenta de la cabaña");
    assert.ok(calls.createCfg.adminKey, "clave Admin obligatoria");
    assert.ok(calls.createCfg.supplyKey, "clave de emisión (Treasury) obligatoria");
    assert.strictEqual(calls.createCfg.initialSupply, 0, "la emisión se hace por mint, no en la creación");
  });

  it("emite el lote completo de pajuelas a la treasury y devuelve tokenId/supply/txId", async () => {
    const { calls, fakeClient, deps } = makeMocks({ tokenId: "0.0.777777", totalSupply: 300 });
    const result = await tokenizePajBraf(
      fakeClient,
      { treasuryAccountId: "0.0.111111", pajuelaCount: 300, ...fakeKeys() },
      deps
    );
    assert.strictEqual(calls.mint, 1, "TokenMint debe llamarse exactamente 1 vez");
    assert.strictEqual(calls.mintCfg.tokenId, "0.0.777777");
    assert.strictEqual(calls.mintCfg.amount, 300, "se emite el lote completo");
    assert.strictEqual(result.tokenId, "0.0.777777");
    assert.strictEqual(result.supply, 300);
    assert.ok(result.txId, "debe devolver el txId verificable");
  });

  it("usa el nombre y símbolo por defecto PAJ-BRAF", async () => {
    const { calls, fakeClient, deps } = makeMocks();
    await tokenizePajBraf(
      fakeClient,
      { treasuryAccountId: "0.0.111111", pajuelaCount: 10, ...fakeKeys() },
      deps
    );
    assert.match(calls.createCfg.symbol, /PAJ-BRAF/);
  });
});

describe("T5 RF-01 tokenizePajBraf: rechazos antes de tocar la red", () => {
  it("sin pajuelaCount entero > 0 no crea ni emite", async () => {
    const { calls, fakeClient, deps } = makeMocks();
    await assert.rejects(
      () => tokenizePajBraf(fakeClient, { treasuryAccountId: "0.0.111111", pajuelaCount: 0, ...fakeKeys() }, deps),
      /pajuelaCount/
    );
    assert.strictEqual(calls.create, 0);
    assert.strictEqual(calls.mint, 0);
  });

  it("sin adminKey lanza sin tocar la red", async () => {
    const { calls, fakeClient, deps } = makeMocks();
    await assert.rejects(
      () =>
        tokenizePajBraf(
          fakeClient,
          { treasuryAccountId: "0.0.111111", pajuelaCount: 10, supplyKey: { __fake: "supply" } },
          deps
        ),
      /adminKey/
    );
    assert.strictEqual(calls.create, 0);
  });

  it("sin supplyKey (clave de emisión) lanza sin tocar la red", async () => {
    const { calls, fakeClient, deps } = makeMocks();
    await assert.rejects(
      () =>
        tokenizePajBraf(
          fakeClient,
          { treasuryAccountId: "0.0.111111", pajuelaCount: 10, adminKey: { __fake: "admin" } },
          deps
        ),
      /supplyKey/
    );
    assert.strictEqual(calls.create, 0);
  });

  it("sin treasuryAccountId lanza sin tocar la red", async () => {
    const { calls, fakeClient, deps } = makeMocks();
    await assert.rejects(
      () => tokenizePajBraf(fakeClient, { pajuelaCount: 10, ...fakeKeys() }, deps),
      /treasuryAccountId/
    );
    assert.strictEqual(calls.create, 0);
  });
});

describe("T5 config: loadTokenConfig", () => {
  it("env vacío → defaults Testnet, PAJ 0 dec. y BULL 4 dec. maxSupply 10, contractId null", () => {
    const cfg = loadTokenConfig({});
    assert.strictEqual(cfg.network, "testnet");
    assert.strictEqual(cfg.contractId, null);
    assert.strictEqual(cfg.pajBraf.decimals, 0);
    assert.strictEqual(cfg.bull.decimals, 4);
    assert.strictEqual(cfg.bull.maxSupply, 10);
  });

  it("contractId válido Testnet se devuelve tal cual", () => {
    const cfg = loadTokenConfig({ MURKETPLACE_ATOMIC_CONTRACT_ID: "0.0.999999" });
    assert.strictEqual(cfg.contractId, "0.0.999999");
  });

  it("contractId malformado lanza configuración inválida", () => {
    assert.throws(
      () => loadTokenConfig({ MURKETPLACE_ATOMIC_CONTRACT_ID: "no-es-contrato" }),
      /configuración inválida/
    );
  });
});
