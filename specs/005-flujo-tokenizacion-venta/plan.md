# Plan Técnico — Spec 005: Flujo End-to-End de Tokenización, Venta y Registro en Wallets (HTS + HCS)

> Este plan implementa el QUÉ de `spec.md` (RF-01 a RF-17). No revalida ni retasa
> (Spec 001), no reimplementa el mensaje ni el verificador de tasación (Spec 002),
> no redefine el split ni el listado (Spec 003) y no reimplementa el espejo (Spec 004):
> los consume. Sigue las convenciones del proyecto: Node.js CommonJS, `@hashgraph/sdk`,
> `node --test`, sin dependencias nuevas, `src/logic/` puro (sin SDK) vs. `src/hedera/`
> (red) vs. `src/contracts/` (Solidity), docs en español, código en inglés camelCase,
> Solo Testnet, claves Admin/Treasury nunca expuestas.

## Archivos a Crear/Modificar

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/logic/tokenization.js` **nuevo** | Validación pura de la tokenización: elegibilidad (apto+VERIFIED), reglas de cantidad de `PAJ-BRAF` (lote) y de `BULL` (≤10 unidades), y composición de la salida `{ pajBrafTokenId, bullTokenId, bullSupply, txIds, hashscanUrls }`. Sin SDK. RF-01/RF-02/RF-03. |
| `src/logic/allowance.js` **nuevo** | Cálculo puro de la allowance requerida (unidades base por decimales), normalización de cantidades y validación del estado de allowance. Sin SDK. RF-06/RF-11. |
| `src/logic/purchaseMessage.js` **nuevo** | Mensaje canónico de compra (`kind:"purchase"`, `specVersion:"005"`), `purchaseKey` sha256 estable y coincidencia pura de contenido. Espeja `oracleMessage.js`. Sin SDK. RF-13/RF-14/RF-16. |
| `src/logic/purchaseRules.js` **nuevo** | Validación pura de la compra (cantidad por activo, supply/saldo, precio > 0), reutilización del split (`calculateSplit`/`roundHalfUp2` de `marketplace.js`) y composición del resultado de compra. Sin SDK. RF-07/RF-08/RF-09/RF-10/RF-15. |
| `src/logic/marketplace.js` **modificar (solo exports)** | Exportar el helper puro existente `assertQuantityForAsset` (y `countDecimals`) para reutilizarlos **sin duplicar** las reglas de cantidad de 003. No se cambia ninguna regla ni semántica. |
| `src/hedera/pajBrafManager.js` **nuevo** | Token manager HTS de `PAJ-BRAF`: crear token (0 decimales, claves Admin/Treasury, treasury = cabaña) y emitir el lote completo. RF-01. |
| `src/hedera/bullManager.js` **nuevo** | Token manager HTS de `BULL`: crear token (4 decimales, supply máx. 10, claves Admin/Treasury) y acuñar las unidades a la treasury. RF-02. |
| `src/hedera/tokenAssociator.js` **nuevo** | `AssociateTransaction` idempotente a la wallet de la cabaña y del comprador antes de recibir/transferir. RF-04/RF-05. |
| `src/hedera/allowanceManager.js` **nuevo** | `AccountAllowanceApproveTransaction` (HIP-336, spender = contrato) y su revocación; idempotente y con reintentos acotados. RF-06/RF-17. |
| `src/hedera/atomicPurchaseClient.js` **nuevo** | Invoca la **única** transacción HSCS de `MuurketplaceAtomic.sol` (pago HBAR + transferencia HTS vía `0x167` + split inmediato), traduce fallo/reversión a error atómico y devuelve `atomicTxId`/saldos. RF-07/RF-08/RF-10/RF-11/RF-15. |
| `src/hedera/purchasePublisher.js` **nuevo** | Publica exactamente 1 mensaje de compra en el **topic de la Spec 002** (reutilizado) con proof de consenso, reintentos acotados e idempotencia por `purchaseId`/`purchaseKey`. RF-12/RF-13/RF-14/RF-17. |
| `src/hedera/purchaseVerifier.js` **nuevo** | Verificador de compras propio (mirror node REST) con estados `VERIFIED`/`MISMATCH`/`PENDING`; **no** usa ni altera `oracleVerifier.js` de 002. RF-16. |
| `src/hedera/purchaseOrchestrator.js` **nuevo** | Orquesta el flujo end-to-end (tokenizar → asociar → allowance → compra atómica → publicar compra → verificar), componiendo módulos puros e infra. RF-01 a RF-17. |
| `src/contracts/MuurketplaceAtomic.sol` **nuevo** | Contrato atómico que **reemplaza por completo** a `Muurketplace.sol`: conserva `createListing`/`cancelListing`/consultas, elimina `withdrawRoyalties`/`pendingRoyalties`, y ejecuta compra atómica (HBAR + `transferToken` `0x167` + split inmediato). RF-10/RF-11 + B3. |
| `config/tokens.config.js` **nuevo** | Carga la configuración de tokens (`loadTokenConfig`): nombres/símbolos, decimales (`0` PAJ/BULL `4`), supply máx. `BULL`, `contractId` de `MuurketplaceAtomic`. Patrón de `config/oracle.config.js`/`marketplace.config.js`. |
| `config/marketplace.config.js` **modificar** | Añadir `contractId` de `MuurketplaceAtomic.sol` y reutilizar el `topicId` de tasaciones de 002 (no se crea topic nuevo). |
| `tests/*.test.js` **nuevos** | Un test por RF (dobles sin red) + 1 E2E gateada + equivalencia del split (ver Estrategia de Tests). |
| `MEMORY.md` **modificar** | Registrar Spec 005 completada y nº de tests tras el cierre. |

## Funciones Puras (src/logic/)

> Todas las funciones de `src/logic/` son deterministas y **ninguna** importa
> `@hashgraph/sdk`, `process.env`, red, `fs`, `Date.now` ni `Math.random`
> (`publishedAt` y el `nowMs` llegan por parámetro). Verificado por `tests/purity.test.js`.

### `validateTokenizationParams(params, certifiedValuation, proof)`
- **RF cubiertos:** RF-01, RF-02, RF-03
- **Input:** `{ params: { bullId, pajuelaCount, bullSupply, cabanaAccountId, contractId }, certifiedValuation: object, proof: object }` — datos de entrada de tokenización del Contrato de datos.
- **Output:** `{ tokenization: { bullId, pajuelaCount, bullSupply, cabanaAccountId, contractId } }` normalizado, o lanza `Error`.
- **Pseudocódigo:**
  ```
  si params no es objeto → lanzar "parámetros de tokenización inválidos"
  si bullId no es string no-vacío → lanzar "bullId requerido"
  // RF-03: precondición transversal (apto de 001 + VERIFIED de 002)
  si certifiedValuation no tiene (mTotal, tasacionToroUsd, tasacionDosisUsd) → lanzar "sin veredicto APTO"
  si proof no es objeto con topicId no-vacío → lanzar "sin proof VERIFIED"
  // RF-01: lote de PAJ-BRAF entero y positivo
  si pajuelaCount no es entero > 0 → lanzar "pajuelaCount debe ser entero > 0"
  // RF-02: BULL hasta 10 unidades, 4 decimales; por defecto 10
  bullSupplyNormalizado = normalizeBullSupply(params.bullSupply)
  si cabanaAccountId no es string no-vacío → lanzar "cabanaAccountId requerido"
  devolver { tokenization: {...} }
  ```

### `normalizeBullSupply(bullSupply)`
- **RF cubiertos:** RF-02
- **Input:** `bullSupply: number | undefined` — unidades `BULL` a acuñar.
- **Output:** `number` — `10` por defecto; entero `1..10`; lanza si es inválido.
- **Pseudocódigo:**
  ```
  si bullSupply es undefined → devolver 10
  si no es número finito → lanzar "bullSupply inválido"
  si no es entero o es < 1 o es > 10 → lanzar "bullSupply fuera de rango 1..10"
  devolver bullSupply
  ```

### `composeTokenizationResult(rawReceipts)`
- **RF cubiertos:** RF-01, RF-02
- **Input:** `{ pajBrafTokenId, bullTokenId, bullSupply, pajBrafTxId, bullTxId }` — recibos crudos de los token managers.
- **Output:** `{ pajBrafTokenId, bullTokenId, bullSupply, txIds: { pajBraf, bull }, hashscanUrls: { pajBraf, bull } }` — salida de tokenización (solo RF-01/RF-02; **sin** txIds de allowance, que pertenecen a RF-06).
- **Pseudocódigo:**
  ```
  validar presencia de pajBrafTokenId y bullTokenId
  devolver {
    pajBrafTokenId, bullTokenId, bullSupply,
    txIds: { pajBraf: pajBrafTxId, bull: bullTxId },
    hashscanUrls: { pajBraf: urlToken(pajBrafTokenId), bull: urlToken(bullTokenId) }
  }
  ```

### `toBaseUnits(amount, decimals)`
- **RF cubiertos:** RF-06
- **Input:** `amount: number, decimals: 0 | 4` — cantidad decimal de token.
- **Output:** `bigint` — unidades base enteras (sin pérdida).
- **Pseudocódigo:**
  ```
  validar amount número finito >= 0 y decimals entero >= 0
  devolver BigInt(round(amount * 10^decimals))
  ```

### `calculateRequiredAllowance(assetType, quantity, decimals)`
- **RF cubiertos:** RF-06
- **Input:** `assetType: "PAJ_BRAF" | "BULL", quantity: number, decimals: number`.
- **Output:** `bigint` — allowance mínima necesaria en unidades base.
- **Pseudocódigo:**
  ```
  decimalsEsperados = (assetType === "PAJ_BRAF") ? 0 : 4
  si decimals != decimalsEsperados → lanzar "decimales no coinciden con el activo"
  devolver toBaseUnits(quantity, decimals)
  ```

### `validateAllowanceState(state, requiredBaseUnits)`
- **RF cubiertos:** RF-06, RF-11
- **Input:** `state: { spender, tokenId, amountBaseUnits }`, `requiredBaseUnits: bigint`.
- **Output:** `{ ok: true }` o lanza `Error("allowance insuficiente/revocada")`.
- **Pseudocódigo:**
  ```
  si state no es objeto → lanzar "allowance ausente"
  si state.spender vacío o state.tokenId vacío → lanzar "allowance inválida"
  si BigInt(state.amountBaseUnits) < requiredBaseUnits → lanzar "allowance insuficiente"
  devolver { ok: true }
  ```

### `buildPurchaseMessage(purchase, meta)`
- **RF cubiertos:** RF-13, RF-14
- **Input:** `purchase: { bullId, assetType, tokenId, quantity, listingId, purchaseId, buyerAccountId, sellerAccountId, atomicTxId }`, `meta: { publishedAt }`.
- **Output:** `{ message, canonicalJson, purchaseKey }` — mensaje canónico serializado (claves ordenadas) con `kind:"purchase"`, `specVersion:"005"`, `schemaVersion:1` y `purchaseKey` sha256 estable.
- **Pseudocódigo:**
  ```
  si assetType no es "PAJ_BRAF" ni "BULL" → lanzar "activo inválido"
  si publishedAt no es string → lanzar "publishedAt requerido"
  mensajeSinKey = { kind:"purchase", specVersion:"005", schemaVersion:1, bullId,
                    assetType, tokenId, quantity, listingId, purchaseId,
                    buyerAccountId, sellerAccountId, atomicTxId, publishedAt }
  purchaseKey = sha256Hex(toCanonicalJson(mensajeSinKey))
  message = { ...mensajeSinKey, purchaseKey }
  devolver { message, canonicalJson: toCanonicalJson(message), purchaseKey }
  ```

### `verifyPurchaseMessageContent(retrievedJson, expectedMessage)`
- **RF cubiertos:** RF-16
- **Input:** `retrievedJson: string | object`, `expectedMessage: string | object`.
- **Output:** `{ status: "VERIFIED" }` o `{ status: "MISMATCH", diff: string[] }`.
- **Pseudocódigo:**
  ```
  retrieved = parsear si string; expected = parsear si string
  si retrieved.kind != "purchase" o retrieved.specVersion != "005" → MISMATCH (discriminador)
  diff = diffDeep(retrieved, expected)   // reutiliza la comparación por valor de oracleMessage.js
  devolver diff vacío ? VERIFIED : { MISMATCH, diff }
  ```

### `validatePurchaseInput(purchase, listing)`
- **RF cubiertos:** RF-07, RF-08, RF-09
- **Input:** `purchase: { listingId, assetType, quantity, unitPriceUsd }`, `listing: { assetType, unitPriceUsd, royaltyPct, available, cancelled }`.
- **Output:** `{ purchase: { ..., totalUsd } }` o lanza `Error` (rechazo pre-red).
- **Pseudocódigo:**
  ```
  si listing cancelado → lanzar "listado cerrado"
  si listingId vacío → lanzar "listingId requerido"
  // RF-09: precio 0 rechazado (regla de listado de 003)
  si unitPriceUsd no finito o <= 0 → lanzar "precio debe ser > 0"
  // reutiliza reglas de cantidad de 003 (assertQuantityForAsset exportado)
  assertQuantityForAsset(quantity, listing.assetType)   // RF-07 entero / RF-08 ≤4 dec. y ≤10
  si quantity > listing.available → lanzar "saldo insuficiente"
  totalUsd = roundHalfUp2(unitPriceUsd * quantity)
  devolver { purchase: { ...purchase, totalUsd } }
  ```

### `composePurchaseResult(receipt, split)`
- **RF cubiertos:** RF-10, RF-15
- **Input:** `receipt: { atomicTxId, purchaseId, buyerBalanceBase, sellerBalanceBase }`, `split: object`.
- **Output:** `{ purchaseId, atomicTxId, split, balances: { buyer, seller }, hashscanUrl }`.
- **Pseudocódigo:**
  ```
  validar atomicTxId y purchaseId presentes (sin receipt no hay compra atómica)
  devolver { purchaseId, atomicTxId, split,
             balances: { buyer: buyerBalanceBase, seller: sellerBalanceBase },
             hashscanUrl: urlTx(atomicTxId) }
  ```

### Reutilización del split (sin duplicar)
- **RF cubiertos:** RF-10 (equivalencia N2 vía EA-01)
- `purchaseRules.js` **importa** `calculateSplit` y `roundHalfUp2` de `src/logic/marketplace.js` (R-REV-01) y los aplica al total de la compra; **no** reimplementa la regla half-up. La réplica en `MuurketplaceAtomic.sol` (necesaria on-chain) queda ligada a la implementación pura por el test de equivalencia `tests/splitEquivalence.test.js`.

## Interacción con Hedera SDK (src/hedera/) — si aplica

> Único lugar que toca `@hashgraph/sdk`. Sin `process.env` aquí (todo llega por
> parámetro/`config`). Dobles inyectables (`deps.sdk`, `deps.submitFn`, `deps.sleepFn`,
> `deps.mirrorFetch`, `deps.contractExec`) permiten tests sin red. `Math.random`
> solo para jitter de backoff (nunca en `src/logic/`).

- **Servicio HTS — `pajBrafManager.js` / `bullManager.js`:**
  - Operación: `TokenCreateTransaction` (PAJ `0` dec., BULL `4` dec. y `maxSupply=10`, claves Admin+Treasury con treasury = cabaña) → `TokenMintTransaction` (lote PAJ / `bullSupply` BULL) → `getReceipt`. Devuelve `tokenId` y supply emitido.
  - Manejo de errores: sin claves o receipt sin `tokenId` → error explícito; nunca confirma sin receipt; sin claves reales en logs (RNF-03).
- **Servicio HTS — `tokenAssociator.js`:**
  - Operación: `TokenAssociateTransaction(accountId, tokenId)` idempotente (si ya asociado, no re-asocia ni lanza).
  - Manejo de errores: si el comprador no puede asociar → error que **impide la compra** (RF-05); la asociación de la cabaña no exige APTO/VERIFIED (N3).
- **Servicio HTS/HIP-336 — `allowanceManager.js`:**
  - Operación: `AccountAllowanceApproveTransaction().approveTokenAllowance(tokenId, owner, spender=contrato, amount)` y `revokeTokenAllowance(...)`; consulta de estado vía mirror node.
  - Manejo de errores: reintentos acotados con backoff ante error retryable; error no-retryable falla de inmediato; nunca confirma sin receipt (RF-17).
- **Servicio HSCS — `atomicPurchaseClient.js`:**
  - Operación: una única llamada al contrato `MuurketplaceAtomic.sol` (`ContractExecuteTransaction` con `msg.value` = HBAR del pago) que en la misma ejecución transfiere el token vía `0x167` y reparte el split; `getReceipt`/`getRecord` para `atomicTxId` y saldos.
  - Manejo de errores: cualquier fallo/reversión → se propaga como `reembolso/atómico` sin resultado parcial (RF-11); sin receipt no hay confirmación (RNF-05).
- **Servicio HCS — `purchasePublisher.js`:**
  - Operación: `TopicMessageSubmitTransaction` al `topicId` **de tasaciones de 002** (reutilizado) con el `canonicalJson` de compra; `getReceipt` para la proof `{ topicId, sequenceNumber, consensusTimestamp, transactionId }`.
  - Manejo de errores: si no hay topic configurado → error explícito sin crear topic nuevo (RF-12); reintentos acotados + dedup (in-flight + caché por `purchaseId`) para no duplicar el mensaje (RF-17). Patrón calcado de `oraclePublisher.js`.
- **Mirror node — `purchaseVerifier.js`:**
  - Operación: `GET /api/v1/topics/{topicId}/messages?sequenceNumber=...` o `/transactions/{txId}`, decodifica base64→utf8 y compara; 3 estados `VERIFIED`/`MISMATCH`/`PENDING` (nunca NOT_FOUND definitivo). Patrón calcado de `oracleVerifier.js`, pero propio y sin tocar el de 002.

## Contrato Solidity (src/contracts/) — si aplica

- `MuurketplaceAtomic.sol`: **reemplaza por completo a `Muurketplace.sol`** (que deja de ser el contrato operativo y queda como base lógica histórica). Responsabilidades:
  - **Conserva** `createListing` (fija `royaltyPct` inmutable), `cancelListing`, `getListing`, `isSettled`.
  - **Elimina** `withdrawRoyalties` y `pendingRoyalties` (retiro diferido) → se sustituyen por **split inmediato** dentro de la compra atómica (B3/H4).
  - `buyAtomic(...)` `payable`: en **una sola** transacción (i) recibe el pago en HBAR (`msg.value`), (ii) llama al *system contract* HTS `0x167` (`transferToken`) para mover la cantidad exacta del token del listado desde la treasury de la cabaña (spender = contrato, consumiendo la **allowance HIP-336** concedida) al comprador, y (iii) reparte la regalía y el resto del split de forma inmediata. Reimplementa la regla half-up **R-REV-01** en Solidity (equivalencia garantizada por test, N2).
  - **Atomicidad:** cualquier paso que falle (`require` de allowance/saldo/supply/fondos o revert de `0x167`) revierte la transacción completa; o se mueven pago y tokens juntos, o no se mueve nada. El contrato **genera `purchaseId`** determinista (`keccak256(listingId, quantity, buyer, nonce)`) y lo emite en el evento para que el espejo de 004 lo use como clave de idempotencia (N6).
  - **Sin escrow:** los tokens permanecen en la treasury de la cabaña; el contrato solo los mueve en la compra (D-07). **Solo listados nuevos** (D-09).

## Decisiones Técnicas

| Decisión | Alternativas descartadas | Razón |
|----------|--------------------------|-------|
| **D-08 (resuelta): allowance HIP-336 amplia y revocable por lote** — una `AccountAllowanceApproveTransaction` por token cubriendo todo el saldo del lote, revocable/renovable. | (a) Allowance **exacta por compra** (approve antes de cada compra); (b) allowance **ilimitada**. | Minimiza el nº de transacciones **firmadas por la cabaña** (RNF-04): la cabaña firma **una vez por lote** en lugar de una vez por compra, reduciendo costo, latencia y necesidad de que la cabaña esté online en cada venta. Sigue siendo **revocable y acotada al lote** (mínimo privilegio, §4). No afecta a la atomicidad: el contrato igualmente exige saldo del listado y revierte si la allowance es insuficiente (RF-11). Se descarta (a) por multiplicar firmas/pasos de la cabaña; se descarta (b) por violar mínimo privilegio. |
| **H4: la "liquidación" de 004 se pliega en la compra atómica** — no hay evento de retiro separado en 005. | Conservar `withdrawRoyalties`/`pendingRoyalties` de 003 y un evento de liquidación diferido. | El split se aplica **en el mismo acto** de la compra atómica (RF-10). El espejo (004) registra el split ya liquidado usando `purchaseId` + `atomicTxId` como clave; `applySettlement` de 003 queda satisfecha por el reparto inmediato y no se invoca como evento diferido. Evita estados intermedios (RNF-09) y una noción huérfana de "liquidación". |
| **Verificador de compras propio** (`purchaseVerifier.js`) | Extender `oracleVerifier.js` de 002 para aceptar `specVersion !== "001"`. | El verificador de 002 rechaza `specVersion != "001"` por diseño (N1); modificarlo acoplaría 005 a 002. Se crea uno propio con la misma lógica pura de coincidencia, dejando 002 intacto (§2). |
| **Reutilizar el topic HCS de 002** (D-01) | Crear un topic dedicado para compras. | Evita un topic extra y aprovecha la infra configurada (RF-12); la colisión se evita con el discriminador `kind`/`specVersion` (RF-13). |
| **Reutilización del split por equivalencia** (N2) | Duplicar la regla half-up solo en Solidity. | La regla se reimplementa on-chain pero ligada a la pura por un test de equivalencia (EA-01); "reutilizar" = misma semántica garantizada (§3). |
| **`MuurketplaceAtomic.sol` reemplaza a `Muurketplace.sol`** (D-03/D-06) | Modificar `Muurketplace.sol` in situ. | Se preserva la base lógica histórica de 003 y se gana la compra atómica (pago+HTS+split) sin romper lo aprobado (§1). |
| **`purchaseId` generado por el contrato** (N6) | Generarlo off-chain en el cliente. | Garantiza determinismo y que la misma clave alimente la idempotencia del espejo de 004, sin acoplar capas (§2). |
| **Dobles inyectables por `deps`** | Mockear `@hashgraph/sdk` globalmente. | Patrón ya usado en 001–004; permite tests sin red y sin `node_modules` falsos, y una única E2E real gateada (§3). |
| **Separar rechazo pre-red de reversión on-chain** | Un único caso "fallo". | RF-09 (sin tx) y RF-11 (tx `FAIL`) son verificables de forma distinta y por un tercero en HashScan (Criterio 4, H2). |

## Estrategia de Tests

> `node --test` sin frameworks. Todos los tests de red usan dobles/mocks (sin Testnet).
> **Una única** prueba E2E gateada por `RUN_TOKENIZATION_INTEGRATION=1`. Formato de
> ejecución: `node --test "tests/*.test.js"` (el directorio `tests/` falla en Windows).

| Test | RF que cubre | Tipo |
|------|-------------|------|
| `tests/tokenization.test.js` | RF-01, RF-02, RF-03 | unit puro (`validateTokenizationParams`, `normalizeBullSupply`, `composeTokenizationResult`; rechazo sin APTO/VERIFIED) |
| `tests/pajBrafManager.test.js` | RF-01 | infra con `deps.sdk` falso (crea+minta lote PAJ, claves Admin/Treasury) |
| `tests/bullManager.test.js` | RF-02 | infra con `deps.sdk` falso (crea+minta `bullSupply` BULL, 4 dec., ≤10) |
| `tests/tokenAssociator.test.js` | RF-04, RF-05 | infra con doble (asociación idempotente de la cabaña sin APTO; fallo de asociación del comprador impide compra) |
| `tests/allowance.test.js` | RF-06 | unit puro (`toBaseUnits`, `calculateRequiredAllowance`, `validateAllowanceState` insuficiente/revocada) |
| `tests/allowanceManager.test.js` | RF-06, RF-17 | infra con `submitFn`/`sleepFn` inyectados (approve/revoke idempotente, reintentos; decisión D-08: una approve amplia por lote) |
| `tests/purchaseRules.test.js` | RF-07, RF-08, RF-09 | unit puro (`validatePurchaseInput`: PAJ entero, BULL ≤4 dec./≤10/≤saldo, precio 0, rechazos) |
| `tests/purchaseMessage.test.js` | RF-13, RF-14 | unit puro (`buildPurchaseMessage`, `purchaseMessageKey`, discriminador `kind`/`specVersion`) |
| `tests/atomicPurchaseClient.test.js` | RF-07, RF-08, RF-10, RF-11, RF-15 | infra con `contractExec` doble (una sola tx atómica; reversión → sin movimiento; saldos buyer/seller) |
| `tests/purchasePublisher.test.js` | RF-12, RF-13, RF-14, RF-17 | infra con `deps.sdk`/`submitFn`/`sleepFn` (reutiliza topic 002; error si no hay topic; 1 mensaje; dedup/reintentos) |
| `tests/purchaseVerifier.test.js` | RF-16 | infra con `mirrorFetch` doble (VERIFIED / MISMATCH por campo alterado / PENDING) |
| `tests/purchaseOrchestrator.test.js` | RF-01 a RF-17 (orquestación) | integración con dobles (composición end-to-end sin red) |
| `tests/splitEquivalence.test.js` | RF-10 (N2, EA-01) | equivalencia pura ↔ contrato (tabla de casos half-up `$245.00 → $12.25/$232.75`) |
| `tests/purity.test.js` (**extender**) | RNF-01 | estático: `src/logic/` no importa `@hashgraph/sdk` ni toca red/`process.env` |
| `tests/tokenizationIntegration.test.js` | RF-01 a RF-17 (E2E) | **E2E gateada** por `RUN_TOKENIZATION_INTEGRATION=1` (Testnet real: tokenizar → asociar → allowance → compra atómica → publicar compra → verificar) |

### Cobertura 1-a-1 de los 17 RF

| RF | Test principal |
|----|----------------|
| RF-01 | `tokenization.test.js` + `pajBrafManager.test.js` |
| RF-02 | `tokenization.test.js` + `bullManager.test.js` |
| RF-03 | `tokenization.test.js` (rechazo sin APTO/VERIFIED) |
| RF-04 | `tokenAssociator.test.js` |
| RF-05 | `tokenAssociator.test.js` |
| RF-06 | `allowance.test.js` + `allowanceManager.test.js` |
| RF-07 | `purchaseRules.test.js` + `atomicPurchaseClient.test.js` |
| RF-08 | `purchaseRules.test.js` + `atomicPurchaseClient.test.js` |
| RF-09 | `purchaseRules.test.js` |
| RF-10 | `atomicPurchaseClient.test.js` + `splitEquivalence.test.js` |
| RF-11 | `atomicPurchaseClient.test.js` |
| RF-12 | `purchasePublisher.test.js` |
| RF-13 | `purchaseMessage.test.js` + `purchasePublisher.test.js` |
| RF-14 | `purchaseMessage.test.js` + `purchasePublisher.test.js` |
| RF-15 | `atomicPurchaseClient.test.js` |
| RF-16 | `purchaseVerifier.test.js` |
| RF-17 | `purchasePublisher.test.js` + `allowanceManager.test.js` |

### Orden de implementación sugerido (TDD, bloques ≤ 1 tarea de `tasks.md`)
1. Puros de tokenización/allowance + `pajBrafManager`/`bullManager` (RF-01/02/03/06).
2. Asociación y allowance manager (RF-04/05/06/17).
3. Puros de compra/mensaje + `atomicPurchaseClient` + contrato (RF-07/08/09/10/11/13/14/15).
4. Publisher/verificador de compra (RF-12/14/16/17).
5. Orquestador + pureza + equivalencia + E2E gateada (cobertura integral).

### Nota de verificabilidad (N5)
Los Criterios 3/5/6 de `spec.md` (reversión atómica real y movimiento vía `0x167`)
dependen de la **E2E gateada**; el nivel mock valida orquestación, validación, composición
de mensajes y traducción de errores, no la atomicidad on-chain.
