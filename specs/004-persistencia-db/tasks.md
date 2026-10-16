# Tasks — Spec 004 Persistencia Espejo en Supabase (Off-Chain) Verificable

> Spec origen: `specs/004-persistencia-db/spec.md` (APROBADA, RF-01 a RF-08). Plan origen: `specs/004-persistencia-db/plan.md` (APROBADO).
> Aprobaciones ya dadas: motor Supabase fijado y dependencia `@supabase/supabase-js` APROBADA por el usuario el 2026-10-16 (registrada en `MEMORY.md`, presente en `package.json ^2.118.0`). No se aprueba nada nuevo aquí.
> Método: TDD estricto (test rojo → código mínimo → test verde). Orden secuencial: cada tarea deja `node --test tests/` en verde sin red ni credenciales, salvo la Tarea 8 (E2E gateada, con `skip` por defecto).
> Convenciones: CommonJS, comentarios en español, identificadores en inglés camelCase. Sin Mainnet. Sin secretos en repo/tests/logs.

## Tarea 1: Dependencia aprobada + configuración server-side Supabase
- **RF cubiertos:** Transversal (base de RF-01 a RF-08, D-01)
- **Archivos:** `config/supabase.config.js`, `.env.example`, `tests/supabaseConfig.test.js`
- **Hecho cuando:** `node --test tests/supabaseConfig.test.js` pasa en verde Y `node --test tests/` sigue en verde sin red ni credenciales Y `.env.example` solo contiene placeholders ficticios de Supabase.
- **Depende de:** Nada (primera).
- [x] Verificar que `@supabase/supabase-js` ya consta instalada y aprobada (consta en `package.json ^2.118.0` y `MEMORY.md` 2026-10-16): no instalar nada nuevo salvo reinstalación idéntica si faltara en disco, sin añadir dependencias nuevas.
- [x] Redactar primero el test rojo de `config/supabase.config.js`: recibe `env` por parámetro, exige `SUPABASE_URL` https y clave según rol, distingue `envLabel: "test"`, lanza sin URL/clave, nunca lee secretos del repo.
- [x] Implementar lo mínimo para verde y ampliar `.env.example` con `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` usando solo placeholders ficticios (sin URLs reales, sin claves reales, sin `0x…` ni PEM).

## Tarea 2: Reglas puras de toro y valuación idempotente
- **RF cubiertos:** RF-01, RF-02
- **Archivos:** `src/logic/mirrorRules.js`, `tests/mirrorRules.test.js`
- **Hecho cuando:** `node --test tests/mirrorRules.test.js` pasa en verde Y reintentar la misma `valuationKey` devuelve el registro original con mismo `mTotal`/precios sin duplicar.
- **Depende de:** Tarea 1.
- [x] Redactar primero los tests rojos en `tests/mirrorRules.test.js` para construir el registro de toro con sus 11 inputs PEGBraf más veredicto y el registro de valuación con `valuationKey` estable y `specVersion "001"`, el caso sin existente como inserción, el reintento idéntico como devolución del original y la misma clave con input distinto (p. ej. CE 1.5 vs 1.6) como rechazo, más `specVersion "002"` como lanzamiento (D-02).
- [x] Implementar lo mínimo en `src/logic/mirrorRules.js` (puro: sin SDK, sin `process.env`, sin red) para verde, reutilizando la clave determinista del oráculo existente sin duplicar su lógica.

## Tarea 3: Reglas puras de proof, veto de inválido y actualización solo-desde-verdad
- **RF cubiertos:** RF-03, RF-04, RF-08
- **Archivos:** `src/logic/mirrorRules.js`, `tests/mirrorRules.test.js`
- **Hecho cuando:** `node --test tests/mirrorRules.test.js` pasa en verde Y ningún registro con proof `MISMATCH` o `PENDING` se presenta como `VERIFIED` ni habilita listado/compra.
- **Depende de:** Tarea 2.
- [x] Redactar primero los tests rojos de decisión de proof (conserva `topicId`, `sequenceNumber`, `consensusTimestamp`, `transactionId` y estado ligado a `valuationKey`), del caso `mTotal` 2.45 vs 2.46 reclamado como `MISMATCH` forzado, del bloqueo de listado/compra ante `MISMATCH`/`PENDING` y de la transición solo `PENDING → VERIFIED|MISMATCH` con prueba de verdad que conserva `proof`, `valuationKey` y `txIds` originales.
- [x] Implementar lo mínimo en `src/logic/mirrorRules.js` para verde: el espejo nunca declara válido lo ajeno, la historia certificada es inmutable y la autopromoción sin prueba lanza.

## Tarea 4: Reglas puras de movimientos, idempotencia de compra y vista pública
- **RF cubiertos:** RF-05, RF-06, RF-07
- **Archivos:** `src/logic/mirrorRules.js`, `tests/mirrorRules.test.js`
- **Hecho cuando:** `node --test tests/mirrorRules.test.js` pasa en verde Y el mismo `purchaseId` reintentado devuelve el original sin reacreditar ni crear segunda liquidación, con regalías 0% y 100% reflejadas tal cual.
- **Depende de:** Tarea 3.
- [x] Redactar primero los tests rojos de decisión de listado/compra/liquidación (reflejan `listingId`, `purchaseId`, `royaltyPct`, splits criador/vendedor y `txIds` ligados a `valuationKey`), del mismo `purchaseId` idéntico como devolución del original, del segundo settle del mismo `purchaseId` como lanzamiento de doble liquidación, del `purchaseId` reutilizado con importes distintos como lanzamiento y de la vista pública que adjunta referencia Testnet o ausencia explícita.
- [x] Implementar lo mínimo en `src/logic/mirrorRules.js` para verde, espejando los splits ya calculados por el marketplace sin recalcularlos.

## Tarea 5: Cliente Supabase y repos de toros y valuaciones con mock sin red
- **RF cubiertos:** RF-01, RF-02, RF-07
- **Archivos:** `src/db/supabaseClient.js`, `src/db/bullsRepo.js`, `src/db/valuationsRepo.js`, `tests/dbRepos.test.js`
- **Hecho cuando:** `node --test tests/dbRepos.test.js` pasa en verde Y cada guardado hace un solo upsert con la clave de conflicto correcta y sin tocar red real.
- **Depende de:** Tarea 2, Tarea 4.
- [x] Redactar primero los tests rojos con cliente Supabase mock inyectado (doble en memoria con `from`, `upsert`, `select` y `eq`, sin red ni credenciales): factory que lanza sin URL/clave antes de red y acepta SDK inyectado, `saveBull`/`getBull` con un upsert por `bullId`, `saveValuation`/`getValuation` idempotente por `valuationKey` con convergencia ante conflicto y lectura que devuelve vista pública.
- [x] Implementar lo mínimo en `src/db/` para verde: validación pura antes de red, escritura atómica por clave natural y `service_role` solo server-side.

## Tarea 6: Repos de proofs y marketplace con mock sin red, veto sin escritura
- **RF cubiertos:** RF-03, RF-04, RF-05, RF-06, RF-08
- **Archivos:** `src/db/proofsRepo.js`, `src/db/listingsRepo.js`, `tests/dbRepos.test.js`
- **Hecho cuando:** `node --test tests/dbRepos.test.js` pasa en verde Y guardar un listado con proof distinta de `VERIFIED` produce cero llamadas de escritura al mock.
- **Depende de:** Tarea 5.
- [x] Redactar primero los tests rojos con mock inyectado: `saveProof`/`getProof`/`updateProofStatus` (solo `PENDING → VERIFIED|MISMATCH` con veredicto inyectado, nunca autopromoción), `saveListing` bloqueado sin escritura ante `MISMATCH`/`PENDING`, `savePurchase` idempotente por `purchaseId`, `settlePurchase` sin segunda liquidación, y error 42501 de escritura con `anon` propagado como denegación.
- [x] Implementar lo mínimo en `src/db/proofsRepo.js` y `src/db/listingsRepo.js` para verde, exigiendo el veredicto del verificador existente y el estado `VERIFIED` vigente antes de cualquier escritura de movimiento.

## Tarea 7: Consultas públicas verificables sin credenciales
- **RF cubiertos:** RF-07 (cubre RF-01 a RF-06 como lectura), RF-08
- **Archivos:** `src/db/bullsRepo.js`, `src/db/valuationsRepo.js`, `src/db/proofsRepo.js`, `src/db/listingsRepo.js`, `tests/dbRepos.test.js`
- **Hecho cuando:** `node --test tests/dbRepos.test.js` pasa en verde Y toda consulta por toro, `valuationKey`, `listingId`, `purchaseId` o estado devuelve su referencia verificable Testnet o ausencia explícita sin llamada on-chain obligatoria.
- **Depende de:** Tarea 5, Tarea 6.
- [x] Redactar primero los tests rojos de lectura con rol `anon` sobre el mock: búsqueda por toro, por `valuationKey`, por `listingId`/`purchaseId` y por estado de verificación, cada resultado con referencia mirror/HashScan Testnet cuando existe y con ausencia explícita más marca de no verificado cuando aún no existe.
- [x] Implementar lo mínimo en los repos para verde: lecturas por clave con adjunto de referencia construida (no consultada) y sin exigir credenciales de operador.

## Tarea 8: E2E gateada contra proyecto Supabase de test (única con red)
- **RF cubiertos:** RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08
- **Archivos:** `tests/supabaseIntegration.test.js`
- **Hecho cuando:** `node --test tests/` pasa en verde sin credenciales (E2E salta con `skip`) Y con `RUN_SUPABASE_INTEGRATION=1` más claves de test ejecuta el flujo punta a punta contra el proyecto de test.
- **Depende de:** Tarea 7.
- [x] Redactar el test E2E con salto por defecto salvo `RUN_SUPABASE_INTEGRATION=1` más `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (más credenciales Testnet solo para la proof `VERIFIED` real vía el verificador existente): guarda toro más valuación, reintenta misma `valuationKey` con conteo de filas igual a 1, guarda proof `PENDING`, verifica bloqueo de listado con `PENDING`, promueve a `VERIFIED` vía mirror real conservando historia, guarda listado/compra/liquidación, reintenta `purchaseId` sin duplicado ni reacreditación y consulta por cada clave devolviendo referencia HashScan Testnet.
- [x] Ajustar lo mínimo de los repos solo si la E2E revela divergencia con el mock, sin romper el verde local sin red.

## Tarea 9: Pureza, seguridad y cierre de la spec
- **RF cubiertos:** Transversal (RNF-01 a RNF-06, D-01, D-02; matriz RF-01 a RF-08)
- **Archivos:** `tests/purity.test.js`, `specs/004-persistencia-db/tasks.md`, `MEMORY.md`
- **Hecho cuando:** `node --test tests/` pasa en verde al 100% sin red Y la revisión estática confirma cero fugas y cero Mainnet Y `MEMORY.md` queda actualizado.
- **Depende de:** Tarea 8.
- [x] Extender los tests de pureza/seguridad: nada de SDK de Supabase/Hedera, `process.env`, red, tiempo aleatorio ni azar en `src/logic/`; nada de Mainnet en `src/` ni `config/`; nada de claves Supabase/Hedera ni Account IDs reales en repo/tests/logs; `.env` no trackeado; `.env.example` con placeholders ficticios; matriz que exige al menos un test por cada RF-01 a RF-08 más D-01 y D-02.
- [x] Marcar cada checkbox de este `tasks.md` según su estado real, correr la suite completa en verde y actualizar `MEMORY.md` (estado 004, dependencia usada con aprobación 2026-10-16, conteo de tests y veredicto pendiente de `/sdd-validate`).
