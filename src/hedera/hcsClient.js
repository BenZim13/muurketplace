// Crea el cliente HCS contra Hedera Testnet (patrón tokenizarToro.js).
// Falla explícito sin credenciales, antes de tocar la red.
// Solo Testnet en esta spec (ninguna otra red permitida).
//
// `deps.sdk` permite inyectar un mock de `@hashgraph/sdk` en tests sin red
// ni node_modules; por defecto usa el SDK real (lazy require).
function createHcsClient({ accountId, privateKey } = {}, deps = {}) {
  // Validación pre-red: ambos requeridos y no vacíos.
  if (!accountId || !privateKey) {
    throw new Error("credenciales ausentes: se requieren accountId y privateKey");
  }

  const sdk = deps.sdk || require("@hashgraph/sdk");
  const client = sdk.Client.forTestnet();
  client.setOperator(accountId, sdk.PrivateKey.fromStringECDSA(privateKey));
  return client;
}

module.exports = { createHcsClient };
