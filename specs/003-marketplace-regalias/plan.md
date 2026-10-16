# Plan Técnico — Spec 003 Marketplace y Liquidación de Regalías en HSCS

> Spec origen: `specs/003-marketplace-regalias/spec.md` (APROBADA, RF-01 a RF-08 + EA-01 canónico).
> Constitución: `docs/constitution.md` §§1–7.
> Alcance de este plan: solo diseño. No implementa código, solo define el CÓMO.
> Responde a las 4 concreciones del Reviewer (aprobación ya dada): (1) split half-up 2dec con residuo al vendedor, (2) consulta vía HashScan sin lógica, (3) % 0–100 inmutable por listado, (4) criterio 5 de la spec verificado por E2E gateada.

## 1. Arquitectura propuesta

### 1.1 Mapa de archivos (crear, no modificar lógica existente)

```
src/
├── logic/                              # Capa pura — PROHIBIDO @hashgraph/sdk, process.env, red, fs, Date.now, Math.random
│   ├── constants.js                    # EXISTENTE Spec 001 — no se toca
│   ├── validator.js                    # EXISTENTE — no se toca
│   ├── pricing.js                      # EXISTENTE — no se toca (única dueña de M_TOTAL y half-up dosis)
│   ├── evaluateBull.js                 # EXISTENTE — precondición apto=true (no se recalcula aquí)
│   ├── oracleMessage.js                # EXISTENTE Spec 002 — no se toca
│   └── marketplace.js                  # NUEVO (puro) — reglas de listado/compra + split de regalías (RF-01 a RF-08)
├── hedera/                             # Capa infraestructura — único lugar con @hashgraph/sdk y red
│   ├── hcsClient.js                    # EXISTENTE Spec 002 — se reutiliza (Client.forTestnet)
│   ├── oracleVerifier.js               # EXISTENTE Spec 002 — se reutiliza para proof VERIFIED (RF-01/RF-02)
│   └── marketplaceClient.js            # NUEVO — wrapper HSCS: listar/comprar/liquidar/cancelar + consulta pública
├── contracts/
│   └── Muurketplace.sol                # NUEVO — contrato HSCS (listados, ventas, split, retiros, cancelación, reembolso)
config/
└── marketplace.config.js               # NUEVO — contractId + parámetros operativos desde env (patrón oracle.config.js)
tests/
├── marketplace.test.js                 # NUEVO — RF-01 a RF-08 puros + EA-01 canónico (sin red)
├── marketplaceClient.test.js           # NUEVO — RF-01, RF-02, RF-04, RF-06, RF-07 con mocks (sin red)
└── marketplaceIntegration.test.js      # NUEVO — 1 único test E2E Testnet gateado (criterio 5 spec + EA-01 real)
.env.example                            # AMPLIAR — documenta MARKETPLACE_CONTRACT_ID sin valores reales
```

Ningún archivo existente de `src/logic/` ni `src/hedera/` se modifica. `tokenizarToro.js` queda intacto (demo pre-SDD, dueño del minteo HTS).
Dirección de dependencias (una sola, sin ciclos):

```
marketplaceClient.js → hcsClient.js (cliente Testnet)
marketplaceClient.js → oracleVerifier.js (proof VERIFIED, solo lectura mirror)
marketplaceClient.js → src/logic/marketplace.js (valida y calcula split en puro antes de tocar red)
marketplaceClient.js → config/marketplace.config.js (contractId, red)
marketplaceClient.js → Muurketplace.sol (ABI desplegada en Testnet, solo Testnet)
src/logic/marketplace.js ✕ @hashgraph/sdk (no se conocen; auditable por grep)
tests/* → mocks inyectados (nunca Client ni contrato real salvo Integration gateado)
```

### 1.2 Responsabilidades por archivo

| Archivo | Responsabilidad | Recibe | Devuelve | RF dueños |
|---------|----------------|--------|----------|-----------|
| `src/logic/marketplace.js` | Validar parámetros de listado y compra (enteros PAJ-BRAF, 4 decimales BULL, supply 10, cantidad > 0, % 0–100) y calcular split half-up 2dec con residuo al vendedor. Puro, sin red. | `(listingParams, purchase)` | `{ listing, purchase, split }` o lanza `Error` con motivo | RF-01 a RF-08 (cálculo y reglas) |
| `src/contracts/Muurketplace.sol` | Estado on-chain: listados (precio, cantidad, % regalía inmutable, proof ref), compras, saldos de regalías, cancelación, retiro sin doble pago, revert con reembolso. | Llamadas HSCS | Eventos + estado + transferencias | RF-01, RF-04 a RF-08 (ejecución) |
| `src/hedera/marketplaceClient.js` | Orquestar: verificar proof VERIFIED vía `oracleVerifier` antes de listar/comprar, invocar contrato HSCS, mapear receipt a prueba verificable, exponer consulta pública vía HashScan/mirror. | `(client, contractId, proof, params)` | `{ listingId, purchaseId, txId, split, receipt }` | RF-01, RF-02, RF-04, RF-06, RF-07 |
| `config/marketplace.config.js` | Resolver `contractId` configurado y parámetros operativos desde env. Único lector de `MARKETPLACE_CONTRACT_ID`. | `process.env` | `{ contractId \| null, network:'testnet', confirmTimeoutMs }` | Base RF-01/RF-04 |
| `tests/*.test.js` | 1+ test por RF con `node:test` + `node:assert/strict`, mocks sin red; 1 E2E gateado | — | Verde/rojo | Ver §5 matriz |

### 1.3 Reglas inmutables fijadas por el Reviewer (decisiones cerradas)

* **R-REV-01 — Split half-up 2dec con residuo al vendedor:** todo reparto monetario se calcula como `royalty = roundHalfUp2(total × pct/100)` y `seller = total − royalty` (resta exacta, nunca segundo redondeo). El residuo de medio céntimo va siempre al vendedor. `royalty + seller === total` exacto en cada venta. Reutiliza la semántica half-up de `pricing.js` (`Math.floor(x*100+0.5+EPSILON)/100`) sin reimplementar otra variante.
* **R-REV-02 — Consulta vía HashScan sin lógica:** `getListing / getPurchase / getSettlement` del client son solo lectura contra mirror node REST / HashScan Testnet (`GET testnet.mirrornode.hedera.com` + enlaces `hashscan.io/testnet`). No calculan, no validan negocio, no tocan claves: devuelven el estado on-chain y la referencia a la proof HCS VERIFIED de origen. La verificación de contenido (coincide / no coincide) vive en `oracleVerifier.js` existente, no en la consulta.
* **R-REV-03 — % 0–100 inmutable por listado:** `royaltyPct` se fija al crear el listado, se valida `0 ≤ pct ≤ 100` (0% y 100% válidos y registrados explícitamente), se almacena on-chain y no tiene setter: ningún `updateRoyalty` existe en el contrato. Un cambio solo aplica a compras futuras vía nuevo listado. Las compras ya registradas conservan el `%` original.
* **R-REV-04 — Criterio 5 a E2E gateada:** el criterio de finalización 5 de la spec (toda compra/liquidación visible en `hashscan.io/testnet`, reparto pactado verificable y reparto alterado negado) se demuestra exclusivamente en `marketplaceIntegration.test.js` gateado (`RUN_MARKETPLACE_INTEGRATION=1` + credenciales Testnet). Los tests de CI con mocks no afirman visibilidad HashScan.

## 2. Diseño de funciones puras y de borde

Convenciones: CommonJS (`require`/`module.exports`), comentarios en español, identificadores en inglés camelCase (constitution §6).

### 2.1 Contratos de datos

```js
// ListingParams — entrada a crear listado (todo validado en puro antes de red)
{
  bullId: string,              // requerido no-vacío
  assetType: "PAJ_BRAF" | "BULL",
  unitPriceUsd: number,        // debe === tasación certificada (24.50 dosis / equity derivado de $30,000×M_TOTAL); > 0
  quantity: number,            // PAJ_BRAF: entero > 0; BULL: > 0, ≤ 4 decimales, ≤ 10 y ≤ saldo listado
  royaltyPct: number,          // 0–100 inclusive, inmutable tras crear
  proof: { topicId, sequenceNumber?, transactionId?, consensusTimestamp } // debe verificar VERIFIED
}
// Purchase — entrada a comprar
{
  listingId: string,           // requerido
  quantity: number,            // mismas reglas de cantidad que arriba, además ≤ disponible
  totalPaidUsd: number         // debe === roundHalfUp2(unitPrice × quantity); > 0
}
// Split — salida del reparto (invariante: royalty + seller === total exacto)
{
  totalUsd: number,            // 2 decimales
  royaltyUsd: number,          // roundHalfUp2(total × pct/100)
  sellerUsd: number,           // total − royalty (residuo al vendedor)
  royaltyPct: number
}
```

### 2.2 `src/logic/marketplace.js` (puro)

```js
function validateListingParams(params)   // (ListingParams, certifiedValuation) => { listing } o lanza
function validatePurchaseParams(purchase, listing) // (Purchase, listing) => { purchase } o lanza
function calculateSplit(totalUsd, royaltyPct)      // (number, number) => Split (half-up + residuo vendedor)
function roundHalfUp2(value)             // re-exportado de pricing.js, no duplicado (requiere pricing.js)
function applySettlement(purchase, split, balances) // (purchase, split, { royalties, sellers }) => nuevos saldos sin doble pago
```

Pseudocódigo:

```
validateListingParams(params, certified):
  SI params.royaltyPct < 0 O > 100 O no es número finito: LANZAR "royalty fuera de rango 0-100"
  SI params.quantity <= 0: LANZAR "cantidad debe ser > 0"
  SI assetType === "PAJ_BRAF" Y quantity no es entero: LANZAR "pajuela indivisible"
  SI assetType === "BULL" Y (decimales(quantity) > 4 O quantity > 10): LANZAR "fracción inválida o excede supply 10"
  SI unitPriceUsd <= 0: LANZAR "precio debe ser > 0"
  SI unitPriceUsd !== certified.unitPrice (comparación exacta 2dec): LANZAR "precio no coincide con tasación"
  // la validez de proof (VERIFIED) la decide oracleVerifier en el client; aquí solo se exige presencia de referencia
  SI proof ausente o sin topicId: LANZAR "proof requerida"
  DEVOLVER { listing: { ...params, royaltyPct inmutable } }

validatePurchaseParams(purchase, listing):
  SI listing.cancelled: LANZAR "listado cerrado"
  SI purchase.quantity <= 0: LANZAR "cantidad debe ser > 0"
  aplicar mismas reglas de enteros/decimales/supply que en listado
  SI purchase.quantity > listing.available: LANZAR "saldo insuficiente"
  totalEsperado = roundHalfUp2(listing.unitPriceUsd × purchase.quantity)
  SI purchase.totalPaidUsd !== totalEsperado: LANZAR "total no coincide con precio tasado"
  DEVOLVER { purchase: { ...purchase, totalUsd: totalEsperado } }

calculateSplit(totalUsd, royaltyPct):
  SI royaltyPct < 0 O > 100: LANZAR "royalty fuera de rango"
  royalty = roundHalfUp2(totalUsd × royaltyPct / 100)
  seller = roundTo2Exact(totalUsd − royalty)   // resta exacta sobre enteros de céntimos; residuo al vendedor
  ASEGURAR royalty + seller === totalUsd (en céntimos enteros)
  DEVOLVER { totalUsd, royaltyUsd: royalty, sellerUsd: seller, royaltyPct }

applySettlement(purchaseId, split, balances):
  SI purchaseId ya liquidado en balances.settledIds: LANZAR "doble retiro denegado"
  DEVOLVER balances + split.royaltyUsd acreditado al criador, split.sellerUsd al vendedor, purchaseId marcado
```

Nota EA-01: `calculateSplit(245.00, 5)` → `{ royaltyUsd: 12.25, sellerUsd: 232.75 }`; trabaja en céntimos enteros (`Math.round(x*100)`) para que la resta sea exacta.

### 2.3 `src/contracts/Muurketplace.sol` + `src/hedera/marketplaceClient.js` (borde, pseudocódigo)

```js
// Muurketplace.sol — estado mínimo (Solidity ^0.8, solo Testnet)
struct Listing { bullId; assetType; unitPriceCents; available; royaltyPct; breeder; seller; proofTopicId; proofSeq; cancelled; }
mapping(listingId => Listing) + mapping(breeder => royaltiesPendientes) + mapping(purchaseId => settled)
// createListing exige proofRef; royaltyPct inmutable (sin setter); 0 y 100 aceptados
// buy exige quantity válida + pago exacto; calcula split on-chain con la misma regla (royalty half-up, resto vendedor); emite PurchaseSettled
// withdrawRoyalties transfiere pendiente y marca settled (no doble retiro); cancelListing cierra a nuevas compras y preserva pendientes
// cualquier require fallido revierte sin mover fondos (reembolso nativo EVM: fondos no salen del pagador)

// marketplaceClient.js
async function createListing(client, contractId, listingParams, certifiedValuation, proof, expectedMessage, deps)
  // deps = { verifyFn (= oracleVerifier.verifyValuation), contractExec inyectable para mocks }
  validado = validateListingParams(listingParams, certifiedValuation)   // puro primero, sin red
  verdict = await verifyFn(proof, expectedMessage, { mirrorFetch })      // RF-02: exige status VERIFIED
  SI verdict.status !== "VERIFIED": LANZAR Error("sin proof VERIFIED no hay listado") SIN tocar contrato
  receipt = await contractExec.createListing(client, contractId, validado.listing)  // solo tras VERIFIED
  DEVOLVER { listingId, txId, proofRef }

async function buy(client, contractId, purchase, listing, proof, expectedMessage, deps)
  validado = validatePurchaseParams(purchase, listing)                  // puro primero
  verdict = await verifyFn(proof, expectedMessage, ...)                 // RF-02 también en compra
  SI no VERIFIED: LANZAR sin mover fondos
  split = calculateSplit(validado.purchase.totalUsd, listing.royaltyPct) // R-REV-01
  receipt = await contractExec.buy(...)  // SI revierte o falla red/fondos: propagar como fallo con reembolso (RF-07)
  DEVOLVER { purchaseId, txId, split }

async function withdrawRoyalties(client, contractId, breeder, deps)
  // llama al contrato; SI ya retirado: el contrato revierte y el client propaga "doble retiro denegado" (RF-06)
  DEVOLVER { txId, amountUsd }
async function cancelListing(client, contractId, listingId, deps)
  // cierra a nuevas compras; no toca saldos pendientes (RF-08)
  DEVOLVER { txId, listingId, cancelled: true }

// Consultas públicas (R-REV-02 — sin lógica, solo lectura):
async function getListing(contractId, listingId, { mirrorFetch })  // => estado + proofRef + enlaces HashScan, sin validar
async function getPurchase(contractId, purchaseId, { mirrorFetch }) // => compra + split registrado + txId HashScan
async function getSettlement(contractId, purchaseId, { mirrorFetch })// => liquidación + retiro asociado
```

### 2.4 Interfaz con Hedera SDK y HSCS (solo `src/hedera/`, solo Testnet)

| Operación | Mecanismo | Dato que produce |
|-----------|-----------|------------------|
| Cliente | `hcsClient.createHcsClient` existente (`Client.forTestnet()` + operator). PROHIBIDO `forMainnet` | Cliente firmado Testnet |
| Despliegue/instancia contrato | Contrato `Muurketplace.sol` compilado con `solc` compatible Hedera; `contractId` en `MARKETPLACE_CONTRACT_ID` (env, patrón `oracle.config.js`); despliegue fuera de tests (operador manual) | `contractId` `0.0.x` |
| Listar/comprar/liquidar/cancelar (RF-01, RF-04 a RF-08) | `ContractExecuteTransaction().setContractId().setGas().setPayableAmount().setFunction()` + `.execute(client)` + `.getReceipt(client)`; confirmación solo con receipt (RNF-05) | `listingId`/`purchaseId`, `transactionId`, receipt de finalidad |
| Verificar elegibilidad (RF-02, RF-03) | Reutiliza `oracleVerifier.verifyValuation` (mirror REST, 3 estados). Solo `VERIFIED` habilita `createListing`/`buy`; `MISMATCH`/`PENDING` rechazan sin mover fondos | `VERIFIED` o rechazo explícito |
| Consulta pública (RNF-06, R-REV-02) | `ContractCallQuery` o mirror REST `GET https://testnet.mirrornode.hedera.com/api/v1/contracts/{contractId}/...` + enlaces `https://hashscan.io/testnet/contract/{contractId}` y `.../transaction/{txId}`; sin claves | Estado + prueba exhibible |
| Precio (RF-03) | Nunca se negocia en el contrato: `unitPriceUsd` llega del `certifiedValuation` (Spec 001 vía `evaluateBull` + Spec 002). El puro valida igualdad exacta; el contrato solo almacena | Precio tasado, sin subjetividad |

Límites: 1 transacción HSCS por operación (RNF-04 gas acotado); mensaje/estado mínimo on-chain (precio en céntimos enteros, `%` entero o 2dec según contrato, cantidades PAJ enteras / BULL con 4dec como enteros de 1/10000); cero Mainnet (auditable con `grep -r "forMainnet\|mainnet"` vacío).

## 3. Decisiones técnicas justificadas

| # | Decisión | Justificación | Alternativa descartada y por qué |
|---|----------|---------------|----------------------------------|
| T-01 | Un puro `src/logic/marketplace.js` + contrato `Muurketplace.sol` + wrapper `marketplaceClient.js` (en vez de todo en el contrato o todo en JS) | Constitution §2: reglas testeables offline en puro; el contrato solo ejecuta y custodia; el client solo orquesta red + proof. Cada RF tiene seam de test. | Lógica de split solo en Solidity: imposible testear RF-05/EA-01 sin red ni Testnet. Lógica solo en JS sin contrato: no hay liquidación automática ni reembolso atómico on-chain (RF-05/RF-07). |
| T-02 | Split `royalty = half-up(total×pct/100)`, `seller = total − royalty` con residuo al vendedor (R-REV-01), en céntimos enteros | Cierra el medio céntimo de forma determinista; `royalty + seller === total` siempre; reutiliza half-up auditado de Spec 001 sin segunda semántica de redondeo. | Doble redondeo (redondear ambas partes): suma ≠ total por 1 céntimo en bordes. Residuo al criador: favorece sistemáticamente una parte sin justificación; el vendedor asume el redondeo por ser quien fija el listado. |
| T-03 | `royaltyPct` 0–100 validado en puro e inmutable on-chain sin setter (R-REV-03); 0% y 100% explícitamente válidos | D-01 de la spec (propuesta: libre al listar, inmutable por listado); 0% = listado válido sin regalía, 100% = vendedor $0, ambos registrados para auditoría. Sin setter es imposible cambiar el pasado. | `%` mutable por el criador: rompería la confianza del comprador y la auditoría (repartos históricos cambiarían). Rango 1–99: prohibiría los casos límite que la spec exige soportar. |
| T-04 | Proof VERIFIED vía `oracleVerifier` existente como guarda previa en `createListing` y en `buy`; comparación íntegra (un decimal distinto rechaza) | RF-02 + precondición transversal: sin proof válida no hay listado ni compra; reutilizar el verificador de 3 estados evita duplicar lógica mirror y respeta "sin mover fondos" (el puro falla antes de red). | Verificación inline simplificada en el client: duplica código auditado de 002 y reintroduce riesgo de falsos negativos por lag mirror. Verificar solo al listar: una compra posterior con tasación alterada pasaría. |
| T-05 | Consultas solo-lectura vía mirror/HashScan sin lógica de negocio (R-REV-02) | RNF-06: auditor sin credenciales verifica con solo el txId; separar lectura de decisión impide que la consulta "arregle" datos. | Consulta que recalcula split o valida proof: mezcla capas, exige claves para un acto público y puede divergir del estado on-chain. |
| T-06 | Precio en céntimos enteros on-chain; cantidades PAJ enteras y BULL en unidades de 1/10000 | Evita float en Solidity; PAJ 0 decimales = indivisible por construcción; BULL 4 decimales con supply 10 verificable por enteros (`≤ 100000` diezmilésimas). | Floats o decimales libres on-chain: errores de representación y compras de 1.5 pajuelas pasarían. Validar decimales solo en JS: el contrato quedaría desprotegido ante llamadas directas. |
| T-07 | Reembolso por revert atómico EVM + client que nunca acredita parciales (RF-07) | En HSCS un `require` fallido revierte la llamada sin mover fondos: el "reembolso" es la atomicidad nativa; el client además no registra compra ni regalía si no hay receipt. | Libro contable off-chain de reembolsos: introduce doble fuente de verdad y riesgo de fondos bloqueados (viola RNF-03). |
| T-08 | Tests con mocks inyectados (`verifyFn`, `contractExec`, `mirrorFetch`) + 1 E2E gateado para criterio 5 (R-REV-04) | RNF-02 + constitution §3: cada RF con test offline; la visibilidad HashScan solo existe en red real, por eso el criterio 5 no se afirma con mocks. | Afirmar HashScan con mocks: prueba falsa. Todos los tests contra Testnet: CI frágil, costoso y expone claves. |
| T-09 | `config/marketplace.config.js` único lector de `MARKETPLACE_CONTRACT_ID` (patrón `oracle.config.js`) | `contractId` es público pero operativo: env evita hardcodeo; un único lector facilita mock y auditoría; `.env.example` documenta sin exponer valores (constitution §4). | Hardcodear `contractId` en el client: obliga a editar código por despliegue y se commitea por error. |

## 4. Estrategia de tests (`node --test`, sin frameworks)

Orden TDD (cada paso: rojo → mínimo → verde; `node --test tests/` tras cada paso):

1. **`marketplace` puro — split y EA-01 (RF-05):** `calculateSplit(245.00, 5)` → `{ royaltyUsd: 12.25, sellerUsd: 232.75 }`; invariante `royalty + seller === total` en bordes (1 céntimo, 33.33% de $10.00 → residuo al vendedor); `royaltyPct` −1 y 101 lanzan; 0% → royalty 0; 100% → seller 0.
2. **`marketplace` puro — reglas (RF-01, RF-03, RF-04, RF-08):** listado con precio distinto de la tasación lanza (RF-03); `PAJ_BRAF` 1.5 lanza, entero acepta (RF-04); `BULL` 5 decimales / > 10 / 0 lanzan, 0.0001 acepta (RF-04); compra que excede disponible lanza; compra con total ≠ `roundHalfUp2(precio×cantidad)` lanza; `applySettlement` acredita y el segundo retiro del mismo `purchaseId` lanza (RF-06); cancelado bloquea compras pero preserva pendientes (RF-08).
3. **`marketplaceClient` con mocks (RF-01, RF-02, RF-04, RF-06, RF-07):** `verifyFn` mock. Proof no-VERIFIED (`MISMATCH`/`PENDING`) → `createListing` y `buy` lanzan con `contractExec` en 0 llamadas y sin fondos movidos (RF-02). `VERIFIED` → 1 llamada al contrato y devuelve `{ listingId/purchaseId, txId, split }` (RF-01/RF-04). `contractExec` que revierte → el client propaga fallo sin acreditar compra ni regalía (RF-07). `withdrawRoyalties` con `purchaseId` ya liquidado → "doble retiro denegado" (RF-06).
4. **E2E gateado criterio 5 + EA-01 real:** `marketplaceIntegration.test.js` con `skip` salvo `RUN_MARKETPLACE_INTEGRATION=1` + `MY_ACCOUNT_ID`/`MY_PRIVATE_KEY` + `MARKETPLACE_CONTRACT_ID` + proof VERIFIED real de 002. Lista, compra 10 pajuelas a $24.50 con 5%, verifica `$245.00 / $12.25 / $232.75`, retira `$12.25`, reintenta retiro (rechazado), e imprime enlaces `hashscan.io/testnet` de cada tx; además verifica por mirror que el reparto coincide y que un reparto alterado no coincide (R-REV-04).
5. **Antirregresión pureza/seguridad:** extender `purity.test.js`: `src/logic/**` sin `hashgraph|process.env|fetch|Date.now|Math.random`; `src/**` y `config/**` sin `forMainnet|mainnet`; `grep` de claves (`MY_PRIVATE_KEY`, `0x[a-f0-9]{64}`) en `tests/`, `config/`, `src/contracts/` vacío salvo `.example`.

Todos con `node:test` (`describe/it`) + `node:assert/strict`, CommonJS, sin `npm install` (constitution §1).

## 5. Matriz RF → test (constitution §3: ≥1 test por RF)

| RF | Test(s) | Archivo | Aserción clave |
|----|---------|---------|----------------|
| RF-01 | `listado VERIFIED crea listingId con precio tasado + % + proofRef` / `parámetros inválidos lanzan antes de red` | `marketplace.test.js` (puro) + `marketplaceClient.test.js` (mock VERIFIED → 1 llamada) | `listingId` presente; `contractExec` 1 llamada solo con `VERIFIED` |
| RF-02 | `proof MISMATCH/PENDING/alterada (2.45 vs 2.46) rechaza listar y comprar sin mover fondos` | `marketplaceClient.test.js` | `contractExec` 0 llamadas; error "sin proof VERIFIED"; fondos intactos |
| RF-03 | `precio distinto de la tasación lanza` (dosis ≠ half-up 2dec; equity ≠ base toro) | `marketplace.test.js` | `unitPrice !== certified` lanza; EA-01 `$24.50` acepta |
| RF-04 | `PAJ entera acepta / 1.5 rechaza` + `BULL 0.0001 acepta / 5 decimales o > 10 rechaza` + `compra registra purchaseId + txId` | `marketplace.test.js` + `marketplaceClient.test.js` | Reglas de cantidad; `purchaseId` + `txId` presentes con mock VERIFIED |
| RF-05 | `split half-up con residuo al vendedor` + EA-01 `$245.00 → $12.25 / $232.75` | `marketplace.test.js` | `calculateSplit(245,5)` exacto; `royalty + seller === total` en bordes |
| RF-06 | `retiro transfiere pendiente` + `segundo retiro del mismo saldo lanza` | `marketplace.test.js` (`applySettlement`) + `marketplaceClient.test.js` (mock revert) | Sin doble pago; segundo intento denegado |
| RF-07 | `fallo de contrato/red revierte sin acreditar parciales` | `marketplaceClient.test.js` (mock `contractExec` que revierte) | Sin `purchaseId`, sin regalía, error de reembolso |
| RF-08 | `cancelación cierra compras y preserva pendientes` | `marketplace.test.js` + `marketplaceClient.test.js` | Comprar tras cancelar lanza; `withdrawRoyalties` posterior sigue válido |
| EA-01 | `caso canónico M_TOTAL 2.45 end-to-end puro` | `marketplace.test.js` | 10 × $24.50 = $245.00; 5% → $12.25 / $232.75; retiro $12.25 único |
| Criterio 5 | `E2E Testnet: txs visibles en HashScan, reparto verificado, alterado negado` (R-REV-04) | `marketplaceIntegration.test.js` (gateado) | Enlaces `hashscan.io/testnet`; mirror confirma reparto pactado |

RNF cubiertos: pureza (antirregresión), solo-Testnet (grep + `forTestnet`), sin secretos (grep `.env`/claves), gas acotado (1 tx por operación), finalidad por receipt, idioma (revisión manual).

## 6. Riesgos y mitigaciones

| # | Riesgo | Impacto | Mitigación en este plan |
|---|--------|---------|--------------------------|
| R-01 | **Medio céntimo en el split** (ej. 33.33% de $10.00 = $3.333 → $3.33 o $3.34) | Suma ≠ total; disputa criador/vendedor | R-REV-01: un solo half-up sobre la regalía + resta exacta al vendedor; tests de borde con invariante `royalty + seller === total` en céntimos enteros |
| R-02 | **Llamada directa al contrato saltándose el client** (atacante invoca HSCS sin proof) | Listado/compra sin elegibilidad | Guarda on-chain mínima: el contrato almacena `proofTopicId + proofSeq` y exige referencia no-vacía; la verificación íntegra vive en el client verificador (defensa en profundidad; auditoría por mirror detecta el fraude) |
| R-03 | **Mirror lag → compra legítima rechazada como no-VERIFIED** (supuesto 5 spec) | Falso negativo, venta bloqueada | Reutiliza `PENDING` + gracia 60 s de `oracleVerifier` (Spec 002): dentro de la ventana se reporta pendiente y se reintenta, nunca rechazo definitivo; tests RF-02 con `PENDING` |
| R-04 | **`%` manipulado tras vender** | Repartos históricos reescritos | R-REV-03: sin setter on-chain + validación 0–100 solo en creación; test: no existe `updateRoyalty` en ABI; compras viejas conservan `%` |
| R-05 | **Doble retiro por reintento de red** (timeout tras ejecutar `withdraw`) | Criador cobra dos veces | `settledIds` on-chain + `applySettlement` puro idempotente: segundo intento revierte; test RF-06 con doble llamada mock |
| R-06 | **Fondos bloqueados por fallo parcial** (pago sale pero split no se acredita) | Pérdida / bloqueo (viola RNF-03) | Atomicidad EVM: split y acreditación en la misma llamada; sin receipt no hay registro local válido; test RF-07 con revert mock |
| R-07 | **Float USD off-chain** (`24.5 × 10 ≠ 245.00` binario) | Total o split con 1 céntimo de error | Céntimos enteros en contrato y en `calculateSplit`; comparación exacta de totales; test EA-01 con `245.00/12.25/232.75` exactos |
| R-08 | **E2E frágil en CI / credenciales / Testnet caída** | CI rojo por red, no por código | E2E gateado `RUN_MARKETPLACE_INTEGRATION=1` con `skip` por defecto; CI solo mocks; criterio 5 se demuestra en corrida manual con HashScan |
| R-09 | **Fuga de SDK/env/red a `src/logic/` o Mainnet accidental** | Viola constitution §§1/2/4 | `marketplace.js` puro (mismo grep que 001/002); `hcsClient` solo `forTestnet`; grep antirregresión de `forMainnet`, claves y `.env` |

## 7. Criterio de listo (para `tasks.md` y `/sdd-validate`)

1. `src/logic/marketplace.js`, `src/contracts/Muurketplace.sol`, `src/hedera/marketplaceClient.js`, `config/marketplace.config.js` existen, CommonJS (JS) + Solidity Testnet, comentarios en español e identificadores en inglés.
2. `node --test tests/` en verde sin red (mocks): RF-01 a RF-08 con ≥1 test cada uno + EA-01 exacto (`$245.00`, `$12.25`, `$232.75`, retiro único `$12.25`).
3. Split verificado: half-up con residuo al vendedor e invariante `royalty + seller === total`; `%` 0–100 con 0% y 100% explícitos e inmutable (sin setter en ABI).
4. Corrida manual con `RUN_MARKETPLACE_INTEGRATION=1` ejecuta EA-01 en Testnet y cada tx es visible en `hashscan.io/testnet` con reparto pactado confirmado y reparto alterado negado (criterio 5, R-REV-04).
5. `grep` confirma: cero `@hashgraph/sdk`/`process.env`/`fetch` en `src/logic/`; cero `forMainnet`; cero claves en repo/tests/config/contratos (solo `.example` ficticio); ninguna operación apunta a Mainnet.
6. Veredicto `APROBADO` del revisor y `MEMORY.md` actualizado (fuera de este plan, registrado para `tasks.md`).

## 8. Trazabilidad spec → plan → constitution

| Spec | Este plan | Constitution |
|------|-----------|--------------|
| RF-01/RF-02 (listar solo APTO + VERIFIED, rechazo sin fondos) | `marketplace.js` + `marketplaceClient` con guarda `oracleVerifier` (T-04), matriz §5 | §5 (solo comercializa lo que 001 decidió y 002 certificó), §2 separación |
| RF-03 (precio desde tasación, sin negociación) | `validateListingParams` igualdad exacta + céntimos on-chain (T-06) | §5 fuente PEGBraf (no redefine bases), §2 pureza |
| RF-04 (PAJ enteras, BULL 4dec ≤ 10) | Reglas en puro + enteros on-chain (T-06) | §5 (decimales/supplies de AGENTS.md), §3 tests |
| RF-05 (split automático) | `calculateSplit` half-up + residuo vendedor, R-REV-01 (T-02) | §3 (test por RF + EA-01), §7 hecho |
| RF-06/RF-08 (retiro único, cancelación preserva) | `applySettlement` + `settledIds` + `cancelListing` (T-07) | §3 política tests, §7 confirmación con consenso |
| RF-07 (reembolso ante fallo) | Revert atómico + sin registro sin receipt (T-07) | §7 hecho verificable |
| Consulta pública + criterio 5 | Lectura mirror/HashScan sin lógica + E2E gateada, R-REV-02/R-REV-04 (T-05/T-08) | §1 stack Hedera, §4 Testnet |
| RNF-01/RNF-02 (capas + `node --test` mocks) | `src/logic/` vs `src/hedera/`+`src/contracts/` + §4 estrategia | §1 tests nativos, §2 separación, §3 TDD |
| RNF-03/RNF-04/RNF-05/RNF-07/RNF-08 (fondos, gas, finalidad, claves, Testnet) | §2.4 (1 tx/op, receipt, `.env` nunca commiteado, `forTestnet`, HashScan) | §1 stack, §4 seguridad |
| RNF-09 (idioma) | Español docs/comentarios, inglés código | §6 idioma |
| Fuera de alcance (sin minteo HTS, sin motor, sin oráculo) | No se diseña token ni tasación ni topic; solo se consume `evaluateBull` + `oracleVerifier` | §1 stack bloqueado (sin dependencias nuevas) |
| D-01/D-02/D-03 spec | R-REV-03 (% libre 0–100 inmutable por listado); regalía en toda compra del contrato; moneda on-chain a definir en tasks/implementación sin cambiar el QUÉ | §5 (sin cambiar umbrales/bases), §1 (sin dependencias sin aprobación) |
