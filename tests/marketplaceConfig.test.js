const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Tarea 1 Spec 003: config del marketplace (habilitadora, sin red ni SDK real).
const { loadMarketplaceConfig } = require("../config/marketplace.config.js");

describe("marketplaceConfig - loadMarketplaceConfig", () => {
  it("env vacío → contractId null con red testnet y timeout operativo", () => {
    const cfg = loadMarketplaceConfig({});
    assert.equal(cfg.contractId, null);
    assert.equal(cfg.network, "testnet");
    assert.ok(Number.isInteger(cfg.confirmTimeoutMs), "confirmTimeoutMs debe ser entero");
    assert.ok(cfg.confirmTimeoutMs > 0, "confirmTimeoutMs debe ser positivo");
  });

  it("env sin variable → contractId null sin tocar red", () => {
    const cfg = loadMarketplaceConfig({ OTRA_VAR: "1" });
    assert.equal(cfg.contractId, null);
    assert.equal(cfg.network, "testnet");
  });

  it("contractId válido Testnet se devuelve tal cual", () => {
    const cfg = loadMarketplaceConfig({ MARKETPLACE_CONTRACT_ID: "0.0.123456" });
    assert.equal(cfg.contractId, "0.0.123456");
    assert.equal(cfg.network, "testnet");
    assert.ok(cfg.confirmTimeoutMs > 0);
  });

  it("contractId malformado lanza Error de configuración inválida", () => {
    assert.throws(
      () => loadMarketplaceConfig({ MARKETPLACE_CONTRACT_ID: "no-es-contrato" }),
      /configuración inválida/
    );
    assert.throws(
      () => loadMarketplaceConfig({ MARKETPLACE_CONTRACT_ID: "0.0.abc" }),
      /configuración inválida/
    );
    assert.throws(
      () => loadMarketplaceConfig({ MARKETPLACE_CONTRACT_ID: "1.2.3" }),
      /configuración inválida/
    );
    assert.throws(
      () => loadMarketplaceConfig({ MARKETPLACE_CONTRACT_ID: "   " }),
      /configuración inválida/
    );
  });
});
