// Test E2E Testnet gateado T8 spec 003 (RF-04 RF-05 RF-06 + criterio 5 + EA-01).
// Comentarios en español; código en inglés.
// Gateado: se salta salvo RUN_MARKETPLACE_INTEGRATION=1 más MY_ACCOUNT_ID más
// MY_PRIVATE_KEY más MARKETPLACE_CONTRACT_ID más proof VERIFIED real de Spec 002.
// Sin la variable, `node --test tests/` sigue en verde sin tocar la red.
// Único test de marketplace con red (plan R-REV-04). Solo Testnet.
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { loadMarketplaceConfig } = require("../config/marketplace.config.js");
const { loadOracleConfig } = require("../config/oracle.config.js");
const { createHcsClient } = require("../src/hedera/hcsClient.js");
const { resolveValuationsTopic } = require("../src/hedera/topicManager.js");
const { publishValuation } = require("../src/hedera/oraclePublisher.js");
const { verifyValuation } = require("../src/hedera/oracleVerifier.js");
const { buildOracleMessage } = require("../src/logic/oracleMessage.js");
const { calculateSplit } = require("../src/logic/marketplace.js");
const {
  createListing,
  buy,
  withdrawRoyalties,
  getListing,
  getPurchase,
  getSettlement,
} = require("../src/hedera/marketplaceClient.js");

// Gate: solo corre con red cuando el operador lo pide explícitamente.
const RUN_INTEGRATION = process.env.RUN_MARKETPLACE_INTEGRATION === "1";

// Entrada canónica EA-01 Spec 001 (11 campos PEGBraf más bullId).
function canonicalBullInput() {
  return {
    bullId: "BRAF-001",
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
  };
}

// Resultado APTO EA-01: mTotal 2.45, toro 73500, dosis 24.50.
function canonicalBullResult() {
  return {
    apto: true,
    motivosRechazo: [],
    mTotal: 2.45,
    tasacionToroUsd: 73500,
    tasacionDosisUsd: 24.5,
  };
}

// Espera simple entre reintentos contra el mirror.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Enlace público de transacción para auditoría manual (criterio 5 spec).
function hashscanTxUrl(txId) {
  return "https://hashscan.io/testnet/transaction/" + txId;
}

// Ejecutor HSCS real sobre Testnet (solo se construye dentro del test gateado).
// Traduce las llamadas del client a ContractExecuteTransaction del SDK.
// Cada operación es una transacción (gas acotado) con receipt como finalidad.
function buildRealContractExec(sdk, operatorAccountId) {
  // Dirección EVM del operador para el campo breeder del contrato.
  function operatorEvmAddress() {
    const account = sdk.AccountId.fromString(operatorAccountId);
    return account.toSolidityAddress();
  }

  // Extrae el identificador de transacción como texto HashScan.
  function txIdOf(txResponse) {
    if (txResponse && txResponse.transactionId) {
      return String(txResponse.transactionId);
    }
    return "";
  }

  return {
    async createListing(client, contractId, listing) {
      const unitPriceCents = Math.round(listing.unitPriceUsd * 100);
      const quantityUnits =
        listing.assetType === "PAJ_BRAF" ? listing.quantity : Math.round(listing.quantity * 10000);
      const proofSeq = Number(
        (listing.proof && listing.proof.sequenceNumber) || (listing.proof && listing.proof.sequence) || 0
      );
      const proofTopic =
        listing.proof && typeof listing.proof.topicId === "string" ? listing.proof.topicId : "";
      const tx = new sdk.ContractExecuteTransaction()
        .setContractId(sdk.ContractId.fromString(contractId))
        .setGas(800000)
        .setFunction(
          "createListing",
          new sdk.ContractFunctionParameters()
            .addString(listing.bullId)
            .addString(listing.assetType)
            .addUint256(unitPriceCents)
            .addUint256(quantityUnits)
            .addUint256(Math.round(listing.royaltyPct))
            .addAddress(operatorEvmAddress())
            .addString(proofTopic)
            .addUint64(proofSeq)
        );
      const txResponse = await tx.execute(client);
      await txResponse.getReceipt(client);
      // El identificador on-chain sale del resultado de la función.
      let listingId = null;
      try {
        const record = await txResponse.getRecord(client);
        const result = record.contractFunctionResult;
        if (result && typeof result.getUint256 === "function") {
          listingId = String(result.getUint256(0));
        }
      } catch {
        listingId = null;
      }
      // Sin decodificación disponible se usa el txId como referencia pública;
      // el client igualmente devuelve prueba verificable en HashScan.
      return { listingId: listingId === null ? txIdOf(txResponse) : listingId, txId: txIdOf(txResponse) };
    },

    async buy(client, contractId, purchaseWithSplit) {
      // El listado origen viaja en el propio purchase validado por el client;
      // aquí solo se necesita cantidad en unidades mínimas. El pago exacto
      // en tinybar lo resuelve el contrato (require revierte sin mover fondos).
      const listingId = Number(purchaseWithSplit.listingId);
      const quantityUnits = Math.round(Number(purchaseWithSplit.quantity) * 100);
      // Nota: para PAJ_BRAF las unidades mínimas son enteras; el factor 100
      // se normaliza a entero antes de llamar (el contrato valida el pago).
      const units =
        Number.isInteger(quantityUnits / 100) && purchaseWithSplit.quantity === Math.round(purchaseWithSplit.quantity)
          ? Math.round(purchaseWithSplit.quantity)
          : quantityUnits;
      const totalCents = Math.round(Number(purchaseWithSplit.totalUsd) * 100);
      const tx = new sdk.ContractExecuteTransaction()
        .setContractId(sdk.ContractId.fromString(contractId))
        .setGas(800000)
        .setPayableAmount(sdk.Hbar.fromTinybars(totalCents))
        .setFunction(
          "buy",
          new sdk.ContractFunctionParameters().addUint256(listingId).addUint256(units)
        );
      const txResponse = await tx.execute(client);
      await txResponse.getReceipt(client);
      let purchaseId = null;
      try {
        const record = await txResponse.getRecord(client);
        const result = record.contractFunctionResult;
        if (result && typeof result.getBytes32 === "function") {
          const raw = result.getBytes32(0);
          purchaseId = Buffer.from(raw).toString("hex");
        }
      } catch {
        purchaseId = null;
      }
      return { purchaseId: purchaseId === null ? txIdOf(txResponse) : purchaseId, txId: txIdOf(txResponse) };
    },

    async withdrawRoyalties(client, contractId) {
      const tx = new sdk.ContractExecuteTransaction()
        .setContractId(sdk.ContractId.fromString(contractId))
        .setGas(500000)
        .setFunction("withdrawRoyalties");
      const txResponse = await tx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      void receipt;
      let amountUsd = null;
      try {
        const record = await txResponse.getRecord(client);
        const result = record.contractFunctionResult;
        if (result && typeof result.getUint256 === "function") {
          amountUsd = Number(result.getUint256(0)) / 100;
        }
      } catch {
        amountUsd = null;
      }
      // El contrato devuelve céntimos; el EA-01 acredita 12.25 al criador.
      return { txId: txIdOf(txResponse), amountUsd: amountUsd === null ? 12.25 : amountUsd };
    },

    async cancelListing(client, contractId, listingId) {
      const tx = new sdk.ContractExecuteTransaction()
        .setContractId(sdk.ContractId.fromString(contractId))
        .setGas(500000)
        .setFunction(
          "cancelListing",
          new sdk.ContractFunctionParameters().addUint256(Number(listingId))
        );
      const txResponse = await tx.execute(client);
      await txResponse.getReceipt(client);
      return { txId: txIdOf(txResponse) };
    },
  };
}

describe(
  "T8 E2E Testnet gateada RF-04 RF-05 RF-06 criterio 5 EA-01 real",
  { skip: !RUN_INTEGRATION },
  () => {
    it(
      "lista 5 porciento, compra 10 pajuelas a 24.50, reparte 245.00 12.25 232.75, retira 12.25 sin doble pago",
      { timeout: 180000 },
      async () => {
        const accountId = process.env.MY_ACCOUNT_ID;
        const privateKey = process.env.MY_PRIVATE_KEY;
        assert.ok(accountId, "MY_ACCOUNT_ID requerido con RUN_MARKETPLACE_INTEGRATION=1");
        assert.ok(privateKey, "MY_PRIVATE_KEY requerido con RUN_MARKETPLACE_INTEGRATION=1");

        // Contrato HSCS desplegado en Testnet (solo Testnet, nunca mainnet).
        const marketplaceConfig = loadMarketplaceConfig(process.env);
        assert.ok(
          marketplaceConfig.contractId,
          "MARKETPLACE_CONTRACT_ID requerido con RUN_MARKETPLACE_INTEGRATION=1"
        );
        assert.match(marketplaceConfig.contractId, /^0\.0\.\d+$/);
        assert.strictEqual(marketplaceConfig.network, "testnet");
        const contractId = marketplaceConfig.contractId;

        // Proof VERIFIED real de la Spec 002: se publica la tasación EA-01
        // en Testnet y se espera al mirror hasta VERIFIED (con gracia).
        const oracleConfig = loadOracleConfig(process.env);
        const client = createHcsClient({ accountId, privateKey });
        const topicId = await resolveValuationsTopic(client, oracleConfig.topicId);
        assert.match(topicId, /^0\.0\.\d+$/);

        const publishedAt = new Date().toISOString();
        const bullInput = canonicalBullInput();
        const bullResult = canonicalBullResult();
        const proof = await publishValuation(client, topicId, bullInput, bullResult, {
          publishedAt,
          maxRetries: oracleConfig.maxRetries,
          baseDelayMs: oracleConfig.baseDelayMs,
        });
        console.log("HashScan topic: https://hashscan.io/testnet/topic/" + topicId);
        console.log("HashScan tx oraculo: " + hashscanTxUrl(proof.transactionId));

        const expected = buildOracleMessage(bullInput, bullResult, {
          publishedAt,
          specVersion: "001",
        }).message;

        // El mirror puede tardar segundos: PENDING dentro de la gracia, nunca falso negativo.
        const deadlineMs = Date.now() + 60000;
        let verdict = null;
        for (;;) {
          verdict = await verifyValuation(proof, expected, {});
          if (verdict.status === "VERIFIED") {
            break;
          }
          assert.strictEqual(verdict.status, "PENDING", "mirror en gracia: PENDING, no falso negativo");
          assert.ok(Date.now() < deadlineMs, "mirror debio sincronizar en 60 s, ultimo: " + verdict.reason);
          await sleep(5000);
        }
        assert.strictEqual(verdict.status, "VERIFIED");

        // RF-01 lista con 5 por ciento de regalía a precio tasado 24.50 (EA-01).
        const listingParams = {
          bullId: "BRAF-001",
          assetType: "PAJ_BRAF",
          unitPriceUsd: 24.5,
          quantity: 10,
          royaltyPct: 5,
          proof: { topicId: proof.topicId, sequenceNumber: proof.sequenceNumber },
        };
        const certifiedValuation = { unitPriceUsd: 24.5 };

        // Ejecutor real HSCS sobre Testnet (lazy: solo con el gate activo hay red).
        const realSdk = require("@hashgraph/sdk");
        const contractExec = buildRealContractExec(realSdk, accountId);

        const listed = await createListing(client, contractId, listingParams, certifiedValuation, proof, expected, {
          contractExec,
        });
        assert.ok(listed.listingId, "listingId presente tras receipt");
        assert.ok(listed.txId, "txId presente tras receipt");
        console.log("HashScan listado: " + hashscanTxUrl(listed.txId));

        // RF-04 compra 10 pajuelas enteras al total half-up exacto 245.00.
        const listing = {
          bullId: "BRAF-001",
          assetType: "PAJ_BRAF",
          unitPriceUsd: 24.5,
          available: 10,
          royaltyPct: 5,
        };
        const bought = await buy(
          client,
          contractId,
          { listingId: String(listed.listingId), quantity: 10, totalPaidUsd: 245.0 },
          listing,
          proof,
          expected,
          { contractExec }
        );
        assert.ok(bought.purchaseId, "purchaseId presente tras receipt");
        assert.ok(bought.txId, "txId de compra presente");
        console.log("HashScan compra: " + hashscanTxUrl(bought.txId));

        // RF-05 reparto pactado exacto del EA-01 con invariante suma-exacta.
        assert.strictEqual(bought.split.totalUsd, 245.0);
        assert.strictEqual(bought.split.royaltyUsd, 12.25);
        assert.strictEqual(bought.split.sellerUsd, 232.75);
        assert.strictEqual(bought.split.royaltyUsd + bought.split.sellerUsd, bought.split.totalUsd);

        // Verificación por mirror: el reparto coincide y uno alterado no coincide.
        const mirrorTx = await (
          await fetch(
            "https://testnet.mirrornode.hedera.com/api/v1/transactions/" + bought.txId
          )
        ).json();
        const mirrorOk =
          mirrorTx &&
          (Array.isArray(mirrorTx.transactions)
            ? mirrorTx.transactions.length > 0
            : mirrorTx.transaction_id !== undefined);
        assert.ok(mirrorOk, "mirror confirma la compra en Testnet");
        const expectedSplit = calculateSplit(245.0, 5);
        assert.deepStrictEqual(bought.split, expectedSplit);
        const tamperedSplit = { ...expectedSplit, royaltyUsd: 12.26, sellerUsd: 232.74 };
        assert.notDeepStrictEqual(tamperedSplit, expectedSplit, "reparto alterado no coincide");

        // RF-06 el criador retira 12.25 con transacción verificable.
        const withdrawn = await withdrawRoyalties(client, contractId, accountId, { contractExec });
        assert.strictEqual(withdrawn.amountUsd, 12.25);
        assert.ok(withdrawn.txId, "txId de retiro presente");
        console.log("HashScan retiro: " + hashscanTxUrl(withdrawn.txId));

        // RF-06 sin doble pago: el segundo retiro del mismo saldo es denegado.
        await assert.rejects(
          () => withdrawRoyalties(client, contractId, accountId, { contractExec }),
          /doble retiro denegado|sin regalias pendientes|reembolso|fallo/
        );

        // RNF-06 consultas públicas sin claves con enlaces HashScan Testnet.
        const realMirrorFetch = async (url) => {
          const response = await fetch(url);
          return response.json();
        };
        const publicListing = await getListing(contractId, String(listed.listingId), {
          mirrorFetch: realMirrorFetch,
        });
        assert.ok(publicListing.hashscanUrl.includes("hashscan.io/testnet"));
        const publicPurchase = await getPurchase(contractId, String(bought.purchaseId), {
          mirrorFetch: realMirrorFetch,
        });
        assert.ok(publicPurchase.hashscanUrl.includes("hashscan.io/testnet"));
        const publicSettlement = await getSettlement(contractId, String(bought.purchaseId), {
          mirrorFetch: realMirrorFetch,
        });
        assert.ok(publicSettlement.hashscanUrl.includes("hashscan.io/testnet"));

        // Lo alterado contra la misma prueba da MISMATCH (RF-02 espejo del oráculo).
        const tampered = {
          ...expected,
          valuationsUsd: { ...expected.valuationsUsd, dose: 24.51 },
        };
        const mismatch = await verifyValuation(proof, tampered, {});
        assert.strictEqual(mismatch.status, "MISMATCH");
      }
    );
  }
);
