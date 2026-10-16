# Plan Técnico — Spec 002 Registro de Oráculo en HCS

> Spec origen: `specs/002-registro-oraculo-hcs/spec.md` (APROBADA 2026-10-16, RF-01 a RF-08).
> Constitución: `docs/constitution.md` §§1–7.
> Alcance de este plan: solo diseño. No implementa código, solo define el CÓMO.
> Responde a las 3 observaciones del Reviewer: (1) dónde guardar `topicId`, (2) `specVersion` + reintentos N+backoff+idempotencia, (3) 3 estados de verificación.

## 1. Arquitectura propuesta

### 1.1 Mapa de archivos (crear, no modificar lógica existente)

```
src/
├── logic/                            # Capa pura — PROHIBIDO @hashgraph/sdk, process.env, red, fs, Date.now, Math.random
│   ├── constants.js                  # EXISTENTE Spec 001 — no se toca
│   ├── validator.js                  # EXISTENTE — no se toca
│   ├── pricing.js                    # EXISTENTE — no se toca
│   ├── evaluateBull.js               # EXISTENTE — única entrada del oráculo (precondición apto=true)
│   └── oracleMessage.js              # NUEVO (puro) — construye mensaje canónico + canonical JSON (RF-05)
├── hedera/                           # Capa infraestructura — único lugar con @hashgraph/sdk y red
│   ├── hcsClient.js                  # NUEVO — crea Client.forTestnet() desde .env, valida credenciales (base RF-01/RF-04/RF-07)
│   ├── topicManager.js               # NUEVO — createValuationsTopic / resolveValuationsTopic (RF-01, RF-02)
│   ├── oraclePublisher.js            # NUEVO — guarda APTO + reintentos con backoff + idempotencia (RF-03, RF-04, RF-07, RF-08)
│   └── oracleVerifier.js             # NUEVO — verifica vía mirror node con 3 estados (RF-06)
config/
└── oracle.config.js                  # NUEVO — carga topicId y parámetros no-secretos desde env (obs. Reviewer #1)
tests/
├── oracleMessage.test.js             # NUEVO — RF-05 (contenido mínimo + specVersion 001 + canonical)
├── topicManager.test.js              # NUEVO — RF-01, RF-02 (mocks, sin red)
├── oraclePublisher.test.js           # NUEVO — RF-03, RF-04, RF-07, RF-08 (mocks, sin red)
├── oracleVerifier.test.js            # NUEVO — RF-06 (3 estados, mock mirror)
└── hcsIntegration.test.js            # NUEVO — 1 único test E2E Testnet gateado (RF-04 + RF-06, fuera de CI)
.env.example                          # NUEVO (o ampliar si existe) — documenta HCS_VALUATIONS_TOPIC_ID sin valores reales
```

Ningún archivo existente de `src/logic/` se modifica. `tokenizarToro.js` queda intacto (demo pre-SDD).
Ningún archivo de `src/logic/` importará `@hashgraph/sdk`, `process.env`, `fetch` ni `src/hedera/*`.
Dirección de dependencias (una sola, sin ciclos):

```
oraclePublisher.js → hcsClient.js, topicManager.js, oracle.config.js
oraclePublisher.js → src/logic/evaluateBull.js (solo lectura del resultado, nunca recalcula)
oraclePublisher.js → src/logic/oracleMessage.js (construye payload puro antes de tocar red)
oracleVerifier.js  → mirror node REST (fetch) — nunca SDK con claves
tests/*            → mocks inyectados (nunca Client real salvo hcsIntegration)
```

### 1.2 Responsabilidades por archivo

| Archivo | Responsabilidad | Recibe | Devuelve | RF dueños |
|---------|----------------|--------|----------|-----------|
| `src/logic/oracleMessage.js` | Construir el objeto mensaje canónico y su serialización estable. Puro, sin red ni fecha interna. | `(bullInput, bullResult, meta)` donde `meta = { publishedAt, specVersion }` | `{ message, canonicalJson }` o lanza si `apto=false` | RF-05 (contenido), precondición RF-03 |
| `src/hedera/hcsClient.js` | Crear y validar cliente Testnet. Falla explícito sin credenciales. Nunca Mainnet. | `{ accountId, privateKey }` (desde env) | `Client.forTestnet()` con operator | Base RF-01/RF-04 |
| `config/oracle.config.js` | Resolver `topicId` configurado y parámetros operativos desde env. No guarda secretos nuevos (obs. #1). | `process.env` | `{ topicId \| null, network:'testnet', maxRetries, baseDelayMs }` | RF-01/RF-02 |
| `src/hedera/topicManager.js` | Crear topic de tasaciones o reutilizar el configurado. Error explícito si el configurado no existe. | `(client, configuredTopicId?)` | `topicId` string | RF-01, RF-02 |
| `src/hedera/oraclePublisher.js` | Guarda APTO: valida `apto=true`, publica 1 mensaje, reintenta con backoff, evita duplicados, devuelve prueba. | `(client, topicId, bullInput, bullResult, options)` | `{ topicId, sequenceNumber, consensusTimestamp, transactionId }` | RF-03, RF-04, RF-07, RF-08 |
| `src/hedera/oracleVerifier.js` | Recupera mensaje vía mirror node y compara íntegramente. 3 estados (obs. #3). | `(proof, expectedMessage, mirrorFetch)` | `{ status, message?, reason }` | RF-06 |
| `tests/*.test.js` | 1+ test por RF con `node:test` + `node:assert/strict`, mocks sin red; 1 E2E gateado | — | Verde/rojo | Ver §5 matriz |

### 1.3 Dónde guardar `topicId` (observación Reviewer #1 — decisión cerrada)

* `topicId` **no es un secreto** (es público y verificable en HashScan), pero **no se hardcodea ni se commitea en código**.
* Fuente única: variable de entorno `HCS_VALUATIONS_TOPIC_ID` (vacía = no configurado → RF-01 crea; con valor = RF-02 reutiliza).
* `config/oracle.config.js` es el único lector de esa variable: valida formato `0.0.<n>`, devuelve `null` si ausente, lanza `Error("configuración inválida")` si malformada. Ningún otro archivo lee `process.env` directamente.
* `.env` (nunca commiteado, constitution §4) guarda `HCS_VALUATIONS_TOPIC_ID` junto a `MY_ACCOUNT_ID` / `MY_PRIVATE_KEY` existentes. `.env.example` documenta la clave con valor ficticio `0.0.000000`.
* Flujo operativo: tras `createValuationsTopic`, el operador copia el `topicId` devuelto a su `.env` local / secreto de CI. El sistema nunca escribe `.env` por sí mismo ni crea un topic paralelo en silencio si el configurado falla (caso límite spec: error explícito).
* Alternativas descartadas: ver T-01 en §3.

### 1.4 Versión de spec y parámetros de reintento (observación Reviewer #2 — valores cerrados)

* Todo mensaje lleva `"specVersion": "001"` (string, exacto) + `"schemaVersion": 1` y `"valuationKey"` (idempotencia, ver abajo). El verificador exige `specVersion === "001"`; otro valor → `MISMATCH` con motivo `spec-version`.
* Reintentos: `MAX_RETRIES = 3` reintentos tras el intento inicial (4 intentos totales), `BASE_DELAY_MS = 1000`, backoff exponencial con jitter: `delay = BASE * 2^attempt + random(0..250)ms`. Solo se reintentan errores retryables (timeout, `UNAVAILABLE`, `TRANSACTION_EXPIRED`, fallo `getReceipt` sin receipt). Errores no-retryables (`INSUFFICIENT_TX_FEE`, credenciales inválidas, `apto=false`, topic inexistente) fallan de inmediato sin reintentar.
* Idempotencia observable (RF-08): `valuationKey = stableHash(bullId + canonicalJson)` generado por `oracleMessage.js` y enviado dentro del mensaje. Reglas: (a) nunca se confirma registro sin receipt de consenso; (b) mientras un reintento esté en curso, el publisher mantiene flag `inFlight[valuationKey]` y no lanza un segundo `execute` concurrente para la misma key (`MIENTRAS` RF-08); (c) si el intento anterior obtuvo receipt, no se reenvía aunque el caller reintente (se devuelve la prueba original); (d) si el error fue timeout sin receipt, el reintento reenvía — el posible duplicado en red se detecta en verificación por `valuationKey` repetido y no se presenta como dos tasaciones distintas. HCS no ofrece nonce nativo; esta es idempotencia de borde, no garantía de red.

### 1.5 Tres estados de verificación (observación Reviewer #3 — contrato cerrado)

`oracleVerifier.js` devuelve exactamente uno de:

1. `VERIFIED` — el mensaje existe en mirror node y su contenido canónico coincide íntegramente (comparación byte-a-byte del `canonicalJson`, incluyendo `mTotal` y ambas tasaciones; un decimal distinto → no verificado).
2. `MISMATCH` — el mensaje existe pero difiere (`specVersion` distinta, `mTotal`/tasaciones alterados, `bullId` distinto). Incluye `reason` y diff mínimo de campos.
3. `PENDING` — no concluyente: mensaje aún no visible en mirror (lag de sincronización, segundos) o mirror inalcanzable/transitorio. Incluye `reason: "not-yet-synced" | "mirror-unavailable"` y `retryAfterMs` sugerido. Nunca se devuelve `MISMATCH`/`NOT_FOUND` definitivo dentro de la ventana de gracia (60 s desde `consensusTimestamp`).

No existe estado `NOT_FOUND` definitivo en esta spec: pasado el grace period sin aparecer, se sigue reportando `PENDING` con `reason: "not-found-after-grace"` para no declarar falsos negativos (caso límite spec).

## 2. Diseño de funciones puras y de borde

Convenciones: CommonJS (`require`/`module.exports`), comentarios en español, identificadores en inglés camelCase (constitution §6).

### 2.1 Contrato del mensaje (RF-05 + `specVersion` 001)

```js
// OracleMessage — objeto canónico (claves ordenadas en canonicalJson)
{
  specVersion: "001",               // fijo, string — trazabilidad a motor Spec 001
  schemaVersion: 1,                 // entero — evolución futura del sobre
  bullId: string,                   // identificación toro/lote (viene de bullInput.bullId o lote; requerido no-vacío)
  inputs: {                         // los 11 campos PEGBraf evaluados (copia exacta, sin redondeo)
    pesoNacerDep, pesoDestateDep, edadDesteDias, pesoFinalDep, edadPesoFinalDias,
    circunferenciaEscrotalCm, areaOjoBifeCm2, grasaIntramuscularTop5,
    motilidadSeminalPct, volumenEyaculadoMl, pajuelasProducidas
  },
  verdict: { apto: true },          // siempre true aquí (si false, build lanza y RF-03 bloquea antes de red)
  mTotal: number,                   // de BullResult (ej. 2.45)
  valuationsUsd: { bull: number, dose: number }, // ej. { bull: 73500, dose: 24.50 }
  publishedAt: string,              // ISO-8601 UTC pasado como parámetro (no Date.now interno → pureza testeable)
  valuationKey: string              // hex estable = hash(canonical sin valuationKey) para idempotencia
}
```

### 2.2 `src/logic/oracleMessage.js` (puro)

```js
function buildOracleMessage(bullInput, bullResult, meta)
// (BullInput, BullResult, { publishedAt: string, specVersion?: "001" }) => { message, canonicalJson, valuationKey }
function toCanonicalJson(obj)      // (object) => string (stringify con claves ordenadas recursivamente)
function verifyMessageContent(retrievedJson, expectedMessage) // (string|object, object) => { status: 'VERIFIED'|'MISMATCH', diff? }
```

Pseudocódigo:

```
buildOracleMessage(bullInput, bullResult, meta):
  SI bullResult.apto !== true: LANZAR Error("solo APTOS registrables")
  SI bullResult.mTotal === null O valuations null: LANZAR Error("tasación ausente")
  specVersion = meta.specVersion ?? "001"
  SI specVersion !== "001": LANZAR Error("spec-version no soportada")
  messageSinKey = { specVersion, schemaVersion: 1, bullId, inputs: copiaExacta11Campos,
                    verdict: { apto: true }, mTotal, valuationsUsd: { bull, dose },
                    publishedAt: meta.publishedAt }
  valuationKey = sha256Hex(toCanonicalJson(messageSinKey))   // requiere node:crypto, puro, sin red
  message = { ...messageSinKey, valuationKey }
  DEVOLVER { message, canonicalJson: toCanonicalJson(message), valuationKey }

toCanonicalJson(obj):
  SI obj es array: DEVOLVER "[" + elementos canónicos + "]"
  SI obj es objeto: ordenar claves alfabéticamente, serializar recursivamente
  SINO: JSON.stringify(valor)  // números sin redondeo; dose 24.50 serializa como 24.5 pero la comparación usa número, no string

verifyMessageContent(retrieved, expected):
  normalizar ambos a objeto (parse si string)
  SI retrieved.valuationKey !== expected.valuationKey O cualquier campo difiere (comparación profunda numérica exacta):
    DEVOLVER { status: "MISMATCH", diff: listaCamposDiferentes }
  SINO DEVOLVER { status: "VERIFIED" }
```

Nota: `24.50` vs `24.5` es el mismo número JSON; la integridad se juzga por valor numérico exacto (`===`), no por formato de string. Un `2.45` vs `2.46` sí es `MISMATCH`.

### 2.3 `src/hedera/*` (borde, no puras — pseudocódigo)

```js
// hcsClient.js
function createHcsClient({ accountId, privateKey }) // => Client (solo Testnet)
  SI falta accountId o privateKey: LANZAR Error("credenciales ausentes — sin tocar red")
  client = Client.forTestnet(); client.setOperator(accountId, PrivateKey.fromStringECDSA(privateKey))
  DEVOLVER client
  // PROHIBIDO Client.forMainnet() — grep del revisor lo audita

// topicManager.js
async function createValuationsTopic(client, { memo = "Muurketplace oracle v001" }) // => topicId string
  tx = new TopicCreateTransaction().setTopicMemo(memo); receipt = await (await tx.execute(client)).getReceipt(client)
  DEVOLVER receipt.topicId.toString()
async function resolveValuationsTopic(client, configuredTopicId) // => topicId string
  SI configuredTopicId == null: DEVOLVER createValuationsTopic(client)          // RF-01
  SI formato inválido: LANZAR Error("topicId malformado")
  // validación existencia: TopicInfoQuery; SI falla NOT_FOUND: LANZAR Error("topic configurado inexistente") — no crear paralelo // RF-02 + caso límite
  SINO DEVOLVER configuredTopicId

// oraclePublisher.js
async function publishValuation(client, topicId, bullInput, bullResult, options)
  // options = { publishedAt, maxRetries = 3, baseDelayMs = 1000, submitFn inyectable para mocks }
  SI bullResult.apto !== true: LANZAR Error(motivos) SIN tocar red                          // RF-03
  { message, canonicalJson, valuationKey } = buildOracleMessage(bullInput, bullResult, { publishedAt, specVersion: "001" })
  SI inFlight.has(valuationKey): LANZAR Error("publicación en curso para esta tasación")     // RF-08 MIENTRAS
  inFlight.add(valuationKey)
  INTENTAR:
    PARA intento EN 0..maxRetries:
      INTENTAR:
        tx = new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(canonicalJson)
        resp = await submitFn(tx, client); receipt = await resp.getReceipt(client)
        proof = { topicId, sequenceNumber: receipt.topicSequenceNumber?.toString() ?? resp.sequenceNumber,
                  consensusTimestamp: resp.consensusTimestamp?.toString(), transactionId: resp.transactionId.toString() }
        cache[valuationKey] = proof; DEVOLVER proof                                          // RF-04 — solo con prueba
      CAPTURAR err:
        SI es cache hit con receipt previo: DEVOLVER cache[valuationKey]                    // idempotencia
        SI NO esRetryable(err) O intento === maxRetries: LANZAR Error("registro no confirmado") SIN prueba
        SINO ESPERAR computeBackoffMs(intento, baseDelayMs) Y CONTINUAR                     // RF-07
  FINALMENTE: inFlight.delete(valuationKey)

function isRetryableError(err) // (Error) => boolean — pura, testeable
function computeBackoffMs(attempt, baseDelayMs) // (0..3, 1000) => 1000*2^attempt + jitter — pura

// oracleVerifier.js
async function verifyValuation(proof, expectedMessage, { mirrorFetch, gracePeriodMs = 60000 })
  // proof = { topicId, sequenceNumber? , transactionId? } — basta uno
  raw = await mirrorFetch(`/api/v1/topics/{topicId}/messages?sequenceNumber={seq}` o `.../transactions/{txId}`)
  SI raw vacío Y dentro de gracia: DEVOLVER { status: "PENDING", reason: "not-yet-synced", retryAfterMs: 5000 }
  SI raw vacío Y fuera de gracia: DEVOLVER { status: "PENDING", reason: "not-found-after-grace" }
  SI mirrorFetch lanza transitorio: DEVOLVER { status: "PENDING", reason: "mirror-unavailable" }
  DEVOLVER verifyMessageContent(raw.contentsDecodificado, expectedMessage)  // VERIFIED o MISMATCH // RF-06
```

### 2.4 Interfaz con Hedera SDK (solo `src/hedera/`, solo Testnet)

| Operación | Clase SDK | Método clave | Dato que produce |
|-----------|-----------|--------------|------------------|
| Cliente | `Client`, `PrivateKey` | `Client.forTestnet()`, `setOperator(id, key)`, `PrivateKey.fromStringECDSA()` | Cliente firmado (patrón `tokenizarToro.js`) |
| Crear topic (RF-01) | `TopicCreateTransaction` | `.setTopicMemo()`, `.execute(client)`, `.getReceipt(client)` → `receipt.topicId` | `topicId` `0.0.x` |
| Validar topic (RF-02) | `TopicInfoQuery` | `.setTopicId(id).execute(client)` | Existe / `NOT_FOUND` → error explícito |
| Publicar (RF-04) | `TopicMessageSubmitTransaction` | `.setTopicId().setMessage(canonicalJson)`, `.execute()`, `.getReceipt()` | `sequenceNumber`, `consensusTimestamp`, `transactionId` |
| Verificar (RF-06) | Mirror node REST (no SDK) | `GET https://testnet.mirrornode.hedera.com/api/v1/topics/{topicId}/messages?sequenceNumber={n}` (+ `fetch` con timeout 10 s) | `contents` (base64→utf8 JSON), `consensus_timestamp`, `sequence_number` |
| Enlace público | — | `https://hashscan.io/testnet/topic/{topicId}` y `.../transaction/{txId}` | Prueba exhibible HU-01/HU-02 |

Límites respetados: mensaje único por tasación (sin fragmentación, supuesto 5 spec); comisión 1 HCS-msg por publicación (RNF-03); receipt antes de confirmar (RNF-04); cero `Mainnet` (RNF-06 — auditable con `grep -r "forMainnet\|mainnet" src/ tests/` vacío).

## 3. Decisiones técnicas justificadas

| # | Decisión | Justificación | Alternativa descartada y por qué |
|---|----------|---------------|----------------------------------|
| T-01 | `topicId` en `HCS_VALUATIONS_TOPIC_ID` + `config/oracle.config.js` (obs. #1) | `topicId` es público pero operativo: env evita hardcodeo y topics duplicados sin crear secreto nuevo; un único lector facilita mock y auditoría; `.env.example` documenta sin exponer valores (constitution §4). | Hardcodear en `topicManager.js`: obliga a editar código por despliegue y se commitea por error. Guardar en DB/API local: infraestructura fuera de alcance spec. Archivo commiteado `topic.json`: expone historial y permite divergencia entre entornos. |
| T-02 | Sobre con `specVersion:"001"` + `schemaVersion:1` + `valuationKey` (obs. #2) | Fija trazabilidad al motor auditado (constitution §5); permite evolucionar el sobre sin romper verificación vieja; `valuationKey` da idempotencia observable sin soporte nativo HCS. | Sin versión: imposible distinguir mensajes de futuros motores; hash del PDF PEGBraf (D-02 spec): pesado y fuera de alcance — los 11 campos + lote bastan en esta spec. |
| T-03 | Reintentos `3 + backoff exp. + jitter`, solo retryables, nunca confirmar sin receipt (obs. #2, RF-07) | Acota costo y latencia (RNF-03/RNF-04); backoff evita tormenta contra Testnet; distinguir retryable/no-retryable evita reintentar errores inútiles (credenciales, `apto=false`). | Reintento infinito: costo y cuelgue. Reintento inmediato sin espera: agrava congestión y duplica. Confirmación optimista pre-receipt: viola RNF-04 y crea pruebas falsas. |
| T-04 | Idempotencia de borde (`valuationKey` + `inFlight` + caché de proof), no promesa de red (RF-08) | HCS es append-only sin nonces: lo máximo honesto es no lanzar dos `execute` concurrentes y no reenviar tras receipt; duplicados por timeout se detectan por `valuationKey` repetido. | Clave de idempotencia nativa: no existe en `TopicMessageSubmitTransaction`. Deduplicación perfecta en red: imposible sin índice externo (fuera de alcance DB). |
| T-05 | Construcción del mensaje en `src/logic/oracleMessage.js` puro, no en `src/hedera/` | Constitution §2: contenido = lógica testeable sin red; `publishedAt` por parámetro mantiene pureza (sin `Date.now` interno); `src/hedera/` solo serializa y envía. | Builder dentro de `oraclePublisher.js` con `Date.now` y `process.env`: impuro, no testeable offline, mezcla capas. |
| T-06 | Verificación en 3 estados con `PENDING` y gracia 60 s, vía mirror REST (obs. #3, RF-06) | Mirror tiene lag de segundos (supuesto 4 spec): declarar `MISMATCH`/`NOT_FOUND` de inmediato daría falsos negativos; `PENDING` con `retryAfterMs` es el comportamiento correcto y testeable. | Binario `VÁLIDO/INVÁLIDO`: rompe el caso límite "mirror no sincronizado". Verificación vía SDK con claves: exige credenciales de operador para un acto público (viola RNF-07). |
| T-07 | Comparación por valor numérico exacto (`===`), canonical JSON con claves ordenadas | Evita falsos `MISMATCH` por orden de claves o `24.5` vs `24.50`; un decimal real distinto sí falla (caso límite spec 2.45 vs 2.46). | Comparación de strings crudos: frágil al orden/encoding base64. Tolerancia epsilon: aceptaría tasaciones alteradas y violaría "coincide íntegramente". |
| T-08 | `hcsClient` / `topicManager` / `oraclePublisher` / `oracleVerifier` en 4 archivos + `config/oracle.config.js` | Un archivo por responsabilidad (AGENTS.md); permite mock por seam (`submitFn`, `mirrorFetch`, `loadOracleConfig`); el revisor audita pureza de `src/logic/` por grep. | Monolito `hcsOracle.js`: mezcla cliente, topic, publish y verify; imposible testear RF-06 sin red ni RF-02 sin crear topics reales. |
| T-09 | Tests con mocks inyectados + 1 E2E gateado (`RUN_HCS_INTEGRATION=1`), nunca red en CI | RNF-02 + constitution §3: cada RF con test offline; el E2E real (EA canónico 2.45) prueba consenso sin bloquear CI sin credenciales. | Todos los tests contra Testnet: CI frágil, costoso y expone claves. Cero test real: RF-04/RF-06 quedarían sin prueba de consenso (criterio 3 spec). |

## 4. Estrategia de tests (`node --test`, sin frameworks)

Orden TDD (cada paso: rojo → mínimo → verde; `node --test tests/` tras cada paso):

1. **`oracleMessage` (RF-05):** `buildOracleMessage` con BullResult APTO canónico (EA-01 Spec 001: `mTotal 2.45`, `$73,500`/`$24.50`) → objeto contiene `specVersion "001"`, `bullId`, 11 inputs exactos, `verdict.apto true`, `mTotal`, `valuationsUsd`, `publishedAt` pasado, `valuationKey` estable; `canonicalJson` con claves ordenadas (doble build → idéntico string); `apto=false` lanza sin tocar red (anticipa RF-03); `toCanonicalJson` ordena recursivamente; `verifyMessageContent` VERIFIED vs MISMATCH con `mTotal` 2.46.
2. **`topicManager` (RF-01/RF-02):** mock client con `execute/query` espiables. Sin `topicId` → llama `TopicCreate` una vez y devuelve `0.0.x`. Con `topicId` válido y existente → no crea, devuelve el mismo. Con formato inválido → lanza sin red. Con `TopicInfoQuery NOT_FOUND` → lanza "inexistente", no crea paralelo.
3. **`oraclePublisher` (RF-03/RF-04/RF-07/RF-08):** `submitFn` mock que devuelve `{ receipt, sequenceNumber, consensusTimestamp, transactionId }`. `apto=false` → rechaza sin llamar `submitFn` e informa motivos (RF-03). `apto=true` → exactamente 1 llamada y proof con 4 campos (RF-04). Fallo transitorio 1 vez → reintenta y confirma (RF-07); fallo permanente 4 intentos → lanza sin proof y con conteo de intentos (backoff espiable con `baseDelayMs: 1`). Concurrente misma `valuationKey` → segundo llamado falla "en curso" y `submitFn` sigue en 1 (RF-08). `isRetryableError`/`computeBackoffMs` unitarios (retryables vs credenciales/`apto`).
4. **`oracleVerifier` (RF-06, 3 estados):** `mirrorFetch` mock. Mensaje idéntico → `VERIFIED`. Alterado (`dose` 24.51) → `MISMATCH` con diff. Mirror vacío dentro de gracia → `PENDING not-yet-synced`. Mirror caído → `PENDING mirror-unavailable`. Vacío tras gracia → `PENDING not-found-after-grace` (nunca falso negativo).
5. **E2E gateado (criterio 3 spec):** `hcsIntegration.test.js` se salta (`skip`) salvo `RUN_HCS_INTEGRATION=1` + `MY_ACCOUNT_ID`/`MY_PRIVATE_KEY` + `HCS_VALUATIONS_TOPIC_ID` (o permiso de crear). Publica EA-01 real, assert proof de 4 campos, verifica `VERIFIED` vía mirror real con reintento 60 s, e imprime enlaces HashScan. Nunca corre en CI por defecto.
6. **Antirregresión pureza/seguridad:** extender `purity.test.js`: `src/logic/**` sin `hashgraph|process.env|fetch|Date.now|Math.random`; `src/**` sin `forMainnet|mainnet`; `grep` de claves (`MY_PRIVATE_KEY`, `0x...`) en `tests/` y `config/` vacío salvo `.example`.

Todos con `node:test` (`describe/it`) + `node:assert/strict`, CommonJS, sin `npm install` (constitution §1).

## 5. Matriz RF → test (constitution §3: ≥1 test por RF)

| RF | Test(s) | Archivo | Aserción clave |
|----|---------|---------|----------------|
| RF-01 | `crea topic cuando no hay topicId configurado` | `topicManager.test.js` | `TopicCreate` llamado 1 vez; retorna `0.0.x`; `loadOracleConfig` con env vacío → `topicId null` |
| RF-02 | `reutiliza topicId configurado y no crea otro` + `topic inexistente → error sin crear paralelo` | `topicManager.test.js` | `TopicCreate` 0 llamadas; mismo id devuelto; `NOT_FOUND` lanza explícito |
| RF-03 | `apto=false no publica e informa motivos` (más `buildOracleMessage` lanza con `apto=false`) | `oraclePublisher.test.js` + `oracleMessage.test.js` | `submitFn` 0 llamadas; error incluye motivos de Spec 001 |
| RF-04 | `apto=true publica 1 mensaje y devuelve proof de 4 campos` + E2E Testnet EA-01 | `oraclePublisher.test.js` + `hcsIntegration.test.js` (gateado) | `submitFn` 1 llamada; `topicId/sequenceNumber/consensusTimestamp/transactionId` presentes; E2E visible en HashScan |
| RF-05 | `mensaje contiene bullId+11 inputs+mTotal+tasaciones+publishedAt+specVersion 001` + `canonical estable` | `oracleMessage.test.js` | `specVersion==="001"`, `mTotal 2.45`, `{bull:73500, dose:24.5}`; doble build mismo `canonicalJson`/`valuationKey` |
| RF-06 | `VERIFIED idéntico` / `MISMATCH alterado` / `PENDING sin sync` / `PENDING mirror caído` | `oracleVerifier.test.js` (+ E2E verifica mensaje real) | 3 estados; `2.45 vs 2.46` → `MISMATCH`; vacío precoz → `PENDING`, nunca falso negativo |
| RF-07 | `reintenta transitorio y confirma` / `agota 3 reintentos y falla sin proof` / `no reintenta error no-retryable` | `oraclePublisher.test.js` | Intentos 2 / 4 / 1 respectivamente; `computeBackoffMs` exponencial; sin proof al agotar |
| RF-08 | `concurrente misma valuationKey no duplica` / `tras receipt no reenvía` | `oraclePublisher.test.js` | `submitFn` 1 llamada en ambos; segundo concurrente lanza "en curso" |

RNF cubiertos: pureza (antirregresión §4.6), solo-Testnet (grep + `hcsClient` sin `forMainnet`), sin secretos (grep `.env`/claves), verificabilidad pública (E2E + enlaces HashScan), idioma (revisión manual).

## 6. Riesgos y mitigaciones

| # | Riesgo | Impacto | Mitigación en este plan |
|---|--------|---------|--------------------------|
| R-01 | **Duplicado por timeout sin receipt** (reintento reenvía lo ya aceptado) | Topic con 2 mensajes misma tasación; auditoría confusa | `inFlight` + caché de proof + `valuationKey` en mensaje (T-04); verificación detecta repetidos; tests RF-08 |
| R-02 | **Mirror lag → falso negativo** (verificar justo tras publicar) | Auditor declara fraudulenta una tasación real | Estado `PENDING` + gracia 60 s + `retryAfterMs` (T-06); E2E reintenta; tests de los 3 estados |
| R-03 | **`topicId` perdido / cambiado de entorno** (env vacío en otra máquina) | Se crea topic paralelo y el catálogo se fragmenta (D-01 spec) | Fuente única env + `resolve` explícito + error si configurado inexistente (T-01); `.env.example` documenta; E2E usa topic conocido |
| R-04 | **Comparación float rompe VERIFIED** (`24.5` vs `24.50`, orden de claves) | Falsos `MISMATCH` | Canonical JSON + comparación numérica exacta, no string crudo (T-07); test `24.5===24.50` VERIFIED y `2.46` MISMATCH |
| R-05 | **Mensaje supera límite HCS** (futuro: más campos) | `TRANSACTION_OVERSIZE` no-retryable | Supuesto 5 spec: cabe en 1 mensaje; `oracleMessage` copia exacta sin adjuntos; error se propaga sin reintentar; D-02 (hash PDF) queda fuera |
| R-06 | **Credenciales ausentes/inválidas o Mainnet accidental** | Publicación imposible o — peor — operación en Mainnet (constitution §4) | `hcsClient` falla antes de red; `Client.forTestnet()` único; grep antirregresión `forMainnet`; E2E exige `MY_ACCOUNT_ID`/`MY_PRIVATE_KEY` Testnet |
| R-07 | **Fuga de SDK/env/red a `src/logic/`** | Viola constitution §2; tests dejan de ser offline | Builder puro con `publishedAt` por parámetro; test/grep pureza extendido; `src/hedera/` única con red |
| R-08 | **E2E frágil en CI** (sin claves, Testnet caída) | CI rojo por red, no por código | E2E gateado `RUN_HCS_INTEGRATION=1` con `skip` por defecto; CI solo mocks; criterios 3/5 spec se demuestran en corrida manual con HashScan |

## 7. Criterio de listo (para `tasks.md` y `/sdd-validate`)

1. `src/logic/oracleMessage.js`, `src/hedera/{hcsClient,topicManager,oraclePublisher,oracleVerifier}.js`, `config/oracle.config.js` existen, CommonJS, con comentarios en español e identificadores en inglés.
2. `node --test tests/` en verde sin red (mocks): RF-01 a RF-08 con ≥1 test cada uno + 3 estados de RF-06 + `specVersion "001"` + backoff/idempotencia probados.
3. Corrida manual con `RUN_HCS_INTEGRATION=1` publica EA-01 en Testnet, devuelve proof real de 4 campos visible en `hashscan.io/testnet`, y la verificación mirror da `VERIFIED` (lo alterado da `MISMATCH`).
4. `grep` confirma: cero `@hashgraph/sdk`/`process.env`/`fetch` en `src/logic/`; cero `forMainnet`; cero claves en repo/tests/config (solo `.example` ficticio).
5. Veredicto `APROBADO` del revisor y `MEMORY.md` actualizado (fuera de este plan, registrado para `tasks.md`).

## 8. Trazabilidad spec → plan → constitution

| Spec | Este plan | Constitution |
|------|-----------|--------------|
| RF-01/RF-02 (crear vs reutilizar topic) | `topicManager.js` + `oracle.config.js` (T-01), matriz §5 | §4 (sin secretos en repo), §1 stack Hedera |
| RF-03 (veto RECHAZADOS) | `publishValuation` guarda + `buildOracleMessage` lanza (T-05) | §5 (solo registra lo que Spec 001 declaró APTO), §2 separación |
| RF-04/RF-05 (1 mensaje + contenido + 001) | `oracleMessage.js` canónico + `TopicMessageSubmitTransaction` (§2) | §5 fuente PEGBraf, §2 pureza del contenido |
| RF-06 (verificación 3 estados) | `oracleVerifier.js` VERIFIED/MISMATCH/PENDING + mirror REST (T-06/T-07) | §3 (test por RF), §7 hecho verificable |
| RF-07/RF-08 (reintentos + no-duplicar) | `MAX_RETRIES 3` + backoff + `valuationKey`/`inFlight` (T-03/T-04) | §3 política tests, §7 confirmación solo con consenso |
| RNF-01/RNF-02 (capas + `node --test` mocks) | `src/logic/` vs `src/hedera/` + §4 estrategia | §1 tests nativos, §2 separación, §3 TDD |
| RNF-03–RNF-07 (costo, finalidad, claves, Testnet, verificabilidad) | §2.4 (1 msg/tasación, receipt, `.env` nunca commiteado, `forTestnet`, HashScan) | §1 stack, §4 seguridad |
| RNF-08 (idioma) | Español docs/comentarios, inglés código | §6 idioma |
| Fuera de alcance (sin HTS/HSCS, sin DB/API/UI) | No se diseña token ni marketplace; D-01/D-02/D-03 se responden con propuesta inicial spec | §1 stack bloqueado (sin dependencias nuevas) |
