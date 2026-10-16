// Test E2E gateado contra proyecto Supabase de test (T8 spec 004, RF-01 a RF-08).
// Comentarios en español; código en inglés camelCase.
// Gateado: se salta salvo RUN_SUPABASE_INTEGRATION=1 + SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY (+ MY_ACCOUNT_ID + MY_PRIVATE_KEY solo para la
// proof VERIFIED real vía el verificador existente).
// Sin la variable, `node --test tests/` sigue en verde sin tocar la red.
// Única prueba con red de la spec (plan §4.5, R-08). Solo Testnet.
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Gate: solo corre con red cuando el operador lo pide explícitamente.
const RUN_INTEGRATION = process.env.RUN_SUPABASE_INTEGRATION === "1";

// Entrada canónica EA-01 Spec 001 (11 campos PEGBraf + bullId único por corrida).
function canonicalBullInput(bullId) {
  return {
    bullId,
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

// Espera simple entre reintentos de verificación contra el mirror.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("T8 E2E Supabase gateada (RF-01 a RF-08 punta a punta)", { skip: !RUN_INTEGRATION }, () => {
  it("guarda toro+valuación, idempotencia, PENDING bloquea, VERIFIED habilita, compra sin duplicado", { timeout: 180000 }, async () => {
    // Requires dentro del gate: sin el gate no tocan red ni SDK.
    const { evaluateBull } = require("../src/logic/evaluateBull.js");
    const { buildBullRecord, buildValuationRecord } = require("../src/logic/mirrorRules.js");
    const { buildOracleMessage } = require("../src/logic/oracleMessage.js");
    const { calculateSplit } = require("../src/logic/marketplace.js");
    const { createSupabaseClient } = require("../src/db/supabaseClient.js");
    const { saveBull, getBull, findBulls } = require("../src/db/bullsRepo.js");
    const { saveValuation, getValuation, findValuationsByBullId } = require("../src/db/valuationsRepo.js");
    const { saveProof, getProof, updateProofStatus, findProofsByStatus } = require("../src/db/proofsRepo.js");
    const { saveListing, savePurchase, settlePurchase, getListing, getPurchase } = require("../src/db/listingsRepo.js");
    const { loadOracleConfig } = require("../config/oracle.config.js");
    const { createHcsClient } = require("../src/hedera/hcsClient.js");
    const { resolveValuationsTopic } = require("../src/hedera/topicManager.js");
    const { publishValuation } = require("../src/hedera/oraclePublisher.js");
    const { verifyValuation } = require("../src/hedera/oracleVerifier.js");

    // Credenciales solo desde el entorno, nunca del repo.
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.ok(supabaseUrl, "SUPABASE_URL requerido con RUN_SUPABASE_INTEGRATION=1");
    assert.ok(serviceKey, "SUPABASE_SERVICE_ROLE_KEY requerido con RUN_SUPABASE_INTEGRATION=1");
    const anonKey = process.env.SUPABASE_ANON_KEY || serviceKey;
    const accountId = process.env.MY_ACCOUNT_ID;
    const privateKey = process.env.MY_PRIVATE_KEY;
    assert.ok(accountId, "MY_ACCOUNT_ID requerido con RUN_SUPABASE_INTEGRATION=1 (proof VERIFIED real)");
    assert.ok(privateKey, "MY_PRIVATE_KEY requerido con RUN_SUPABASE_INTEGRATION=1 (proof VERIFIED real)");

    // Clientes por rol: escritura server-side con service_role, lectura con anon.
    const writer = createSupabaseClient({ url: supabaseUrl, key: serviceKey });
    const reader = createSupabaseClient({ url: supabaseUrl, key: anonKey });

    // Identificadores únicos por corrida (evitan colisión entre corridas).
    const runId = String(Date.now());
    const bullId = "BRAF-E2E-" + runId;
    const listingId = "LIST-E2E-" + runId;
    const purchaseId = "BUY-E2E-" + runId;
    const publishedAt = new Date().toISOString();

    // RF-01/RF-02: toro evaluado por 001 y valuación con valuationKey estable.
    const bullInput = canonicalBullInput(bullId);
    const bullResult = evaluateBull(bullInput);
    assert.strictEqual(bullResult.apto, true);
    const bullRecord = buildBullRecord(bullInput, bullResult);
    const valuationRecord = buildValuationRecord(bullInput, bullResult, { publishedAt });
    assert.strictEqual(valuationRecord.specVersion, "001");

    const savedBull = await saveBull(writer, bullRecord);
    assert.strictEqual(savedBull.bull.bullId, bullId);
    const firstVal = await saveValuation(writer, valuationRecord);
    assert.strictEqual(firstVal.existed, false);

    // Reintento misma valuationKey: devuelve el original sin duplicar (conteo = 1).
    const retryVal = await saveValuation(writer, { ...valuationRecord });
    assert.strictEqual(retryVal.existed, true);
    assert.strictEqual(retryVal.valuation.record.valuationKey, valuationRecord.valuationKey);
    assert.strictEqual(retryVal.valuation.record.mTotal, valuationRecord.mTotal);
    const { data: valRows, error: valErr } = await writer
      .from("valuations")
      .select("*")
      .eq("valuation_key", valuationRecord.valuationKey);
    assert.ifError(valErr);
    assert.strictEqual(valRows.length, 1);

    // Proof VERIFIED real vía Testnet: publica EA-01 y espera al mirror.
    const oracleConfig = loadOracleConfig(process.env);
    const hcsClient = createHcsClient({ accountId, privateKey });
    const topicId = await resolveValuationsTopic(hcsClient, oracleConfig.topicId);
    assert.match(topicId, /^0\.0\.\d+$/);
    const proof = await publishValuation(hcsClient, topicId, bullInput, bullResult, {
      publishedAt,
      maxRetries: oracleConfig.maxRetries,
      baseDelayMs: oracleConfig.baseDelayMs,
    });
    console.log("HashScan topic: https://hashscan.io/testnet/topic/" + topicId);
    console.log("HashScan tx oraculo: https://hashscan.io/testnet/transaction/" + proof.transactionId);
    const expected = buildOracleMessage(bullInput, bullResult, { publishedAt, specVersion: "001" }).message;

    // RF-03: guarda proof PENDING ligada a su valuationKey.
    const pendingProof = {
      valuationKey: valuationRecord.valuationKey,
      topicId: proof.topicId,
      sequenceNumber: proof.sequenceNumber,
      consensusTimestamp: proof.consensusTimestamp,
      transactionId: proof.transactionId,
      status: "PENDING",
    };
    const savedPending = await saveProof(writer, pendingProof, { status: "PENDING" });
    assert.strictEqual(savedPending.proof.status, "PENDING");

    // RF-04: con PENDING el listado se bloquea (lanza antes de escribir).
    const listingDraft = {
      listingId,
      valuationKey: valuationRecord.valuationKey,
      assetType: "PAJ_BRAF",
      unitPriceUsd: valuationRecord.priceDoseUsd,
      quantity: 10,
    };
    await assert.rejects(() => saveListing(writer, listingDraft, "PENDING"), /sin proof VERIFIED/i);

    // RF-08: el mirror confirma y la proof PENDING pasa a VERIFIED sin
    // reescribir su historia (conserva topicId/sequenceNumber/txId).
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
    const promoted = await updateProofStatus(writer, valuationRecord.valuationKey, "VERIFIED", {
      status: "VERIFIED",
    });
    assert.strictEqual(promoted.proof.status, "VERIFIED");
    assert.strictEqual(promoted.proof.topicId, pendingProof.topicId);
    assert.strictEqual(String(promoted.proof.sequenceNumber), String(pendingProof.sequenceNumber));
    assert.strictEqual(promoted.proof.transactionId, pendingProof.transactionId);

    // RF-05: con VERIFIED vigente guarda listado/compra/liquidación.
    const savedListing = await saveListing(writer, listingDraft, "VERIFIED");
    assert.strictEqual(savedListing.listing.listingId, listingId);
    const totalUsd = Math.round(listingDraft.unitPriceUsd * listingDraft.quantity * 100) / 100;
    const split = calculateSplit(totalUsd, 5);
    const purchase = {
      listingId,
      purchaseId,
      valuationKey: valuationRecord.valuationKey,
      assetType: "PAJ_BRAF",
      unitPriceUsd: listingDraft.unitPriceUsd,
      quantity: listingDraft.quantity,
      royaltyPct: 5,
      royaltyUsd: split.royaltyUsd,
      sellerUsd: split.sellerUsd,
      totalUsd: split.totalUsd,
      purchaseTxId: proof.transactionId,
      settlementTxId: null,
      settled: false,
    };
    const savedPurchase = await savePurchase(writer, purchase);
    assert.strictEqual(savedPurchase.purchase.purchaseId, purchaseId);
    const settled = await settlePurchase(writer, purchaseId, proof.transactionId);
    assert.strictEqual(settled.purchase.settled, true);

    // RF-06: reintento del mismo purchaseId sin duplicado ni reacreditación.
    const repurchase = await savePurchase(writer, { ...purchase });
    assert.strictEqual(repurchase.existed, true);
    assert.strictEqual(repurchase.purchase.totalUsd, savedPurchase.purchase.totalUsd);
    assert.strictEqual(repurchase.purchase.royaltyUsd, savedPurchase.purchase.royaltyUsd);
    const { data: buyRows, error: buyErr } = await writer
      .from("purchases")
      .select("*")
      .eq("purchase_id", purchaseId);
    assert.ifError(buyErr);
    assert.strictEqual(buyRows.length, 1);
    await assert.rejects(
      () => settlePurchase(writer, purchaseId, proof.transactionId),
      /doble liquidación/i
    );

    // RF-07: consultas por cada clave devuelven referencia HashScan Testnet.
    const proofForView = promoted.proof;
    const bullView = await getBull(reader, bullId, proofForView);
    assert.strictEqual(bullView.record.bullId, bullId);
    const valView = await getValuation(reader, valuationRecord.valuationKey, proofForView);
    assert.ok(valView.mirrorUrl.includes("testnet.mirrornode.hedera.com"));
    assert.ok(valView.hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    assert.strictEqual(valView.unverified, false);
    const proofView = await getProof(reader, valuationRecord.valuationKey);
    assert.strictEqual(proofView.record.valuationKey, valuationRecord.valuationKey);
    assert.strictEqual(proofView.unverified, false);
    const listingView = await getListing(reader, listingId, proofForView);
    assert.strictEqual(listingView.record.listingId, listingId);
    assert.ok(listingView.hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    const purchaseView = await getPurchase(reader, purchaseId, proofForView);
    assert.strictEqual(purchaseView.record.purchaseId, purchaseId);
    assert.ok(purchaseView.hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    const byBull = await findValuationsByBullId(reader, bullId, {
      [valuationRecord.valuationKey]: proofForView,
    });
    assert.strictEqual(byBull.length, 1);
    assert.ok(byBull[0].hashscanUrl.includes("hashscan.io/testnet/transaction/"));
    const byStatus = await findProofsByStatus(reader, "VERIFIED");
    assert.ok(byStatus.some((v) => v.record.valuationKey === valuationRecord.valuationKey));
    const bulls = await findBulls(reader);
    assert.ok(bulls.some((v) => v.record.bullId === bullId));
  });
});
