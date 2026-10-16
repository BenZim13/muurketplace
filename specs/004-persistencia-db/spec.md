# Spec 004 — Persistencia Espejo en Supabase (Off-Chain) Verificable

## Resumen

Esta especificación define **el QUÉ y el POR QUÉ** de la persistencia espejo off-chain de Muurketplace en **Supabase (Postgres hosted)**: un espejo consultable de lo que ya decidió la cadena y el motor, nunca una fuente de verdad nueva. La cadena (HCS/HSCS verificable en mirror/HashScan) sigue siendo la única fuente de verdad; Supabase solo recuerda y acelera la consulta.

Es la **capa de memoria** del ecosistema. No valida ni tasa (eso es Spec 001, APROBADA), no certifica en HCS (eso es Spec 002, APROBADA), no lista ni liquida en HSCS (eso es Spec 003, APROBADA), no mintea tokens (eso ya existe en `tokenizarToro.js` vía HTS). Solo recuerda en Supabase: *este toro se evaluó así, se certificó con esta proof, se listó y se vendió así, y todo es verificable contra mirror/HashScan*.

## Contexto y problema (Background)

Muurketplace tiene el backend completo y APROBADO (001+002+003, 233 tests verdes):

- 001: `evaluateBull` puro → `{ apto, motivos, mTotal, tasaciones }` desde 11 inputs PEGBraf.
- 002: oráculo HCS con mensaje canónico y proof `{ topicId, sequenceNumber, consensusTimestamp, transactionId }`, estados `VERIFIED` / `MISMATCH` / `PENDING`.
- 003: marketplace puro + `Muurketplace.sol` + cliente, con caso canónico EA-01 (245 / 12.25 / 232.75).

Pero hoy **no hay base de datos**: AGENTS.md no lista ninguna, y cada valuación, proof, listado, compra y liquidación vive solo en memoria de proceso o en la cadena. Sin persistencia no se puede responder *¿qué toros evalué?*, *¿qué valuación corresponde a esta proof?*, *¿qué compras pagaron esta regalía?* sin re-consultar la red cada vez, y no hay idempotencia ante reintentos (doble clic, reintento de red, reinicio del proceso).

Esta spec cierra esa brecha con una persistencia espejo **en Supabase**: guarda Bulls (11 inputs PEGBraf), valuations (`mTotal`, precios, `specVersion` 001, `valuationKey`), proofs HCS + estado de verificación, y listings / purchases / settlements (`listingId`, `purchaseId`, `royaltyPct`, splits, `txIds`). Todo registro espejo conserva su referencia verificable (mirror / HashScan) y la cadena sigue siendo la única fuente de verdad. Por decisión vinculante del usuario, el motor es Supabase (Postgres hosted); quedan descartados SQLite, fichero JSON y memoria como motores de esta spec.

Fuente de verdad biológica: Sumario de Padres PEGBraf, vía skill `ganaderia-pricing-engine` (`parametros_de_toro_lider`) y `docs/constitution.md` §5. Esta spec no redefine ningún umbral, multiplicador ni valor base.

## Objetivos

1. Dar **memoria consultable** en Supabase al backend: Bulls evaluados, valuaciones, proofs con su estado, listados, compras y liquidaciones, sin volver a pedir todo a la red.
2. Garantizar **idempotencia** en Supabase ante reintentos: la misma `valuationKey` o el mismo `purchaseId` no crea duplicados ni doble acredita.
3. Garantizar que el espejo **nunca contradiga a la cadena**: todo dato persistido conserva su referencia verificable y se declara espejo, no verdad.
4. Hacerlo con **CRUD mínimo y consultas públicas** (sin autenticación de usuarios) sobre Supabase, testeable con dobles sin red ni secretos más una E2E gateada.

## Alcance

### Dentro del alcance

- Persistencia espejo en Supabase de **Bulls**: los 11 inputs PEGBraf que alimentaron `evaluateBull`, con su veredicto `apto` y `motivos` asociados.
- Persistencia espejo en Supabase de **valuations**: `mTotal`, precios de toro y dosis, `specVersion` (001) y `valuationKey` como clave de idempotencia.
- Persistencia espejo en Supabase de **proofs HCS**: `topicId`, `sequenceNumber`, `consensusTimestamp`, `transactionId` y estado de verificación (`VERIFIED` / `MISMATCH` / `PENDING`).
- Persistencia espejo en Supabase de **listings / purchases / settlements**: `listingId`, `purchaseId`, `royaltyPct`, splits (parte criador / parte vendedor), `txIds` de compra y de liquidación.
- **Idempotencia** en Supabase por `valuationKey` (valuación) y por `purchaseId` (compra/liquidación): reintentos con la misma clave devuelven el registro existente sin duplicar ni reacreditar.
- **CRUD mínimo** en Supabase: crear, leer, actualizar estado de verificación/liquidación, eliminar o invalidar solo cuando la cadena lo invalida (nunca borrado silencioso de verdad certificada).
- **Consultas públicas** sobre Supabase: buscar por toro, por `valuationKey`, por `listingId` / `purchaseId`, por estado de verificación; toda consulta devuelve además la referencia verificable (mirror / HashScan).

### Fuera de alcance (NO implementable en esta spec)

- Motor de validación biológica y tasación (umbrales, multiplicadores aditivos, `M_TOTAL`, bases `$30,000` / `$10`, redondeo) → propiedad exclusiva de la Spec 001.
- Formato del mensaje de oráculo HCS, topics, publicación y verificación criptográfica contra mirror → propiedad exclusiva de la Spec 002.
- Listado, compra, split de regalías y contrato `Muurketplace.sol` → propiedad exclusiva de la Spec 003.
- Minteo, creación o configuración de tokens HTS (`PAJ-BRAF`, `BULL`, decimales, supplies, claves Admin/Treasury) → ya existe en `tokenizarToro.js`, no se reimplementa aquí.
- Ajuste de umbrales o valores base sin respaldo documental PEGBraf (prohibido por constitution §5).
- Frontend, API HTTP con autenticación de usuarios, fiat on/off-ramp, KYC, pasarelas de pago.
- Mainnet, migraciones de datos históricos externos, sincronización multi-nodo o replicación distribuida.
- Cualquier motor distinto de Supabase (SQLite, fichero JSON, memoria con snapshot) como persistencia de esta spec: descartados por decisión vinculante del usuario.

## Actores del sistema

| Actor | Rol | Interacción con esta persistencia |
|-------|-----|-----------------------------------|
| Operador Muurketplace | Registra evaluaciones y movimientos | Guarda Bulls, valuations, proofs, listings, purchases y settlements; reintenta sin crear duplicados |
| Auditor / público | Verifica sin credenciales | Consulta por toro, `valuationKey`, `listingId` / `purchaseId` o estado, y contrasta contra mirror / HashScan |
| Backend 001/002/003 (sistema) | Origen de los datos espejados | Aporta el veredicto + tasación (001), la proof + estado (002) y el split + `txIds` (003); la persistencia solo los refleja |
| Red Hedera Testnet (mirror / HashScan) | Fuente de verdad | Es lo único que puede confirmar o desmentir un registro espejo; el espejo nunca la sustituye |

## Historias de usuario

- **HU-01 — Memoria de valuación:** Como operador, quiero guardar la valuación de un toro con su `valuationKey` para no reevaluar ni recertificar si el proceso se reinicia.
- **HU-02 — Reintento seguro:** Como operador, quiero reintentar una compra o una valuación con la misma clave y obtener el mismo registro, para no duplicar ni pagar doble ante un fallo de red.
- **HU-03 — Auditoría sin claves:** Como auditor, quiero consultar por `purchaseId` o `valuationKey` y ver la referencia a mirror/HashScan, para verificar por mi cuenta sin credenciales del operador.
- **HU-04 — Estado honesto:** Como auditor, quiero que un registro con proof `MISMATCH` o `PENDING` se muestre como tal y nunca como verificado, para no confiar en un espejo inválido.
- **HU-05 — Trazabilidad completa:** Como criador, quiero ver en un solo lugar el toro, su valuación, su proof, su listado y sus liquidaciones, para probar de punta a punta que mi regalía nació de una tasación real.

## Requisitos Funcionales (notación EARS)

### Invariante transversal (aplica a todos los RF)

La cadena (HCS/HSCS verificable en mirror/HashScan) es la única fuente de verdad. La persistencia es solo espejo en Supabase: conserva siempre la referencia verificable y nunca declara válido lo que la cadena no confirma. Toda persistencia de RF-01 a RF-08 vive en Supabase con idempotencia por clave (upsert sin duplicados por `valuationKey` / `purchaseId`) y consultas verificables contra mirror/HashScan.

- **RF-01 — Guardar toro evaluado:** `CUANDO el operador registre un toro ya evaluado por el motor, EL SISTEMA guardará en Supabase sus 11 inputs PEGBraf junto a su veredicto (apto, motivos, mTotal y tasaciones) y devolverá su identificador con su valuationKey asociada.`
- **RF-02 — Guardar valuación idempotente:** `SI existe ya en Supabase una valuación con la misma valuationKey (mismo toro, mismos inputs, misma specVersion 001), ENTONCES EL SISTEMA devolverá la valuación existente con su mTotal y precios sin crear un registro duplicado ni alterar el original.`
- **RF-03 — Guardar proof y estado de verificación:** `CUANDO se registre la certificación HCS de una valuación, EL SISTEMA guardará en Supabase su proof (topicId, sequenceNumber, consensusTimestamp, transactionId) junto a su estado VERIFIED, MISMATCH o PENDING, ligado a su valuationKey.`
- **RF-04 — Rechazo de espejo inválido como válido:** `SI la proof asociada en Supabase está en estado MISMATCH o PENDING, o su contenido no coincide con la valuación reclamada, ENTONCES EL SISTEMA la conservará marcada como no verificada y nunca la presentará como VERIFIED ni permitirá que habilite listados o compras.`
- **RF-05 — Guardar movimientos del marketplace:** `CUANDO se complete un listado, compra o liquidación ya ejecutado en el marketplace, EL SISTEMA guardará en Supabase su listingId, purchaseId, royaltyPct, splits (parte criador y parte vendedor) y txIds, ligados a la valuationKey de origen.`
- **RF-06 — Idempotencia de compra y liquidación:** `SI se registra dos veces en Supabase el mismo purchaseId (reintento de compra o de liquidación), ENTONCES EL SISTEMA devolverá el registro original sin duplicar la compra ni reacreditar la regalía ni crear una segunda liquidación del mismo saldo.`
- **RF-07 — Consultas públicas verificables:** `EL SISTEMA permitirá consultar en Supabase sin credenciales por toro, por valuationKey, por listingId o purchaseId y por estado de verificación, devolviendo en cada resultado su referencia verificable contra mirror o HashScan.`
- **RF-08 — Actualización solo desde la verdad:** `CUANDO la cadena confirme un cambio de estado (una proof PENDING pase a VERIFIED o MISMATCH, una regalía pase a liquidada), EL SISTEMA actualizará en Supabase el estado del registro espejo correspondiente sin reescribir su historia (conserva proof, valuationKey y txIds originales).`

## Requisitos No Funcionales

- **RNF-01 — Separación de capas:** la lógica de espejo e idempotencia vivirá en `src/logic/` pura, sin importar SDK de Supabase ni SDK de Hedera y sin acceder a red, `.env` ni secretos; el acceso a Supabase vivirá en una capa de infraestructura separada `src/db/` (o `src/infra/`) distinta de `src/logic/` y de `src/hedera/` (constitution §2).
- **RNF-02 — Tests nativos con dobles + 1 E2E gateada:** cada RF tendrá al menos un test ejecutable con `node --test tests/` sin frameworks externos (constitution §1 y §3); los tests usarán mocks o dobles de Supabase (sin red, sin credenciales) más un proyecto Supabase de test solo para la E2E gateada, que no bloquea el verde local si no hay credenciales/red.
- **RNF-03 — Sin secretos ni Mainnet:** ningún test, registro o log contendrá claves privadas, claves de Supabase (`anon`/`service_role`), `SUPABASE_URL`, Account IDs reales ni contenido de `.env`; todas las referencias on-chain apuntarán exclusivamente a Testnet y cualquier uso de Mainnet requiere aprobación explícita previa (constitution §4).
- **RNF-04 — Espejo rápido y acotado:** las consultas por clave (`valuationKey`, `purchaseId`, `listingId`) responderán contra Supabase sin llamada on-chain obligatoria y la escritura idempotente no degradará el costo on-chain (cero transacciones extra por persistir).
- **RNF-05 — Integridad del espejo:** un reintento con la misma clave nunca duplicará registros ni reacreditará importes; un estado `VERIFIED` nunca nacerá de una proof `MISMATCH`/`PENDING`.
- **RNF-06 — Idioma:** documentación y comentarios en español; identificadores de código en inglés camelCase (constitution §6).
- **RNF-07 — Dependencia nueva pendiente de aprobación:** la librería `@supabase/supabase-js` (única dependencia nueva que esta spec admite) requiere aprobación explícita antes de instalarse y usarse; queda registrada como **pendiente de aprobación** (constitution §1). Sin esa aprobación no se instala ni se importa.

## Supuestos

1. Las Specs 001, 002 y 003 están APROBADAS y son la única definición de *qué* se persiste; esta spec no recalcula `mTotal`, no redefine proofs ni reimplementa splits.
2. Cada valuación trae una `valuationKey` determinista (mismo toro + mismos inputs + `specVersion` 001 ⇒ misma clave) generada fuera de esta spec; cada compra trae un `purchaseId` único del marketplace.
3. La verificación contra mirror / HashScan puede tener retardo de sincronización de segundos; un estado `PENDING` no es un fallo, es espera (coherente con Spec 002).
4. La persistencia vive en Supabase (Postgres hosted) y por tanto **necesita red** hacia Supabase; no es local sin red. Sigue siendo de un solo proyecto/espejo en esta spec; no hay replicación ni multi-escritor distribuido que resolver aquí.
5. Los importes espejados respetan las reglas ya APROBADAS: base toro `$30,000 × M_TOTAL`, base dosis `$10 × M_TOTAL` half-up a 2 decimales, `PAJ-BRAF` enteros (0 decimales), `BULL` hasta 4 decimales con supply 10.
6. El acceso a Supabase requiere `SUPABASE_URL` + clave (`anon` o `service_role` según entorno) **solo server-side en `.env`**: nunca se commitea el `.env`, nunca se exponen las claves en cliente/frontend ni en logs/tests, y en esta fase todo apunta solo a Testnet on-chain. La dependencia `@supabase/supabase-js` queda registrada como **pendiente de aprobación explícita** (constitution §1); sin esa aprobación no se instala.

## Casos límite

- Misma `valuationKey` registrada dos veces con inputs idénticos → se devuelve el original, sin duplicado (RF-02).
- Misma `valuationKey` con algún input distinto (ej. CE 1.5 vs 1.6) → no colisiona: es otra valuación u otro toro, se rechaza como idempotente y se registra aparte.
- Mismo `purchaseId` liquidado dos veces → segundo intento devuelve la liquidación original sin doble pago (RF-06).
- Proof `PENDING` consultada → se muestra como pendiente con su referencia, nunca como verificada (RF-04).
- Proof `MISMATCH` (ej. `mTotal` 2.45 vs 2.46 reclamado) → se conserva marcada como inválida; no habilita listado ni compra (RF-04).
- Registro sin `txId` ni referencia mirror/HashScan (ej. valuación aún no certificada) → se guarda como no verificado, con ausencia explícita de referencia, nunca con referencia inventada.
- Reinicio del proceso entre valuación y certificación → al reanudar con la misma `valuationKey` se recupera el registro, no se pierde ni se duplica.
- Regalía del 0% o del 100% → se persiste tal cual con splits explícitos (`$0` al criador o `$0` al vendedor), sin normalizar ni omitir.
- Caída total de Testnet durante la verificación → el espejo conserva `PENDING` y no inventa un veredicto local.
- Supabase no disponible (sin red o sin credenciales) → la operación de espejo no inventa datos ni confirma estados; conserva el pendiente y lo reintenta con la misma clave sin duplicar.

## Criterios de finalización (criterios de aceptación verificables)

1. Existe `specs/004-persistencia-db/spec.md` con motor fijado a Supabase, los RF-01 a RF-08 en notación EARS, alcance espejo (dentro/fuera) y trazabilidad a constitution.
2. Cada RF-01 a RF-08 tiene al menos un test en `tests/` ejecutable con `node --test tests/` en verde, usando dobles/mocks de Supabase sin requerir red, credenciales ni secretos; la E2E contra proyecto Supabase de test es gateada y no bloquea el verde local.
3. Reintentar la misma `valuationKey` devuelve el registro original sin duplicados; reintentar el mismo `purchaseId` no reacredita ni duplica la liquidación (verificable por conteo de registros e importes idénticos).
4. Un registro con proof `MISMATCH` o `PENDING` nunca se presenta como `VERIFIED` ni habilita listado/compra en las consultas (verificable por consulta de estado).
5. Toda consulta por `valuationKey`, `listingId` o `purchaseId` devuelve su referencia verificable (mirror / HashScan Testnet) cuando existe, y ausencia explícita cuando aún no existe.
6. Ningún archivo de `src/logic/` importa SDK de Supabase/Hedera ni accede a `.env`, red o claves; ninguna clave privada, clave de Supabase, `SUPABASE_URL` ni Account ID real aparece en el repo, logs o tests.
7. Ninguna operación apunta a Mainnet y la dependencia `@supabase/supabase-js` no se instaló sin aprobación explícita documentada.
8. Veredicto `APROBADO` del revisor SDD (`/sdd-validate`) y `MEMORY.md` actualizado.

## Dudas abiertas

- **D-01:** ¿Cómo se organiza el espejo en Supabase (proyecto y entorno de test vs productivo, organización del esquema, gitignore y ciclo de vida de credenciales por entorno/operador)? (Propuesta: definirlo en el plan sin cambiar esta spec; la spec solo exige que las claves vivan solo server-side en `.env`, nunca en cliente/frontend ni en el repo.)
- **D-02:** ¿Se versionan o migran registros en Supabase si `specVersion` deja de ser 001 (ej. nuevo motor 005)? (Propuesta inicial: `valuationKey` incluye `specVersion`, así que una spec nueva genera claves nuevas y los registros 001 quedan inmutables como historia; confirmar en el plan si aplica algún mecanismo de Supabase.)

## Trazabilidad a constitution

| Requisito | Principio constitution |
|-----------|------------------------|
| Alcance espejo en Supabase (nunca fuente de verdad; §5 intacto, sin redefinir umbrales) + RF-01, RF-03, RF-04 | §5 Fuente de verdad biológica (solo refleja lo que 001 decidió con respaldo PEGBraf y 002 certificó) |
| RNF-01 (lógica pura en `src/logic/` sin SDK; infra Supabase en `src/db/` o `src/infra/` separada de `src/hedera/`) | §2 Separación de lógica e infraestructura |
| RF-02 a RF-08 + RNF-02, Criterios 2/3/4 | §3 Política de tests (1 test por RF, TDD; dobles sin red + 1 E2E gateada) |
| RNF-03, Supuesto 6, Criterios 6/7 | §4 Protección de datos y seguridad (`.env` server-side nunca commiteado, claves Supabase `anon`/`service_role` nunca en cliente/frontend/logs/tests, nunca Mainnet sin aprobación; Admin/Treasury ya exigidas al crear los tokens) |
| RNF-06 | §6 Idioma (español docs, inglés código) |
| Criterios de finalización (tests en verde + revisión contra RF) | §7 Criterio de "Hecho" |
| RNF-07 (`@supabase/supabase-js` pendiente de aprobación), Fuera de alcance (sin motor distinto de Supabase, sin oráculo/contrato/minteo en esta spec) | §1 Stack bloqueado (solo Hedera; sin dependencias nuevas sin aprobación) |
