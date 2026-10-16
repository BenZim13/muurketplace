const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Requiere implementación T1: config/oracle.config.js + src/hedera/hcsClient.js
const { loadOracleConfig } = require("../config/oracle.config.js");
const { createHcsClient } = require("../src/hedera/hcsClient.js");

describe("oracleConfig - loadOracleConfig", () => {
  it("env vacío → topicId null con defaults testnet/3/1000", () => {
    const cfg = loadOracleConfig({});
    assert.equal(cfg.topicId, null);
    assert.equal(cfg.network, "testnet");
    assert.equal(cfg.maxRetries, 3);
    assert.equal(cfg.baseDelayMs, 1000);
  });

  it("topicId válido se devuelve tal cual", () => {
    const cfg = loadOracleConfig({ HCS_VALUATIONS_TOPIC_ID: "0.0.123456" });
    assert.equal(cfg.topicId, "0.0.123456");
    assert.equal(cfg.network, "testnet");
  });

  it("topicId malformado lanza Error configuración inválida", () => {
    assert.throws(() => loadOracleConfig({ HCS_VALUATIONS_TOPIC_ID: "no-es-topic" }), /configuración inválida/);
    assert.throws(() => loadOracleConfig({ HCS_VALUATIONS_TOPIC_ID: "0.0.abc" }), /configuración inválida/);
    assert.throws(() => loadOracleConfig({ HCS_VALUATIONS_TOPIC_ID: "1.2.3" }), /configuración inválida/);
  });
});

describe("hcsClient - createHcsClient", () => {
  it("lanza credenciales ausentes si falta alguno, sin tocar red", () => {
    assert.throws(() => createHcsClient({}), /credenciales ausentes/);
    assert.throws(() => createHcsClient({ accountId: "0.0.1" }), /credenciales ausentes/);
    assert.throws(() => createHcsClient({ privateKey: "abc" }), /credenciales ausentes/);
    assert.throws(() => createHcsClient({ accountId: "", privateKey: "" }), /credenciales ausentes/);
  });

  it("con credenciales válidas crea Client.forTestnet con operator, sin tocar red (mock SDK)", () => {
    // Mock del SDK: verifica forTestnet + setOperator con PrivateKey.fromStringECDSA, sin red.
    const calls = { forTestnet: 0, setOperator: null, keyFrom: null };
    const fakeKeyObj = { __fakeKey: true };
    const fakeClient = {
      operatorAccountId: { toString: () => "0.0.123456" },
      setOperator(accountId, key) {
        calls.setOperator = { accountId, key };
      },
      close() {},
    };
    const mockSdk = {
      Client: {
        forTestnet() {
          calls.forTestnet += 1;
          return fakeClient;
        },
      },
      PrivateKey: {
        fromStringECDSA(privateKey) {
          calls.keyFrom = privateKey;
          return fakeKeyObj;
        },
      },
    };
    const client = createHcsClient(
      { accountId: "0.0.123456", privateKey: "clave-falsa-solo-formato" },
      { sdk: mockSdk }
    );
    assert.equal(calls.forTestnet, 1, "Client.forTestnet debe llamarse exactamente 1 vez");
    assert.equal(calls.keyFrom, "clave-falsa-solo-formato");
    assert.equal(calls.setOperator.accountId, "0.0.123456");
    assert.equal(calls.setOperator.key, fakeKeyObj);
    assert.equal(client.operatorAccountId.toString(), "0.0.123456");
  });

  it("con SDK real (si disponible) crea cliente Testnet con operator, sin tocar red", () => {
    // Solo corre si node_modules está instalado; si no, se salta sin fallar.
    let sdk;
    try {
      sdk = require("@hashgraph/sdk");
    } catch {
      return;
    }
    const fakeKey = sdk.PrivateKey.generateECDSA().toString();
    const client = createHcsClient({ accountId: "0.0.123456", privateKey: fakeKey });
    assert.ok(client, "debe devolver un cliente");
    assert.ok(client.operatorAccountId, "debe tener operatorAccountId");
    assert.equal(client.operatorAccountId.toString(), "0.0.123456");
    client.close();
  });
});
