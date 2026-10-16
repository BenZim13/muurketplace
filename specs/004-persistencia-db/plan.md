# Plan Técnico — Spec 004 Persistencia Espejo en Supabase (Off-Chain) Verificable

> Spec origen: `specs/004-persistencia-db/spec.md` (APROBADA, RF-01 a RF-08, invariante transversal chain = verdad).
> Constitución: `docs/constitution.md` §§1–7.
> Alcance de este plan: solo diseño. No implementa código, solo define el CÓMO.
> Responde a las 2 dudas del Reviewer (aprobación ya dada): (D-01) organización Supabase + RLS/entornos + ciclo de credenciales + gitignore, (D-02) versionado si `specVersion ≠ 001`.
> Dependencia: `@supabase/supabase-js` **APROBADA por el usuario el 2026-10-16 para la fase implement** (registrada en `MEMORY.md`; ya presente en `package.json ^2.118.0`). La mención "pendiente de aprobación" de la spec (RNF-07) queda sustituida por esta aprobación: no se instala nada nuevo, solo se usa la dependencia aprobada y únicamente server-side.

## 1. Arquitectura propuesta

### 1.1 Mapa de archivos (crear, no modificar lógica existente)

```
src/
├── logic/                              # Capa pura — PROHIBIDO @supabase/supabase-js, @hashgraph/sdk, process.env, red, fs, Date.now, Math.random
│   ├── constants.js                    # EXISTENTE 001 — no se toca
│   ├── validator.js                    # EXISTENTE 001 — no se toca
│   ├── pricing.js                      # EXISTENTE 001 — no se toca (única dueña de M_TOTAL y half-up)
│   ├── evaluateBull.js                 # EXISTENTE 001 — no se toca (produce apto/mTotal/tasaciones)
│   ├── oracleMessage.js                # EXISTENTE 002 — no se toca (dueño de valuationKey + verifyMessageContent)
│   ├── marketplace.js                  # EXISTENTE 003 — no se toca (dueño de calculateSplit/applySettlement)
│   └── mirrorRules.js                  # NUEVO (puro) — reglas de espejo e idempotencia RF-01 a RF-08 (sin SDK, sin red)
├── db/                                 # Capa infraestructura Supabase — único lugar con @supabase/supabase-js
│   ├── supabaseClient.js               # NUEVO — factory server-side: createClient(URL, service_role/anon) con lazy require
│   ├── bullsRepo.js                    # NUEVO — upsert/get de toros (RF-01, RF-07)
│   ├── valuationsRepo.js               # NUEVO — upsert idempotente por valuationKey (RF-02, RF-07)
│   ├── proofsRepo.js                   # NUEVO — upsert proof + update de estado solo-desde-verdad (RF-03, RF-04, RF-08)
│   └── listingsRepo.js                 # NUEVO — listings + purchases + settlements idempotentes (RF-05, RF-06, RF-07, RF-08)
├── hedera/                             # EXISTENTE — se reutiliza, no se modifica
│   ├── hcsClient.js                    # EXISTENTE 002 — Client.forTestnet (E2E y verificación)
│   └── oracleVerifier.js               # EXISTENTE 002 — verifyValuation VERIFIED/MISMATCH/PENDING (RF-03/RF-04/RF-08)
config/
└── supabase.config.js                  # NUEVO — único lector de SUPABASE_URL + SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY (patrón oracle.config.js)
tests/
├── mirrorRules.test.js                 # NUEVO — RF-01 a RF-08 puros con dobles en memoria (sin red, sin credenciales)
├── dbRepos.test.js                     # NUEVO — RF-01 a RF-08 de repos con cliente Supabase mock inyectado (sin red)
├── supabaseConfig.test.js              # NUEVO — config server-side, sin secretos, formato URL/claves
└── supabaseIntegration.test.js         # NUEVO — 1 único test E2E gateado contra proyecto Supabase de test (criterios 2/3/4/5)
.env.example                            # AMPLIAR — documenta SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY con placeholders ficticios
```

Ningún archivo existente de `src/logic/`, `src/hedera/` o `config/` se modifica. `tokenizarToro.js` queda intacto (dueño del minteo HTS).
Dirección de dependencias (una sola, sin ciclos):

```
db/*.js → config/supabase.config.js (URL + clave server-side, nunca en logic)
db/*.js → src/logic/mirrorRules.js (valida idempotencia y elegibilidad en puro antes de tocar red)
db/*.js → src/logic/oracleMessage.js (valuationKey determinista + verifyMessageContent, sin duplicar)
db/*.js → src/logic/marketplace.js (splits ya calculados, aquí solo se reflejan; applySettlement como oráculo de no-doble-pago)
proofsRepo/listingsRepo → src/hedera/oracleVerifier.js (estado VERIFIED/MISMATCH/PENDING, solo lectura mirror)
tests/* → dobles inyectados { supabase, verifyFn } (nunca proyecto real salvo Integration gateado)
src/logic/mirrorRules.js ✕ @supabase/supabase-js / @hashgraph/sdk / process.env (auditable por grep)
```

### 1.2 Responsabilidades por archivo

| Archivo | Responsabilidad | Recibe | Devuelve | RF dueños |
|---------|----------------|--------|----------|-----------|
| `src/logic/mirrorRules.js` | Reglas puras del espejo: armar registros espejo desde 001/002/003, decidir idempotencia (misma clave + mismos inputs ⇒ original; misma clave + input distinto ⇒ rechazo/ramal), veto de espejo inválido (MISMATCH/PENDING nunca VERIFIED ni habilitan listado/compra), transición de estados solo-desde-verdad sin reescribir historia, vista pública con referencia verificable o ausencia explícita. | `(bullInput, bullResult, proof, verdict, movement)` | `{ record, decision: "insert" \| "return-existing" \| "reject-mismatch" \| "block-unverified" \| "update-status" }` o lanza `Error` | RF-01 a RF-08 (decisión) |
| `src/db/supabaseClient.js` | Factory server-side del cliente Supabase (lazy `require("@supabase/supabase-js")`, `createClient(url, key)`). Falla explícito sin URL/clave antes de tocar red. Nunca se importa desde `src/logic/`. | `{ url, key }` + `deps.supabaseJs` inyectable | `supabase` (o mock inyectado en tests) | Base todos los RF |
| `src/db/bullsRepo.js` | `saveBull` (upsert por `bullId`), `getBull(bullId)`, `findBulls()`. Delega la decisión a `mirrorRules` y ejecuta un solo upsert. | `(supabase, bullRecord)` | `{ bull, existed }` | RF-01, RF-07 |
| `src/db/valuationsRepo.js` | `saveValuation` idempotente por `valuationKey` (UNIQUE + `upsert … onConflict: valuationKey`), `getValuation(valuationKey)`. Reintento idéntico ⇒ original; clave igual con input distinto ⇒ rechazo. | `(supabase, valuationRecord)` | `{ valuation, existed }` | RF-02, RF-07 |
| `src/db/proofsRepo.js` | `saveProof` (upsert por `valuationKey`), `getProof(valuationKey)`, `updateProofStatus` solo `PENDING → VERIFIED\|MISMATCH` con prueba de verdad (veredicto mirror). Nunca promueve MISMATCH/PENDING a VERIFIED localmente. | `(supabase, proof, verdict)` | `{ proof, existed/updated }` | RF-03, RF-04, RF-07, RF-08 |
| `src/db/listingsRepo.js` | `saveListing` (upsert por `listingId`, exige proof VERIFIED vigente), `savePurchase` idempotente por `purchaseId`, `settlePurchase` sin doble acreditación (un `purchaseId` ⇒ una liquidación), `getByListing/Purchase`, `findByStatus`. | `(supabase, movement, proofStatus)` | `{ listing/purchase/settlement, existed }` | RF-05, RF-06, RF-07, RF-08 |
| `config/supabase.config.js` | Único lector de `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Recibe `env` por parámetro (testeable sin `process.env`). | `process.env` | `{ url, anonKey, serviceRoleKey, envLabel }` o lanza | Base todos los RF |
| `tests/*.test.js` | 1+ test por RF con `node:test` + `node:assert/strict`, dobles sin red; 1 E2E gateada | — | Verde/rojo | Ver §5 matriz |

### 1.3 Esquema Supabase (D-01: 1 proyecto de test, RLS, sin multi-escritor)

Un solo proyecto Supabase de **test** en esta spec (el productivo será un proyecto aparte, no se crea aquí). Esquema `public`, 5 tablas espejo, claves naturales UNIQUE para idempotencia en el motor (upsert atómico, sin SELECT-then-INSERT):

```
bulls        (bull_id TEXT PK, inputs JSONB (11 PEGBraf), apto BOOL, motivos JSONB, m_total NUMERIC, price_bull_usd NUMERIC(12,2), price_dose_usd NUMERIC(12,2), created_at TIMESTAMPTZ)
valuations   (valuation_key TEXT PK, bull_id TEXT FK→bulls, spec_version TEXT DEFAULT '001', m_total NUMERIC, price_bull_usd NUMERIC(12,2), price_dose_usd NUMERIC(12,2), canonical_json JSONB, created_at TIMESTAMPTZ)
proofs       (valuation_key TEXT PK FK→valuations, topic_id TEXT, sequence_number BIGINT NULL, consensus_timestamp TEXT, transaction_id TEXT, status TEXT CHECK (VERIFIED|MISMATCH|PENDING), verified_ref TEXT NULL, updated_at TIMESTAMPTZ)
listings     (listing_id TEXT PK, valuation_key TEXT FK→valuations, asset_type TEXT, unit_price_usd NUMERIC(12,2), quantity NUMERIC(14,4), royalty_pct NUMERIC(5,2), tx_id TEXT, hashscan_url TEXT, created_at TIMESTAMPTZ)
purchases    (purchase_id TEXT PK, listing_id TEXT FK→listings, total_usd NUMERIC(12,2), royalty_usd NUMERIC(12,2), seller_usd NUMERIC(12,2), settled BOOL DEFAULT false, purchase_tx_id TEXT, settlement_tx_id TEXT NULL, hashscan_url TEXT, created_at TIMESTAMPTZ)
-- Índices: valuations(bull_id), proofs(status), listings(valuation_key), purchases(listing_id, settled)
```

RLS (Row Level Security) activado en las 5 tablas desde el día uno:

- `SELECT` público con rol `anon` (auditor sin credenciales, RF-07).
- `INSERT / UPDATE / DELETE` denegados a `anon` y a `authenticated`; solo el rol `service_role` server-side escribe (bypassa RLS). Ninguna clave `service_role` sale del servidor (`.env` + `supabaseClient.js`).
- Sin `authenticated` ni login de usuarios en esta spec (fuera de alcance: sin auth de usuarios).

Ciclo de credenciales y gitignore (D-01):

- Claves solo server-side en `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`); `.env` y `.env.local` ya cubiertos por `.gitignore` (verificado); `.env.example` solo placeholders ficticios (`https://xyzcompany.supabase.co`, `TU_ANON_KEY_AQUI`, sin `0x…` ni PEM).
- Rotación: manual en el dashboard Supabase del proyecto de test (regenerar → actualizar `.env` local → reiniciar proceso); ante sospecha de fuga se rota `service_role` primero y luego `anon`; ningún test, log o registro persiste claves (auditable por `purity.test.js` extendido).
- Entornos: esta spec solo usa el proyecto de **test** (`envLabel: "test"`, on-chain solo Testnet). El futuro proyecto prod se documenta como proyecto aparte con las mismas 5 tablas + RLS; nunca se mezclan claves entre entornos (config lanza si `SUPABASE_URL` no es https o si falta la clave que corresponde al rol).

### 1.4 Versionado (D-02: `specVersion ≠ 001` ⇒ claves nuevas, historia 001 inmutable)

- `valuationKey = sha256(canonicalJson)` ya incluye `specVersion` (diseño heredado de `oracleMessage.buildOracleMessage`, que hoy solo acepta `"001"` y lanza ante otra versión). Por tanto una futura spec 005 genera automáticamente claves distintas para los mismos inputs: **cero colisión, cero migración en esta spec**.
- Registros `001` inmutables como historia: ningún `UPDATE` reescribe `inputs`, `mTotal`, precios, `proof` ni `txIds` (RF-08 solo cambia `status`/`settled` + `updated_at`/`settlement_tx_id`, conservando el resto).
- Si algún día `oracleMessage` acepta `"002"`, este plan ya lo prevé: `valuations.spec_version` distingue cohortes, las consultas filtran por `spec_version`, y los repos rechazan mezclar (`valuationKey` de `001` nunca se actualiza con datos de `002`; se inserta fila nueva). Sin backfill ni ALTER en esta spec.

## 2. Diseño de funciones puras y de borde

Convenciones: CommonJS (`require`/`module.exports`), comentarios en español, identificadores en inglés camelCase (constitution §6).

### 2.1 Contratos de datos (espejo, no verdad)

```js
// BullRecord — lo que 001 decidió (evaluateBull), tal cual, sin recalcular
{ bullId: string, inputs: { pesoNacerDep, pesoDestateDep, edadDesteDias, pesoFinalDep, edadPesoFinalDias, circunferenciaEscrotalCm, areaOjoBifeCm2, grasaIntramuscularTop5, motilidadSeminalPct, volumenEyaculadoMl, pajuelasProducidas }, apto: boolean, motivos: string[], mTotal: number, priceBullUsd: number, priceDoseUsd: number }
// ValuationRecord — espejo de la valuación + clave de idempotencia (dueña: oracleMessage)
{ valuationKey: string, bullId: string, specVersion: "001", mTotal: number, priceBullUsd: number, priceDoseUsd: number, canonicalJson: object }
// ProofRecord — lo que 002 certificó (topicId/sequenceNumber/consensusTimestamp/transactionId + estado 002)
{ valuationKey: string, topicId: string, sequenceNumber: number|null, consensusTimestamp: string, transactionId: string, status: "VERIFIED"|"MISMATCH"|"PENDING" }
// MovementRecord — lo que 003 ejecutó (listado/compra/liquidación con splits y txIds ya calculados)
{ listingId: string, purchaseId: string|null, valuationKey: string, assetType: "PAJ_BRAF"|"BULL", unitPriceUsd: number, quantity: number, royaltyPct: number, royaltyUsd: number, sellerUsd: number, totalUsd: number, purchaseTxId: string|null, settlementTxId: string|null, settled: boolean }
// PublicView — lo que ve el auditor (RF-07): registro + referencia verificable o ausencia explícita
{ record: object, mirrorUrl: string|null, hashscanUrl: string|null, unverified: boolean }
```

Referencias verificables (solo Testnet): `mirrorUrl = https://testnet.mirrornode.hedera.com/api/v1/topics/{topicId}/messages?sequenceNumber={seq}` y `hashscanUrl = https://hashscan.io/testnet/transaction/{txId}` (o `/contract/{contractId}`). Si la valuación aún no está certificada: `{ mirrorUrl: null, hashscanUrl: null, unverified: true }` — nunca referencia inventada.

### 2.2 `src/logic/mirrorRules.js` (puro, sin SDK/env/red)

```js
function buildBullRecord(bullInput, bullResult)            // (input11, { apto, motivos, mTotal, tasaciones }) => BullRecord o lanza
function buildValuationRecord(bullInput, bullResult, meta) // delega valuationKey a oracleMessage.buildOracleMessage; exige specVersion "001"
function decideValuationPut(existing, incoming)            // (row|null, ValuationRecord) => { decision, record }
function decideProofPut(existing, incoming, verdict)       // (row|null, ProofRecord, "VERIFIED"|"MISMATCH"|"PENDING") => { decision, record }
function decideListingPut(existing, listing, proofStatus)  // exige proofStatus === "VERIFIED", si no => { decision: "block-unverified" }
function decidePurchasePut(existing, purchase, ledger)     // mismo purchaseId idéntico => return-existing; ya settled + reintento de liquidar => reject-double-settle
function decideProofStatusUpdate(existing, nextStatus, proofOfTruth) // solo PENDING→VERIFIED|MISMATCH con prueba; nunca reescribe historia
function toPublicView(record, proof)                       // adjunta mirrorUrl/hashscanUrl o ausencia explícita + flag unverified
```

Pseudocódigo:

```
buildBullRecord(input, result):
  SI faltan los 11 inputs PEGBraf o result sin apto/mTotal/tasaciones: LANZAR "registro incompleto: el espejo no inventa"
  DEVOLVER { bullId, inputs: copia exacta 11, apto, motivos, mTotal, priceBullUsd, priceDoseUsd }

buildValuationRecord(input, result, meta):
  { message, valuationKey } = oracleMessage.buildOracleMessage(input, result, { specVersion: "001", publishedAt })  // lanza si no-APTO o spec ≠ 001
  DEVOLVER { valuationKey, bullId, specVersion: "001", mTotal, priceBullUsd, priceDoseUsd, canonicalJson: message }

decideValuationPut(existing, incoming):
  SI existing === null: DEVOLVER { decision: "insert", record: incoming }
  SI existing.valuationKey === incoming.valuationKey Y contenido idéntico (verifyMessageContent VERIFIED): DEVOLVER { decision: "return-existing", record: existing }
  SI misma valuationKey pero contenido difiere: LANZAR "colisión de clave con inputs distintos: es otra valuación, no idempotente"
  // Nota: specVersion distinta ⇒ valuationKey distinta ⇒ nunca llega aquí como existente (D-02).

decideProofPut(existing, incoming, verdict):
  SI verdict.status === "VERIFIED" pero verifyMessageContent(incoming, esperado) es MISMATCH: FORZAR { status: "MISMATCH" } (el espejo nunca declara válido lo ajeno)
  SI existing === null: DEVOLVER { decision: "insert", record: incoming-con-status }
  SI existing.status === "VERIFIED" Y incoming difiere: LANZAR "historia certificada inmutable"
  SI existing.status === "PENDING" Y verdict confirma VERIFIED|MISMATCH: DEVOLVER { decision: "update-status", record: {...existing, status, sin tocar proof/txIds} }
  SI reintento idéntico: DEVOLVER { decision: "return-existing", record: existing }

decideListingPut(existing, listing, proofStatus):
  SI proofStatus !== "VERIFIED": DEVOLVER { decision: "block-unverified", reason: "sin proof VERIFIED no hay listado" } (RF-04; el repo no escribe)
  SI existing === null: DEVOLVER { decision: "insert", record: listing }
  SI idéntico: DEVOLVER { decision: "return-existing", record: existing }
  SI listingId igual pero valuationKey/precio/% distintos: LANZAR "listado inmutable divergente"

decidePurchasePut(existing, purchase, ledger):
  SI existing === null: DEVOLVER { decision: "insert", record: purchase }
  SI existing.purchaseId === purchase.purchaseId Y totales/splits idénticos: DEVOLVER { decision: "return-existing", record: existing } (RF-06)
  SI existing.settled === true Y purchase pide liquidar de nuevo: LANZAR "doble liquidación denegada" ( espejo de applySettlement de 003)
  SI mismo purchaseId con importes distintos: LANZAR "purchaseId reutilizado con importes distintos"

decideProofStatusUpdate(existing, nextStatus, proofOfTruth):
  SI existing === null: LANZAR "sin registro que actualizar"
  SI existing.status !== "PENDING": LANZAR "solo PENDING transiciona (VERIFIED/MISMATCH finales)"
  SI nextStatus === "VERIFIED" Y proofOfTruth no es VERIFIED (verifier): LANZAR "el espejo no se autoverifica"
  DEVOLVER { decision: "update-status", record: {...existing, status: nextStatus, updated_at: nowParam} }  // nowParam por parámetro, nunca Date.now interno

toPublicView(record, proof):
  SI proof con topicId+seq/txId: ADJUNTAR { mirrorUrl, hashscanUrl, unverified: status !== "VERIFIED" }
  SI NO: DEVOLVER { record, mirrorUrl: null, hashscanUrl: null, unverified: true }
```

### 2.3 Repos `src/db/*` (borde, pseudocódigo con cliente inyectado)

```js
// supabaseClient.js — solo server-side
function createSupabaseClient({ url, key } = {}, deps = {})
  // deps.supabaseJs permite inyectar mock de "@supabase/supabase-js" en tests
  cfg = loadSupabaseConfig({ SUPABASE_URL: url, ... })  // valida https + clave presente, lanza antes de red
  SI sin url o sin key: LANZAR "credenciales Supabase ausentes (server-side .env)"
  sdk = deps.supabaseJs || require("@supabase/supabase-js")   // lazy, nunca en logic
  DEVOLVER sdk.createClient(url, key)

// Patrón común de cada repo (ej. valuationsRepo):
async function saveValuation(supabase, valuationRecord)
  decision = mirrorRules.decideValuationPut(null-optimista, valuationRecord) // validación pura primero, sin red
  // Escritura atómica idempotente: el motor resuelve la carrera, no dos SELECT
  { data, error } = await supabase.from("valuations").upsert(valuationRecordRow, { onConflict: "valuation_key" }).select()
  SI error con código 23505/409 fuera de upsert: RELEER getValuation(valuationKey) y aplicar decideValuationPut(existing, incoming) // convergencia
  DEVOLVER { valuation: toPublicView(data), existed: decision === "return-existing" }
async function getValuation(supabase, valuationKey)  // => PublicView con mirrorUrl/hashscanUrl o ausencia explícita
// proofsRepo.saveProof exige verdict de oracleVerifier (inyectado como verifyFn en el caller/E2E, nunca autoverificado)
// listingsRepo.saveListing exige proofStatus === "VERIFIED" (decideListingPut bloquea antes de red)
// listingsRepo.savePurchase/settlePurchase: upsert onConflict purchase_id + chequeo decidePurchasePut (sin doble acreditación; la acreditación real ya ocurrió on-chain en 003, aquí solo se refleja)
```

### 2.4 Interfaz con Supabase y Hedera (solo `src/db/` + `src/hedera/`, nunca `src/logic/`)

| Operación | Mecanismo | Dato que produce |
|-----------|-----------|------------------|
| Cliente Supabase | `createSupabaseClient` (`createClient(url, service_role)` para escritura server-side; `createClient(url, anon)` solo para lectura pública/E2E de consulta). Claves desde `config/supabase.config.js` (env server-side). | Cliente autenticado por rol |
| Escrituras (RF-01 a RF-06, RF-08) | `supabase.from(tabla).upsert(fila, { onConflict: clave_natural }).select()` — 1 round-trip por operación (RNF-04); `service_role` obligatoria, `anon` recibe 42501 y el repo lo propaga como "escritura denegada" | Fila espejo + flag `existed/updated` |
| Lecturas públicas (RF-07) | `supabase.from(tabla).select(...).eq(clave, valor)` con `anon` (RLS SELECT abierto); sin llamadas on-chain obligatorias; `toPublicView` adjunta `mirrorUrl/hashscanUrl` construidas, no consultadas | `PublicView` verificable |
| Verificación de verdad (RF-03/RF-04/RF-08) | Reutiliza `oracleVerifier.verifyValuation(proof, expectedMessage, { mirrorFetch })` existente (3 estados, gracia 60 s). Solo `VERIFIED` habilita listado/compra y promueve `PENDING→VERIFIED`; `MISMATCH/PENDING` bloquean y se conservan marcadas | `VERIFIED` o bloqueo explícito |
| Cliente Hedera (E2E) | `hcsClient.createHcsClient` existente (`Client.forTestnet()`). PROHIBIDO `forMainnet` | Finalidad Testnet para la proof real de la E2E |
| Cero Mainnet | `grep` antirregresión: `forMainnet|mainnet` vacío en `src/**` y `config/**`; `SUPABASE_URL` https; on-chain solo Testnet | Auditoría estática |

Límites: 1 upsert/select por operación (RNF-04 espejo rápido, cero tx on-chain extra por persistir); dinero en `NUMERIC(12,2)` espejado tal cual (sin recalcular splits: los splits los decidió 003); cantidades `NUMERIC(14,4)` (PAJ enteras, BULL 4 dec); `valuationKey/purchaseId/listingId` TEXT UNIQUE como claves de idempotencia.

## 3. Decisiones técnicas justificadas

| # | Decisión | Justificación | Alternativa descartada y por qué |
|---|----------|---------------|----------------------------------|
| T-01 | Puro `src/logic/mirrorRules.js` + 4 repos finos en `src/db/` + `config/supabase.config.js` (en vez de SQL inline o un mega-repo) | Constitution §2: idempotencia y veto de inválidos testeables offline; un archivo por responsabilidad (AGENTS.md); cada RF tiene seam de test. | Lógica de idempotencia dentro de cada repo con SQL: imposible testear RF-02/RF-04/RF-06 sin red ni proyecto. Un solo `db.js` genérico: mezcla toros/valuaciones/proofs/movimientos y pierde las claves naturales distintas. |
| T-02 | Upsert atómico por clave natural (`onConflict: valuation_key / purchase_id / listing_id`, UNIQUE en motor) como mecanismo de idempotencia | Cierra la carrera de reintentos (doble clic, timeout tras commit): el motor garantiza 1 fila por clave aunque dos escrituras lleguen a la vez. | SELECT-then-INSERT en JS: ventana de carrera ⇒ duplicados bajo reintento concurrente; además 2 round-trips por escritura (viola RNF-04). |
| T-03 | `service_role` solo server-side para toda escritura; `anon` solo lectura pública | La escritura del espejo es acto de operador (server); exponer `service_role` en cliente/frontend permitiría reescribir historia certificada (viola constitution §4 + RF-08). | `anon` con policy de escritura abierta: cualquier auditor reescribiría VERIFIED↔MISMATCH. Llevar claves al frontend: fuga garantizada (prohibido por spec supuesto 6). |
| T-04 | RLS activado con `SELECT` abierto a `anon` y escritura cerrada (solo `service_role` bypassa) | RF-07 exige consultas sin credenciales; RF-08 exige que nadie salvo el servidor actualice estados. RLS lo impone en el motor, no en código. | Sin RLS (confiar en el código): un cliente con la URL podría escribir con `anon`. RLS con `authenticated`: obligaría a login de usuarios, fuera de alcance de esta spec. |
| T-05 | Un solo proyecto Supabase de **test** + 5 tablas en `public` + `envLabel: "test"`; prod = proyecto aparte futuro (D-01) | Esta spec solo necesita memoria de test; un segundo proyecto ahora duplica RLS/claves sin lector. `envLabel` en config impide mezclar claves. | Dos proyectos desde ya (test+prod): costo operativo y riesgo de escribir test en prod sin E2E que lo justifique. Prefijos por entorno en un mismo proyecto: filtrado manual propenso a fugas entre entornos. |
| T-06 | Reutilizar `oracleMessage` (valuationKey + verifyMessageContent) y `marketplace` (splits ya calculados) + `oracleVerifier`/`hcsClient`; cero duplicación (D-02 incluido) | Spec supuestos: 001/002/003 son la única definición de qué se persiste; duplicar el hash o el comparador crea divergencia `2.45 vs 2.46`. | Reimplementar `sha256`/comparador/split en `db/`: dos semánticas de `valuationKey` coexistiendo ⇒ colisiones falsas y MISMATCH no detectados. |
| T-07 | Versionado por clave: `specVersion` dentro del hash ⇒ spec nueva = claves nuevas, historia 001 inmutable (D-02) | Heredado gratis de `oracleMessage` (lanza si `≠001`); sin migración ni backfill en esta spec; `spec_version` columna testigo para filtrar cohortes. | Columna `version` mutable sobre la misma fila: reescribiría historia certificada 001 (viola RF-08). Migración automática 001→002: cambiaría el pasado on-chain-verificado. |
| T-08 | Tests con dobles en memoria + cliente Supabase mock inyectado + 1 E2E gateada al proyecto de test | RNF-02 + constitution §3: cada RF con test offline; la persistencia real solo existe en red, por eso los criterios con conteo de filas se demuestran en la gateada. | Afirmar idempotencia real con mocks: prueba falsa (el mock no tiene UNIQUE). Todos los tests contra Supabase real: CI frágil, costoso y expone `service_role`. |
| T-09 | Usar `@supabase/supabase-js` aprobada 2026-10-16 (consta en `package.json ^2.118.0` y `MEMORY.md`), importada solo en `src/db/supabaseClient.js` vía lazy require | Constitution §1 cumplido (aprobación explícita documentada antes de usar); un único punto de importación facilita el grep de pureza y la sustitución por mock. | Cliente REST manual con `fetch`: reimplementa auth/retry/tipos sin beneficio y dispersa el secreto por cada repo. Importar el SDK en `logic/` o `config/`: viola §2 y el test de pureza. |

## 4. Estrategia de tests (`node --test`, sin frameworks)

Orden TDD (cada paso: rojo → mínimo → verde; `node --test tests/` tras cada paso):

1. **`mirrorRules` puro — valuaciones y toros (RF-01, RF-02):** `buildValuationRecord` genera `valuationKey` estable e incluye `specVersion "001"`; `decideValuationPut(null, x)` ⇒ `insert`; reintento idéntico ⇒ `return-existing` con mismos `mTotal`/precios; misma clave con input distinto (CE 1.5 vs 1.6) ⇒ lanza; `specVersion "002"` ⇒ lanza (D-02). Sin red, sin claves.
2. **`mirrorRules` puro — proofs y veto (RF-03, RF-04, RF-08):** `decideProofPut` conserva `VERIFIED/MISMATCH/PENDING` ligado a `valuationKey`; proof `MISMATCH`/`PENDING` ⇒ `toPublicView.unverified === true` y `decideListingPut` ⇒ `block-unverified` (nunca habilita listado/compra); `decideProofStatusUpdate` solo `PENDING→VERIFIED|MISMATCH` con prueba de verdad, nunca reescribe `proof/txIds`; `VERIFIED→*` o autopromoción sin prueba ⇒ lanza.
3. **`mirrorRules` puro — movimientos (RF-05, RF-06):** `decidePurchasePut` con mismo `purchaseId` idéntico ⇒ `return-existing` sin reacreditar; segundo settle del mismo `purchaseId` ⇒ lanza "doble liquidación"; `purchaseId` reutilizado con importes distintos ⇒ lanza; regalías 0% y 100% se reflejan tal cual (`$0` explícito); `toPublicView` adjunta `mirrorUrl/hashscanUrl` Testnet o ausencia explícita `{ null, null, unverified: true }`.
4. **Repos con mock (RF-01 a RF-08):** cliente Supabase falso en memoria con `from().upsert().select()/select().eq()`; cada repo: `save*` llama 1 vez al motor (upsert con `onConflict` correcto), `get*` devuelve `PublicView`; `saveListing` con `proofStatus !== VERIFIED` ⇒ 0 llamadas de escritura; `service_role` ausente ⇒ lanza antes de red; `anon` en escritura simulada (error 42501) ⇒ propaga "denegada".
5. **E2E gateada proyecto test (criterios 2/3/4/5):** `supabaseIntegration.test.js` con `skip` salvo `RUN_SUPABASE_INTEGRATION=1` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (+ `MY_ACCOUNT_ID`/`MY_PRIVATE_KEY` solo para la proof VERIFIED real vía `oracleVerifier`). Flujo: guarda toro+valuación (RF-01/RF-02), reintenta misma `valuationKey` (conteo filas = 1), guarda proof PENDING→VERIFIED vía mirror real (RF-03/RF-08), intenta listar con PENDING (bloqueado, RF-04), guarda listing/purchase/settlement, reintenta `purchaseId` (sin duplicado ni reacreditación, RF-06), consultas por toro/`valuationKey`/`listingId`/`purchaseId`/estado devuelven referencia HashScan (RF-07). No bloquea el verde local.
6. **Antirregresión pureza/seguridad:** extender `purity.test.js`: `src/logic/**` sin `supabase|hashgraph|process.env|fetch(|Date.now|Math.random`; `src/db/**` sin `forMainnet|mainnet`; `config/**` + `src/db/**` sin `0x[0-9a-f]{20,}|BEGIN PRIVATE KEY|SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?[A-Za-z0-9]`; `.env` no trackeado (ya existe test); `.env.example` con placeholders Supabase ficticios; matriz RF-01…RF-08 de 004.

Todos con `node:test` (`describe/it`) + `node:assert/strict`, CommonJS, sin instalar nada nuevo (dependencia ya aprobada e instalada).

## 5. Matriz RF → test (constitution §3: ≥1 test por RF)

| RF | Test(s) | Archivo | Aserción clave |
|----|---------|---------|----------------|
| RF-01 | `buildBullRecord guarda 11 inputs + veredicto` / `bullsRepo.saveBull hace 1 upsert y getBull devuelve PublicView` | `mirrorRules.test.js` (puro) + `dbRepos.test.js` (mock) | `bullId` + 11 inputs presentes; `upsert` con `onConflict: bull_id` 1 llamada |
| RF-02 | `reintento misma valuationKey devuelve original sin duplicar` / `misma clave con input distinto lanza` | `mirrorRules.test.js` + `dbRepos.test.js` + E2E (conteo filas = 1) | `mTotal`/precios idénticos; CE 1.5 vs 1.6 no colisiona |
| RF-03 | `saveProof guarda topicId/sequenceNumber/consensusTimestamp/transactionId + estado ligado a valuationKey` | `mirrorRules.test.js` + `dbRepos.test.js` + E2E (PENDING→VERIFIED real) | `status` conservado; `updateProofStatus` con prueba de verdad |
| RF-04 | `MISMATCH/PENDING nunca VERIFIED ni habilitan listado/compra` (incl. `mTotal` 2.45 vs 2.46) | `mirrorRules.test.js` (`block-unverified`) + `dbRepos.test.js` (0 escrituras) + E2E | `unverified === true`; `saveListing` 0 llamadas con PENDING |
| RF-05 | `saveListing/savePurchase/saveSettlement reflejan listingId/purchaseId/royaltyPct/splits/txIds ligados a valuationKey` | `mirrorRules.test.js` + `dbRepos.test.js` + E2E | `royaltyPct`, `royaltyUsd/sellerUsd`, `txIds` presentes; 0% y 100% explícitos |
| RF-06 | `mismo purchaseId dos veces devuelve original sin reacreditar ni segunda liquidación` | `mirrorRules.test.js` (`reject-double-settle`) + `dbRepos.test.js` + E2E (importes idénticos) | Sin doble pago; segundo settle lanza |
| RF-07 | `consultas por toro/valuationKey/listingId/purchaseId/estado devuelven referencia mirror/HashScan o ausencia explícita, con anon` | `dbRepos.test.js` (mock `select.eq`) + E2E (proyecto test) | `mirrorUrl/hashscanUrl` Testnet o `{ null, null, unverified: true }` |
| RF-08 | `cambio confirmado actualiza estado sin reescribir historia` | `mirrorRules.test.js` + `dbRepos.test.js` + E2E (PENDING→VERIFIED conserva proof/txIds) | `proof/valuationKey/txIds` originales intactos |
| D-01 | `config + RLS/entornos` | `supabaseConfig.test.js` + `purity.test.js` (RLS/gitignore/placeholders) | `service_role` nunca en cliente; `.env` no trackeado; SELECT anon / escritura solo service_role documentada |
| D-02 | `specVersion ≠ 001 ⇒ claves nuevas, 001 inmutable` | `mirrorRules.test.js` | `buildValuationRecord` con `002` lanza; claves `001` intactas |

RNF cubiertos: pureza (antirregresión), solo-Testnet (grep + `forTestnet`), sin secretos (grep claves/URL), espejo rápido (1 op por escritura, lectura sin on-chain), idioma (revisión manual).

## 6. Riesgos y mitigaciones

| # | Riesgo | Impacto | Mitigación en este plan |
|---|--------|---------|--------------------------|
| R-01 | **Carrera de reintentos** (doble clic / timeout tras commit ⇒ 2 escrituras misma clave) | Duplicados o doble liquidación aparente | T-02: UNIQUE + upsert atómico en motor; `decide*Put` convergente (releer + decidir); E2E verifica conteo = 1 |
| R-02 | **Fuga de `service_role`** (commiteada o logueada) | Reescritura de historia certificada | T-03/T-04 + D-01: solo server-side `.env`, `.gitignore` + `.env.example` ficticio, grep antirregresión, rotación documentada |
| R-03 | **RLS mal configurada** (anon escribe o público no lee) | RF-07 o RF-08 rotos en el motor | D-01: RLS desde el día uno + E2E que escribe con `service_role` y lee con `anon`; test negativo: escritura con `anon` ⇒ 42501 |
| R-04 | **Espejo diverge de la cadena** (veredicto local inventado, MISMATCH mostrado como VERIFIED) | Auditor confía en espejo inválido | `decideProofPut` fuerza MISMATCH ante divergencia; `block-unverified`; `updateProofStatus` exige prueba del verifier; `toPublicView.unverified` explícito |
| R-05 | **Supabase caído / sin credenciales** (caso límite spec) | Escritura imposible; tentación de confirmar en memoria | Repos lanzan "espejo no disponible" sin inventar datos; el caller conserva el pendiente y reintenta con la misma clave (idempotencia ⇒ sin duplicado) |
| R-06 | **Mirror lag → PENDING eterno tratado como fallo** | Venta legítima bloqueada para siempre | Se reutiliza gracia 60 s + `retryAfterMs` del verifier (Spec 002); PENDING se conserva y se reintenta, nunca se autoverifica |
| R-07 | **Fuga de SDK/env/red a `src/logic/` o Mainnet accidental** | Viola constitution §§1/2/4 | `mirrorRules.js` puro (mismo grep que 001/002/003) + `@supabase/supabase-js` solo en `supabaseClient.js`; grep `forMainnet/mainnet` vacío |
| R-08 | **E2E frágil en CI / credenciales / Testnet caída** | CI rojo por red, no por código | E2E gateada `RUN_SUPABASE_INTEGRATION=1` con `skip` por defecto; CI solo dobles; criterios con conteo/visibilidad se demuestran en corrida manual |
| R-09 | **Versionado futuro rompe historia 001** | Registros 001 reescritos por motor 002 | T-07/D-02: clave incluye `specVersion`; 001 inmutable; columna `spec_version` testigo; sin migración en esta spec |

## 7. Criterio de listo (para `tasks.md` y `/sdd-validate`)

1. `src/logic/mirrorRules.js`, `src/db/{supabaseClient,bullsRepo,valuationsRepo,proofsRepo,listingsRepo}.js` y `config/supabase.config.js` existen, CommonJS, comentarios en español e identificadores en inglés; `.env.example` documenta `SUPABASE_URL/_ANON_KEY/_SERVICE_ROLE_KEY` ficticios.
2. `node --test tests/` en verde sin red ni credenciales (dobles): RF-01 a RF-08 con ≥1 test cada uno + D-01/D-02 cubiertos.
3. Idempotencia verificada: misma `valuationKey` ⇒ 1 fila; mismo `purchaseId` ⇒ sin duplicado ni reacreditación; `MISMATCH/PENDING` nunca `VERIFIED` ni habilitan listado/compra.
4. Corrida manual con `RUN_SUPABASE_INTEGRATION=1` contra el proyecto de test demuestra criterios 2/3/4/5 (conteo de filas, estados, referencias HashScan Testnet) sin bloquear el verde local.
5. `grep` confirma: cero `@supabase/supabase-js`/`@hashgraph/sdk`/`process.env`/`fetch(`/`Date.now`/`Math.random` en `src/logic/`; cero `forMainnet`/`mainnet` en `src/**` y `config/**`; cero claves Supabase/Hedera en repo/tests/logs (solo placeholders `.example`); ninguna operación apunta a Mainnet; `@supabase/supabase-js` usada con aprobación 2026-10-16 documentada.
6. Veredicto `APROBADO` del revisor y `MEMORY.md` actualizado (fuera de este plan, registrado para `tasks.md`).

## 8. Trazabilidad spec → plan → constitution

| Spec | Este plan | Constitution |
|------|-----------|--------------|
| Invariante chain = verdad + RF-03/RF-04 (proof y veto de inválido) | `mirrorRules.decideProofPut/block-unverified` + `oracleVerifier` reutilizado (T-06), matriz §5 | §5 fuente PEGBraf/mirror (el espejo nunca declara válido lo ajeno), §2 separación |
| RF-01/RF-02 (toro + valuación idempotente por `valuationKey`) | `bullsRepo/valuationsRepo` upsert `onConflict` (T-02) + `buildValuationRecord` vía `oracleMessage` (T-06) | §5 (sin redefinir umbrales), §3 tests, §2 pureza |
| RF-05/RF-06 (movimientos + idempotencia `purchaseId`) | `listingsRepo` + `decidePurchasePut` espejo de `applySettlement` 003 (T-06) | §3 (test por RF), §7 hecho |
| RF-07 (consultas públicas verificables) | RLS SELECT anon + `toPublicView` con mirror/HashScan o ausencia explícita (T-04, D-01) | §4 Testnet, §3 tests con dobles + gateada |
| RF-08 (actualización solo desde la verdad) | `decideProofStatusUpdate` PENDING→final con prueba, historia intacta (D-02) | §7 hecho verificable |
| RNF-01/RNF-02 (capas + `node --test` dobles + 1 E2E) | `src/logic/` vs `src/db/`+`src/hedera/` + §4 estrategia (T-01/T-08) | §1 tests nativos, §2 separación, §3 TDD |
| RNF-03/RNF-04/RNF-05/RNF-07 (secretos, espejo rápido, integridad, dependencia) | §2.4 (1 op/escritura, server-side, `service_role` custodiada) + T-09 (aprobación 2026-10-16 registrada) | §1 stack (aprobación explícita), §4 seguridad |
| RNF-06 (idioma) | Español docs/comentarios, inglés código | §6 idioma |
| Fuera de alcance (sin motor/oráculo/contrato/minteo, sin otro motor distinto de Supabase) | No se diseña validación, tasación, topic, contrato ni token; solo se consume `evaluateBull` + `oracleMessage` + `marketplace` + `verifier` | §1 stack bloqueado (Hedera + Supabase aprobado, nada más) |
| D-01/D-02 spec | §1.3 (1 proyecto test + RLS + ciclo credenciales + gitignore) y §1.4 (claves nuevas + 001 inmutable) | §4 (`.env` nunca commiteado, Testnet), §5 (historia certificada intacta) |
