# Tasks — Spec 005: Flujo End-to-End de Tokenización, Venta y Registro en Wallets (HTS + HCS)

> Desglose verificable del `plan.md` de la Spec 005. **TDD obligatorio** en cada tarea:
> test rojo → código → test verde. **Una tarea = una unidad pequeña** (el implementador
> ejecuta UNA sola tarea por sesión).
>
> Orden: puros (`src/logic/`) → infraestructura (`src/hedera/`) y contrato
> (`src/contracts/`) → publisher/verificador → orquestador/pureza/equivalencia/E2E.
>
> **Restricciones:** Node.js CommonJS · `@hashgraph/sdk` · `node --test` · sin dependencias
> nuevas · `src/logic/` puro (sin SDK) vs `src/hedera/` (red) vs `src/contracts/` (Solidity) ·
> español docs / inglés código camelCase · **Solo Testnet** · claves Admin/Treasury nunca expuestas.
> Tests en Windows: `node --test "tests/*.test.js"` (la forma `tests/` falla).

---

## Tarea 1: Lógica pura de tokenización (validación, supply y composición)
- **ID:** T1
- **RF cubiertos:** RF-01, RF-02, RF-03
- **Archivos:** `src/logic/tokenization.js` (nuevo), `tests/tokenization.test.js` (nuevo)
- **Test asociado:** `tests/tokenization.test.js`
- **Hecho cuando:** `node --test "tests/tokenization.test.js"` pasa en verde Y `validateTokenizationParams` rechaza sin APTO/VERIFIED (RF-03), `normalizeBullSupply` acepta 1..10 y por defecto 10 (RF-02), y `composeTokenizationResult` no incluye `txIds` de allowance.
- [x] Escribir primero los tests rojos: elegibilidad (apto+VERIFIED), `pajuelaCount` entero > 0, `bullSupply` 1..10/por defecto 10, y salida `{ pajBrafTokenId, bullTokenId, bullSupply, txIds:{pajBraf,bull}, hashscanUrls }`.
- [x] Implementar `validateTokenizationParams`, `normalizeBullSupply` y `composeTokenizationResult` (puro, sin SDK, sin `process.env`).

## Tarea 2: Lógica pura de allowance (unidades base y validación de estado)
- **ID:** T2
- **RF cubiertos:** RF-06, RF-11
- **Archivos:** `src/logic/allowance.js` (nuevo), `tests/allowance.test.js` (nuevo)
- **Test asociado:** `tests/allowance.test.js`
- **Hecho cuando:** `node --test "tests/allowance.test.js"` pasa en verde Y `validateAllowanceState` lanza ante allowance ausente/insuficiente (usada por la reversión de RF-11).
- [x] Tests rojos: `toBaseUnits` (0 y 4 decimales, sin pérdida), `calculateRequiredAllowance` (valida decimales por activo), `validateAllowanceState` (ok vs insuficiente/ausente/revocada).
- [x] Implementar los tres helpers puros en `src/logic/allowance.js` y exportarlos.

## Tarea 3: Mensaje canónico de compra y coincidencia pura
- **ID:** T3
- **RF cubiertos:** RF-13, RF-14, RF-16
- **Archivos:** `src/logic/purchaseMessage.js` (nuevo), `tests/purchaseMessage.test.js` (nuevo)
- **Test asociado:** `tests/purchaseMessage.test.js`
- **Hecho cuando:** `node --test "tests/purchaseMessage.test.js"` pasa en verde Y el mensaje lleva `kind:"purchase"`/`specVersion:"005"`/`schemaVersion:1` con `purchaseKey` sha256 estable, y `verifyPurchaseMessageContent` devuelve `MISMATCH` ante `specVersion`/`kind` ajenos o un campo alterado.
- [x] Tests rojos: construcción canónica (claves ordenadas), `purchaseKey` estable, discriminador vs. mensaje de tasación de 002, y `VERIFIED`/`MISMATCH` por campo.
- [x] Implementar `buildPurchaseMessage` y `verifyPurchaseMessageContent` reutilizando `toCanonicalJson`/comparación de `oracleMessage.js` (sin SDK).

## Tarea 4: Lógica pura de reglas de compra (+ exports de 003)
- **ID:** T4
- **RF cubiertos:** RF-07, RF-08, RF-09
- **Archivos:** `src/logic/purchaseRules.js` (nuevo), `src/logic/marketplace.js` (modificar: **solo** exportar `assertQuantityForAsset`/`countDecimals`), `tests/purchaseRules.test.js` (nuevo)
- **Test asociado:** `tests/purchaseRules.test.js`
- **Hecho cuando:** `node --test "tests/purchaseRules.test.js"` pasa en verde Y `validatePurchaseInput` rechaza PAJ fraccionado, BULL > 4 decimales, > supply 10, > saldo y precio 0 (reutilizando las reglas de 003, sin duplicarlas).
- [x] Test rojo: casos de aceptación (PAJ entero / BULL ≤4 dec.) y rechazos de RF-09 (incluido precio 0).
- [x] Exportar `assertQuantityForAsset`/`countDecimals` desde `marketplace.js` (sin cambiar reglas) e implementar `validatePurchaseInput` + `composePurchaseResult` con `calculateSplit`/`roundHalfUp2` de 003.

## Tarea 5: Config de tokens + token manager de PAJ-BRAF
- **ID:** T5
- **RF cubiertos:** RF-01
- **Archivos:** `config/tokens.config.js` (nuevo), `src/hedera/pajBrafManager.js` (nuevo), `tests/pajBrafManager.test.js` (nuevo)
- **Test asociado:** `tests/pajBrafManager.test.js`
- **Hecho cuando:** `node --test "tests/pajBrafManager.test.js"` pasa en verde Y con `deps.sdk` falso se crea el token `PAJ-BRAF` (0 decimales, claves Admin/Treasury) y se emite el lote completo sin tocar la red.
- [ ] Test rojo con SDK falso: `TokenCreateTransaction` + `TokenMintTransaction` + receipt con `tokenId`.
- [ ] Implementar `loadTokenConfig` (patrón `config/oracle.config.js`) y `pajBrafManager.js` con `deps.sdk` inyectable; sin claves en logs.

## Tarea 6: Token manager de BULL
- **ID:** T6
- **RF cubiertos:** RF-02
- **Archivos:** `src/hedera/bullManager.js` (nuevo), `tests/bullManager.test.js` (nuevo)
- **Test asociado:** `tests/bullManager.test.js`
- **Hecho cuando:** `node --test "tests/bullManager.test.js"` pasa en verde Y con `deps.sdk` falso se crea `BULL` (4 decimales, `maxSupply=10`, claves Admin/Treasury) y se acuñan `bullSupply` unidades a la treasury.
- [ ] Test rojo con SDK falso: creación con decimales/supply correctos y acuñación a la treasury.
- [ ] Implementar `bullManager.js` reutilizando `loadTokenConfig` de T5.

## Tarea 7: Asociación de tokens a wallets (idempotente)
- **ID:** T7
- **RF cubiertos:** RF-04, RF-05
- **Archivos:** `src/hedera/tokenAssociator.js` (nuevo), `tests/tokenAssociator.test.js` (nuevo)
- **Test asociado:** `tests/tokenAssociator.test.js`
- **Hecho cuando:** `node --test "tests/tokenAssociator.test.js"` pasa en verde Y la asociación de la cabaña no exige APTO/VERIFIED (idempotente) mientras que el fallo de asociación del comprador impide la compra.
- [ ] Test rojo con doble: asociación idempotente (ya asociado no re-asocia), y error que propaga bloqueo de compra.
- [ ] Implementar `tokenAssociator.js` (`AssociateTransaction`).

## Tarea 8: Gestor de allowance HIP-336 (approve/revoke/reintentos)
- **ID:** T8
- **RF cubiertos:** RF-06, RF-17
- **Archivos:** `src/hedera/allowanceManager.js` (nuevo), `tests/allowanceManager.test.js` (nuevo)
- **Test asociado:** `tests/allowanceManager.test.js`
- **Hecho cuando:** `node --test "tests/allowanceManager.test.js"` pasa en verde Y con `submitFn`/`sleepFn` inyectados la approve es idempotente, revocable y reintenta solo ante error retryable (nunca confirma sin receipt).
- [ ] Test rojo: approve (spender = contrato, **D-08 decisión del plan: amplia y revocable por lote**), revoke, dedup y clasificación retryable/no-retryable.
- [ ] Implementar `allowanceManager.js` reutilizando `calculateRequiredAllowance` (T2) y el patrón de reintentos de `oraclePublisher.js`.

## Tarea 9: Contrato `MuurketplaceAtomic.sol`
- **ID:** T9
- **RF cubiertos:** RF-10, RF-11 (B3: conserva listado/cancelación/consultas; elimina retiro diferido)
- **Archivos:** `src/contracts/MuurketplaceAtomic.sol` (nuevo), `tests/atomicContract.test.js` (nuevo)
- **Test asociado:** `tests/atomicContract.test.js`
- **Hecho cuando:** `node --test "tests/atomicContract.test.js"` pasa en verde Y el fuente declara `createListing`/`cancelListing`/`getListing`/`isSettled`, **no** declara `withdrawRoyalties`/`pendingRoyalties`, e incluye `buyAtomic` (`payable`, `transferToken` `0x167`, split inmediato, `require` de allowance/saldo/fondos).
- [ ] Test rojo: aserciones sobre el contrato (cabecera de funciones presentes/ausentes, uso de `0x167`, patrón de `require` que garantiza reversión total, generación determinista de `purchaseId`).
- [ ] Implementar `MuurketplaceAtomic.sol` (reimplementa la regla half-up R-REV-01 en Solidity; sin escrow; solo listados nuevos D-09).

## Tarea 10: Ejecutor de la compra atómica (HSCS)
- **ID:** T10
- **RF cubiertos:** RF-07, RF-08, RF-10, RF-11, RF-15
- **Archivos:** `src/hedera/atomicPurchaseClient.js` (nuevo), `tests/atomicPurchaseClient.test.js` (nuevo)
- **Test asociado:** `tests/atomicPurchaseClient.test.js`
- **Hecho cuando:** `node --test "tests/atomicPurchaseClient.test.js"` pasa en verde Y con `contractExec` doble se realiza **una sola** transacción atómica (devuelve `atomicTxId`), la reversión se propaga como `reembolso/atómico` sin resultado parcial, y se componen los saldos buyer/seller (RF-15).
- [ ] Test rojo: éxito (una tx + `atomicTxId` + saldos), reversión (sin movimiento ni salida parcial) para PAJ entero y BULL fraccionario.
- [ ] Implementar `atomicPurchaseClient.js` invocando el contrato de T9 una sola vez y componiendo con `composePurchaseResult` (T4).

## Tarea 11: Config de marketplace + publisher de compra en el topic de 002
- **ID:** T11
- **RF cubiertos:** RF-12, RF-13, RF-14, RF-17
- **Archivos:** `config/marketplace.config.js` (modificar: `contractId` + reutilizar `topicId` de 002), `src/hedera/purchasePublisher.js` (nuevo), `tests/purchasePublisher.test.js` (nuevo)
- **Test asociado:** `tests/purchasePublisher.test.js`
- **Hecho cuando:** `node --test "tests/purchasePublisher.test.js"` pasa en verde Y el publisher publica **exactamente un** mensaje en el topic de 002 (reutilizado), falla sin topic configurado sin crear uno nuevo (RF-12), y deduplica/reintenta por `purchaseId` (RF-17).
- [ ] Test rojo con `deps.sdk`/`submitFn`/`sleepFn`: 1 mensaje con proof de consenso, error sin topic, dedup en-vuelo + caché, reintentos acotados.
- [ ] Implementar `loadMarketplaceConfig` (contrato + topic de 002) y `purchasePublisher.js` con el `canonicalJson` de T3 (patrón `oraclePublisher.js`).

## Tarea 12: Verificador de compras propio
- **ID:** T12
- **RF cubiertos:** RF-16
- **Archivos:** `src/hedera/purchaseVerifier.js` (nuevo), `tests/purchaseVerifier.test.js` (nuevo)
- **Test asociado:** `tests/purchaseVerifier.test.js`
- **Hecho cuando:** `node --test "tests/purchaseVerifier.test.js"` pasa en verde Y con `mirrorFetch` doble devuelve `VERIFIED` (coincidencia íntegra), `MISMATCH` (campo alterado / discriminador ajeno) y `PENDING` (sin sincronizar), **sin** usar ni modificar `oracleVerifier.js` de 002.
- [ ] Test rojo: 3 estados + discriminación por `kind`/`specVersion` + `PENDING` sin falsos negativos.
- [ ] Implementar `purchaseVerifier.js` (mirror REST, base64→utf8) con la coincidencia pura de T3.

## Tarea 13: Test de equivalencia del split (EA-01, N2)
- **ID:** T13
- **RF cubiertos:** RF-10 (equivalencia R-REV-01)
- **Archivos:** `tests/splitEquivalence.test.js` (nuevo)
- **Test asociado:** `tests/splitEquivalence.test.js`
- **Hecho cuando:** `node --test "tests/splitEquivalence.test.js"` pasa en verde Y la tabla de casos half-up reproduce `$245.00 → $12.25 / $232.75` idénticamente con la referencia pura de `src/logic/marketplace.js` y con la lógica de reparto que replica el contrato (T9), cubriendo bordes de medio céntimo.
- [ ] Test rojo: tabla de casos (incluido EA-01 M_TOTAL=2.45) comparando la implementación pura con la réplica numérica del contrato.
- [ ] Ajustar (si hace falta) la réplica para que coincida exactamente con `roundHalfUp2`/`calculateSplit`.

## Tarea 14: Pureza de `src/logic/` (extender el test existente)
- **ID:** T14
- **RF cubiertos:** RNF-01
- **Archivos:** `tests/purity.test.js` (extender)
- **Test asociado:** `tests/purity.test.js`
- **Hecho cuando:** `node --test "tests/purity.test.js"` pasa en verde Y verifica que **ningún** archivo de `src/logic/` (incluidos `tokenization.js`, `allowance.js`, `purchaseMessage.js`, `purchaseRules.js`) importa `@hashgraph/sdk` ni accede a red/`process.env`/`fs`/`Date.now`/`Math.random`.
- [ ] Ampliar el test estático de pureza para cubrir los nuevos módulos puros.
- [ ] Corregir cualquier import impuro detectado (sin tocar `src/hedera/`).

## Tarea 15: Orquestador end-to-end
- **ID:** T15
- **RF cubiertos:** RF-01 a RF-17 (composición)
- **Archivos:** `src/hedera/purchaseOrchestrator.js` (nuevo), `tests/purchaseOrchestrator.test.js` (nuevo)
- **Test asociado:** `tests/purchaseOrchestrator.test.js`
- **Hecho cuando:** `node --test "tests/purchaseOrchestrator.test.js"` pasa en verde Y con dobles (SDK, contractExec, mirrorFetch) se compone el flujo tokenizar → asociar → allowance → compra atómica → publicar compra → verificar, sin red real.
- [ ] Test rojo de composición end-to-end con todos los dobles.
- [ ] Implementar `purchaseOrchestrator.js` encadenando T5–T12 y devolviendo la salida de compra (`atomicTxId`, `split`, `purchaseProof`).

## Tarea 16: E2E gateada en Testnet (NO bloquea el verde local)
- **ID:** T16
- **RF cubiertos:** RF-01 a RF-17 (verificación real)
- **Archivos:** `tests/tokenizationIntegration.test.js` (nuevo)
- **Test asociado:** `tests/tokenizationIntegration.test.js` (gateada por `RUN_TOKENIZATION_INTEGRATION=1`)
- **Hecho cuando:** `node --test "tests/*.test.js"` pasa en verde local **sin** la variable (test omitido), y con `RUN_TOKENIZATION_INTEGRATION=1` + credenciales Testnet + `MuurketplaceAtomic.sol` desplegado ejecuta el flujo real end-to-end.
- [ ] Escribir el test gateado que **omite** por defecto (sin `RUN_TOKENIZATION_INTEGRATION=1`) para no bloquear CI/local.
- [ ] **Depende de Testnet real:** credenciales Testnet (`.env`) y `MuurketplaceAtomic.sol` **desplegado**; verifica reversión atómica real y movimiento vía `0x167` (N5).

## Tarea 17: Cierre — actualizar `MEMORY.md`
- **ID:** T17
- **RF cubiertos:** (cierre; cobertura completa RF-01 a RF-17 vía tabla de trazabilidad)
- **Archivos:** `MEMORY.md` (modificar)
- **Test asociado:** `node --test "tests/*.test.js"` (suite completa en verde)
- **Hecho cuando:** `node --test "tests/*.test.js"` pasa en verde Y `MEMORY.md` registra la Spec 005 completada con el nº de tests y el estado de la E2E gateada.
- [ ] Actualizar `MEMORY.md` con el cierre de la Spec 005 (specs 001–005 completas, nº de tests, E2E pendiente de Testnet si aplica).

---

## Trazabilidad RF → tarea(s) → test

| RF | Tarea(s) | Test |
|----|----------|------|
| RF-01 | T1, T5 | `tests/tokenization.test.js`, `tests/pajBrafManager.test.js` |
| RF-02 | T1, T6 | `tests/tokenization.test.js`, `tests/bullManager.test.js` |
| RF-03 | T1 | `tests/tokenization.test.js` |
| RF-04 | T7 | `tests/tokenAssociator.test.js` |
| RF-05 | T7 | `tests/tokenAssociator.test.js` |
| RF-06 | T2, T8 | `tests/allowance.test.js`, `tests/allowanceManager.test.js` |
| RF-07 | T4, T10 | `tests/purchaseRules.test.js`, `tests/atomicPurchaseClient.test.js` |
| RF-08 | T4, T10 | `tests/purchaseRules.test.js`, `tests/atomicPurchaseClient.test.js` |
| RF-09 | T4 | `tests/purchaseRules.test.js` |
| RF-10 | T9, T10, T13 | `tests/atomicContract.test.js`, `tests/atomicPurchaseClient.test.js`, `tests/splitEquivalence.test.js` |
| RF-11 | T2, T9, T10 | `tests/allowance.test.js`, `tests/atomicContract.test.js`, `tests/atomicPurchaseClient.test.js` |
| RF-12 | T11 | `tests/purchasePublisher.test.js` |
| RF-13 | T3, T11 | `tests/purchaseMessage.test.js`, `tests/purchasePublisher.test.js` |
| RF-14 | T3, T11 | `tests/purchaseMessage.test.js`, `tests/purchasePublisher.test.js` |
| RF-15 | T10 | `tests/atomicPurchaseClient.test.js` |
| RF-16 | T3, T12 | `tests/purchaseMessage.test.js`, `tests/purchaseVerifier.test.js` |
| RF-17 | T8, T11 | `tests/allowanceManager.test.js`, `tests/purchasePublisher.test.js` |

**Cobertura transversal:** RNF-01 → T14 (`tests/purity.test.js`); RNF-03 (claves nunca expuestas) verificada en T5/T6/T8/T11; composición RF-01..RF-17 → T15 (`tests/purchaseOrchestrator.test.js`) y T16 (E2E gateada).

## Tareas que dependen de Testnet real (no bloquean el verde local)

- **T16 — E2E gateada:** requiere `RUN_TOKENIZATION_INTEGRATION=1`, credenciales Testnet (`.env`) y `MuurketplaceAtomic.sol` **desplegado** en Testnet. Verifica la reversión atómica real y el movimiento vía `0x167` (N5). Por defecto el test se **omite** sin esa variable, por lo que `node --test "tests/*.test.js"` pasa en verde local.

El resto de tareas (T1–T15, T17) se ejecutan **sin red** mediante dobles inyectables (`deps.sdk`, `submitFn`, `sleepFn`, `contractExec`, `mirrorFetch`).
