# Tasks — Spec 002 Registro de Oráculo en HCS

> Spec origen APROBADA: `specs/002-registro-oraculo-hcs/spec.md` (RF-01 a RF-08).
> Plan técnico: `specs/002-registro-oraculo-hcs/plan.md` (§§1–8, responde 3 observaciones Reviewer).
> Constitución: `docs/constitution.md` §§1–7.

## Instrucciones para el Implementer (una tarea a la vez, TDD estricto)

1. Ejecutar **exactamente una tarea por sesión** en orden secuencial (Tarea N requiere Tarea N-1 en verde).
2. Ciclo TDD obligatorio por tarea: **test rojo → código mínimo → test verde**.
3. Stack: Node.js CommonJS (`require`/`module.exports`), `node:test` + `node:assert/strict`, sin frameworks, sin `npm install`.
4. Tras cada cambio: `node --test tests/` debe seguir en verde (sin regresiones de Spec 001).
5. Lógica 100% pura en `src/logic/oracleMessage.js`: prohibido `@hashgraph/sdk`, `process.env`, red/`fetch`, `fs`, `Date.now`, `Math.random`. Todo Hedera vive en `src/hedera/` + `config/oracle.config.js`.
6. Tests con **mocks inyectados, sin red** (`submitFn`, `mirrorFetch`, cliente falso). Único test con red: Tarea 7 E2E gateada.
7. No tocar `src/logic/constants.js`, `validator.js`, `pricing.js`, `evaluateBull.js` ni `tokenizarToro.js`.
8. Solo Testnet: prohibido `Client.forMainnet()` / `mainnet`. Nunca commitear `.env` ni claves.
9. Marcar el checkbox `- [x]` solo cuando el criterio "Hecho cuando" se cumpla verificado.

## Cadena de dependencias

```
T1 (config+hcsClient) → T2 (oracleMessage RF-05) → T3 (topicManager RF-01/RF-02)
→ T4 (publisher veto+happy RF-03/RF-04) → T5 (reintentos+idempotencia RF-07/RF-08)
→ T6 (verifier 3 estados RF-06) → T7 (E2E gateado) → T8 (pureza+seguridad+cierre)
```

---

## Tarea 1: Config del oráculo + cliente HCS Testnet (habilitador)
- **RF cubiertos:** Ninguno (habilitador; base para RF-01, RF-04, RF-07)
- **Archivos:** `config/oracle.config.js`, `src/hedera/hcsClient.js`, `tests/oracleConfig.test.js`, `.env.example`
- **Hecho cuando:** `node --test tests/oracleConfig.test.js` pasa en verde Y `Client.forTestnet()` se crea con credenciales válidas y lanza explícito sin ellas, sin tocar red.
- **Depende de:** Nada (primera tarea).
- [x] TDD: crear `config/oracle.config.js` con `loadOracleConfig(env)` que lee solo `HCS_VALUATIONS_TOPIC_ID` (ausente → `topicId: null`), valida formato `0.0.<n>` (malformada → `Error("configuración inválida")`), devuelve `{ topicId, network: 'testnet', maxRetries: 3, baseDelayMs: 1000 }` (plan §1.3–1.4, T-01); crear `src/hedera/hcsClient.js` con `createHcsClient({ accountId, privateKey })` que lanza `Error("credenciales ausentes")` si falta alguno, sino `Client.forTestnet()` + `setOperator` con `PrivateKey.fromStringECDSA` (patrón `tokenizarToro.js`, prohibido `forMainnet`); documentar `HCS_VALUATIONS_TOPIC_ID=0.0.000000` ficticio en `.env.example`; tests con envs falsos (vacío, válido, malformado) y cliente con mock de `Client`/`PrivateKey` o assert de lanzamiento pre-red.

## Tarea 2: Mensaje canónico puro oracleMessage (contenido mínimo + specVersion 001)
- **RF cubiertos:** RF-05
- **Archivos:** `src/logic/oracleMessage.js`, `tests/oracleMessage.test.js`
- **Hecho cuando:** `node --test tests/oracleMessage.test.js` pasa en verde Y el caso EA-01 Spec 001 (`mTotal 2.45`, `$73,500` / `$24.50`) produce `specVersion "001"`, `valuationKey` estable y `canonicalJson` con claves ordenadas.
- **Depende de:** Tarea 1.
- [x] TDD según plan §2.1–2.2: implementar `buildOracleMessage(bullInput, bullResult, meta)` que lanza si `apto !== true` o tasación ausente o `specVersion !== "001"`, construye `{ specVersion: "001", schemaVersion: 1, bullId, inputs (copia exacta 11 campos PEGBraf sin redondeo), verdict: { apto: true }, mTotal, valuationsUsd: { bull, dose }, publishedAt (parámetro, sin `Date.now`), valuationKey = sha256Hex(canonical sin key) }` + `toCanonicalJson` (claves ordenadas recursivas) + `verifyMessageContent` (comparación profunda numérica exacta → `VERIFIED`/`MISMATCH`); tests: contenido mínimo completo EA-01, doble build → idéntico `canonicalJson`/`valuationKey`, `apto=false` lanza (anticipa RF-03), `24.5 vs 24.50` → VERIFIED, `2.45 vs 2.46` → MISMATCH con diff.

## Tarea 3: TopicManager crear vs reutilizar (sin paralelos silenciosos)
- **RF cubiertos:** RF-01, RF-02
- **Archivos:** `src/hedera/topicManager.js`, `tests/topicManager.test.js`
- **Hecho cuando:** `node --test tests/topicManager.test.js` pasa en verde Y `TopicCreate` se llama exactamente 1 vez solo cuando no hay topic configurado, 0 veces al reutilizar.
- **Depende de:** Tarea 2.
- [x] TDD según plan §2.3: implementar `createValuationsTopic(client, { memo })` (`TopicCreateTransaction` → `execute` → `getReceipt` → `topicId string`) y `resolveValuationsTopic(client, configuredTopicId)` que si `null` crea (RF-01), si formato inválido lanza sin red, si `TopicInfoQuery` da `NOT_FOUND` lanza `Error("topic configurado inexistente")` sin crear paralelo (RF-02 + caso límite); tests con cliente mock espiable: sin topicId → crea y devuelve `0.0.x`; con topicId válido existente → devuelve mismo sin crear; formato inválido → lanza; `NOT_FOUND` → lanza explícito.

## Tarea 4: Publisher guarda APTO + publica 1 mensaje con prueba
- **RF cubiertos:** RF-03, RF-04
- **Archivos:** `src/hedera/oraclePublisher.js`, `tests/oraclePublisher.test.js`
- **Hecho cuando:** `node --test tests/oraclePublisher.test.js` pasa en verde Y `apto=false` deja `submitFn` en 0 llamadas y `apto=true` lo deja en exactamente 1 llamada con proof de 4 campos.
- **Depende de:** Tarea 3.
- [x] TDD (primera mitad de `oraclePublisher.js`, plan §2.3 T-04/T-05): implementar `publishValuation(client, topicId, bullInput, bullResult, options)` con `submitFn` inyectable que SI `apto !== true` lanza con motivos sin tocar red (RF-03, usa `buildOracleMessage` que también lanza), SINO construye mensaje canónico (`specVersion "001"`, `publishedAt` por parámetro) y hace exactamente 1 `TopicMessageSubmitTransaction().setTopicId().setMessage(canonicalJson)` devolviendo `{ topicId, sequenceNumber, consensusTimestamp, transactionId }` solo tras receipt (RF-04, RNF-04); tests: RECHAZADO no publica e informa motivos, APTO EA-01 publica 1 vez y proof con 4 campos presentes; usar `baseDelayMs: 1` y `submitFn` mock que resuelve receipt falso (sin red).

## Tarea 5: Publisher reintentos acotados + idempotencia de borde
- **RF cubiertos:** RF-07, RF-08
- **Archivos:** `src/hedera/oraclePublisher.js`, `tests/oraclePublisher.test.js`
- **Hecho cuando:** `node --test tests/oraclePublisher.test.js` pasa en verde Y transitorio confirma en 2 intentos, permanente falla en 4 intentos sin proof, y concurrente misma `valuationKey` deja `submitFn` en 1 llamada.
- **Depende de:** Tarea 4.
- [x] TDD (segunda mitad, plan §1.4 T-03/T-04): implementar `isRetryableError(err)` (retryables: timeout, `UNAVAILABLE`, `TRANSACTION_EXPIRED`, fallo `getReceipt` sin receipt; no-retryables: `INSUFFICIENT_TX_FEE`, credenciales, `apto=false`, topic inexistente) + `computeBackoffMs(attempt, baseDelayMs) = base * 2^attempt + jitter(0..250)` + bucle `0..maxRetries (3)` con espera y `inFlight[valuationKey]` + caché de proof (si receipt previo → devuelve prueba original sin reenviar; si concurrente en curso → lanza "en curso"); tests: 1 fallo transitorio → reintenta y confirma; fallo permanente → 4 intentos y lanza sin proof; error no-retryable → 1 intento; concurrente misma tasación → segundo lanza y `submitFn` sigue en 1; unitarios de `isRetryableError` y `computeBackoffMs` exponencial.

## Tarea 6: Verifier mirror REST con 3 estados (sin falsos negativos)
- **RF cubiertos:** RF-06
- **Archivos:** `src/hedera/oracleVerifier.js`, `tests/oracleVerifier.test.js`
- **Hecho cuando:** `node --test tests/oracleVerifier.test.js` pasa en verde Y los 5 casos devuelven `VERIFIED` / `MISMATCH` / `PENDING not-yet-synced` / `PENDING mirror-unavailable` / `PENDING not-found-after-grace`, nunca `NOT_FOUND` definitivo.
- **Depende de:** Tarea 5.
- [x] TDD según plan §1.5/§2.3 T-06/T-07: implementar `verifyValuation(proof, expectedMessage, { mirrorFetch, gracePeriodMs: 60000 })` que consulta `GET testnet.mirrornode.hedera.com/api/v1/topics/{topicId}/messages?sequenceNumber={n}` (o por `transactionId`, `fetch` con timeout 10 s, decodifica `contents` base64→utf8) y devuelve `VERIFIED` (canónico idéntico incl. `mTotal`/tasaciones), `MISMATCH` con `reason`+diff (`spec-version`, decimal alterado), o `PENDING` con `retryAfterMs` si vacío en gracia (`not-yet-synced`), mirror caído (`mirror-unavailable`), o vacío tras gracia (`not-found-after-grace`); tests con `mirrorFetch` mock: idéntico → VERIFIED, `dose 24.51` → MISMATCH, vacío precoz → PENDING, throw transitorio → PENDING, vacío tras gracia → PENDING (no falso negativo); exige `specVersion === "001"`.

## Tarea 7: E2E Testnet gateado (único test con red, fuera de CI)
- **RF cubiertos:** RF-04, RF-06
- **Archivos:** `tests/hcsIntegration.test.js`
- **Hecho cuando:** Con `RUN_HCS_INTEGRATION=1` publica el EA-01 real en Testnet y devuelve proof de 4 campos visible en `hashscan.io/testnet` Y verificación mirror da `VERIFIED`; sin la variable se salta (`skip`) y `node --test tests/` sigue en verde sin red.
- **Depende de:** Tarea 6.
- [x] Crear `tests/hcsIntegration.test.js` gateado (`skip` salvo `RUN_HCS_INTEGRATION=1` + `MY_ACCOUNT_ID`/`MY_PRIVATE_KEY` + `HCS_VALUATIONS_TOPIC_ID` o permiso de crear): publica EA-01 canónico (`M_TOTAL 2.45`, `$73,500`/`$24.50`) vía `publishValuation` real, assert proof `{ topicId, sequenceNumber, consensusTimestamp, transactionId }`, reintenta `verifyValuation` con mirror real hasta 60 s hasta `VERIFIED`, imprime enlaces HashScan topic/tx, y verifica que lo alterado da `MISMATCH`; nunca corre en CI por defecto (plan §4.5, R-08).

## Tarea 8: Antirregresión pureza/seguridad + cierre y verificación total
- **RF cubiertos:** RNF-01, RNF-05, RNF-06 (antirregresión; verifica RF-01 a RF-08)
- **Archivos:** `tests/purity.test.js`, `tests/` (solo verificación, sin cambios en `src/logic/` salvo lo necesario)
- **Hecho cuando:** `node --test tests/` pasa 100% en verde sin red Y los greps de pureza/seguridad devuelven vacío.
- **Depende de:** Tarea 7.
- [x] Extender/crear `tests/purity.test.js` que lee cada archivo de `src/logic/` y falla si contiene `hashgraph`, `process.env`, `fetch(`, `Date.now` o `Math.random` (constitution §2, plan §4.6 T-07/R-07), más asserts de `src/**` sin `forMainnet`/`mainnet` y de `tests/`+`config/` sin claves (`MY_PRIVATE_KEY`, `0x…`) salvo `.example` ficticio; correr `node --test tests/` completo en verde como criterio de finalización (listo para `/sdd-validate` + `MEMORY.md`).

## Matriz final de cobertura (verificación del revisor)

| RF | Tarea | Archivo de test |
|----|-------|-----------------|
| RF-01 | T3 | `tests/topicManager.test.js` (+ `tests/oracleConfig.test.js` habilitador) |
| RF-02 | T3 | `tests/topicManager.test.js` |
| RF-03 | T4 (+ T2 lanza en builder) | `tests/oraclePublisher.test.js` + `tests/oracleMessage.test.js` |
| RF-04 | T4 + T7 E2E | `tests/oraclePublisher.test.js` + `tests/hcsIntegration.test.js` |
| RF-05 | T2 | `tests/oracleMessage.test.js` |
| RF-06 | T6 + T7 E2E | `tests/oracleVerifier.test.js` + `tests/hcsIntegration.test.js` |
| RF-07 | T5 | `tests/oraclePublisher.test.js` |
| RF-08 | T5 | `tests/oraclePublisher.test.js` |
| RNF-01/RNF-05/RNF-06 | T8 | `tests/purity.test.js` |
| EA-01 (2.45 → $73,500 / $24.50) | T2 + T4 + T7 | `tests/oracleMessage.test.js` + `tests/oraclePublisher.test.js` + `tests/hcsIntegration.test.js` |
