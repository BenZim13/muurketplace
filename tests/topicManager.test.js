// Tests T3 Spec 002 RF-01/RF-02: TopicManager crear vs reutilizar.
// Comentarios en español; código en inglés. TDD: rojo antes de implementar.
// Sin red: cliente mock + clases SDK falsas inyectadas vía `deps.sdk`.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  createValuationsTopic,
  resolveValuationsTopic,
} = require("../src/hedera/topicManager.js");

// Fabrica un cliente falso y clases SDK falsas espiables (sin red).
// `topicInfoBehavior`: "found" resuelve la query, "notFound" lanza NOT_FOUND.
function makeMocks({ topicInfoBehavior = "found", createdTopicId = "0.0.999999" } = {}) {
  const calls = { create: 0, query: 0, lastMemo: null };
  class FakeTopicCreateTransaction {
    constructor() {
      calls.create += 1;
    }
    setTopicMemo(memo) {
      calls.lastMemo = memo;
      return this;
    }
    async execute(client) {
      this._client = client;
      return this;
    }
    async getReceipt(client) {
      void client;
      return { topicId: { toString: () => createdTopicId } };
    }
  }
  class FakeTopicInfoQuery {
    setTopicId(topicId) {
      this._topicId = topicId;
      return this;
    }
    async execute(client) {
      calls.query += 1;
      void client;
      if (topicInfoBehavior === "notFound") {
        throw new Error("NOT_FOUND");
      }
      return { topicId: this._topicId };
    }
  }
  const fakeClient = {};
  const deps = {
    sdk: {
      TopicCreateTransaction: FakeTopicCreateTransaction,
      TopicInfoQuery: FakeTopicInfoQuery,
    },
  };
  return { calls, fakeClient, deps, createdTopicId };
}

describe("T3 RF-01 crear topic cuando no hay topicId configurado", () => {
  it("sin topicId → crea exactamente 1 vez y devuelve 0.0.x", async () => {
    const { calls, fakeClient, deps, createdTopicId } = makeMocks();
    const topicId = await resolveValuationsTopic(fakeClient, null, {}, deps);
    assert.strictEqual(topicId, createdTopicId);
    assert.strictEqual(calls.create, 1, "TopicCreate debe llamarse exactamente 1 vez");
  });

  it("createValuationsTopic directo devuelve topicId string", async () => {
    const { calls, fakeClient, deps, createdTopicId } = makeMocks();
    const topicId = await createValuationsTopic(fakeClient, {}, deps);
    assert.strictEqual(topicId, createdTopicId);
    assert.strictEqual(calls.create, 1);
  });
});

describe("T3 RF-02 reutilizar topic existente sin crear paralelo", () => {
  it("con topicId válido existente → devuelve el mismo sin crear", async () => {
    const { calls, fakeClient, deps } = makeMocks({ topicInfoBehavior: "found" });
    const topicId = await resolveValuationsTopic(fakeClient, "0.0.123456", {}, deps);
    assert.strictEqual(topicId, "0.0.123456");
    assert.strictEqual(calls.create, 0, "TopicCreate debe llamarse 0 veces al reutilizar");
    assert.strictEqual(calls.query, 1, "debe validar existencia con 1 query");
  });

  it("formato inválido → lanza sin tocar red (0 creates, 0 queries)", async () => {
    const { calls, fakeClient, deps } = makeMocks();
    await assert.rejects(
      () => resolveValuationsTopic(fakeClient, "no-es-topic", {}, deps),
      /malformado/
    );
    assert.strictEqual(calls.create, 0);
    assert.strictEqual(calls.query, 0);
  });

  it("topic configurado inexistente (NOT_FOUND) → lanza explícito sin crear paralelo", async () => {
    const { calls, fakeClient, deps } = makeMocks({ topicInfoBehavior: "notFound" });
    await assert.rejects(
      () => resolveValuationsTopic(fakeClient, "0.0.777777", {}, deps),
      /topic configurado inexistente/
    );
    assert.strictEqual(calls.create, 0, "no debe crear topic paralelo ante NOT_FOUND");
  });
});
