# Spec 002 — Registro de Oráculo en HCS (trazabilidad inmutable)

## Resumen

Esta especificación define **el QUÉ y el POR QUÉ** del registro de oráculo de Muurketplace en **Hedera Consensus Service (HCS)**: persistir de forma inmutable y verificable el resultado del motor de la Spec 001 (`evaluateBull` → `{ apto, motivos, mTotal, tasaciones }`) como mensaje de consenso con sello temporal, para que cualquier tercero pueda auditar que una tasación existió, cuándo existió y con qué contenido, sin confiar en la palabra del operador.

Es la **capa de trazabilidad** del ecosistema. No tokeniza (eso es HTS / Spec futura), no vende ni liquida (eso es HSCS marketplace / Spec 003). Solo certifica: *este toro, con estos datos PEGBraf, obtuvo este veredicto y esta tasación en este momento*.

## Contexto y problema (Background)

Muurketplace tokeniza genética bovina de élite en Hedera mediante `PAJ-BRAF` (fungible) y `BULL` (NFT/equity). La Spec 001 (COMPLETA y APROBADA, 105 tests verdes) resolvió la pregunta *¿cuánto vale y es apto?* con lógica 100% pura, sin blockchain: dado un objeto de 11 campos del Sumario de Padres PEGBraf, devuelve veredicto APTO/RECHAZADO más `mTotal` y tasaciones solo si es APTO.

Falta la pregunta *¿cómo pruebo después que esa tasación es auténtica y no fue alterada?* Hoy el resultado de `evaluateBull` vive solo en memoria del proceso que lo calculó. Sin un ancla inmutable, un centro genético, un inversor o un auditor no puede distinguir una tasación real de una fabricada a posteriori, ni ordenar temporalmente dos tasaciones del mismo toro.

Esta spec cierra esa brecha usando HCS como oráculo de trazabilidad: cada tasación APTA se publica como mensaje JSON en un topic de consenso en Testnet, obteniendo `topicId`, `sequenceNumber`, `consensusTimestamp` y `transactionId` verificables en HashScan y consultables vía mirror node.

Fuente de verdad biológica: Sumario de Padres PEGBraf, vía skill `ganaderia-pricing-engine` y `docs/constitution.md` §5. Esta spec no redefine ningún umbral ni multiplicador; solo registra lo que la Spec 001 decidió.

## Objetivos

1. Dar a cada tasación APTA un **ancla inmutable** en HCS con orden total y sello temporal de consenso.
2. Permitir que **cualquier verificador** compruebe en HashScan / mirror node que un mensaje de tasación existe con contenido íntegro.
3. Garantizar que **solo se registra lo APTO** (lo RECHAZADO no contamina el registro público) y que lo registrado reproduce fielmente la salida de la Spec 001.
4. Hacerlo con **costo acotado, reintentos seguros y cero exposición de claves**, operando solo en Testnet.

## Alcance

### Dentro del alcance

- Creación (o reutilización) del topic HCS que actúa como libro de tasaciones del oráculo.
- Publicación (submit) del resultado de tasación como mensaje JSON canónico en dicho topic.
- Consulta / verificación posterior del mensaje vía mirror node y enlace verificable en HashScan (hashscan.io/testnet).
- Manejo de errores de red con reintentos acotados e idempotencia observable (sin doble registro involuntario).
- Definición del contenido mínimo del mensaje (qué campos de trazabilidad debe llevar, sin dictar código).

### Fuera de alcance (NO implementable en esta spec)

- Marketplace, compraventa, liquidación de regalías y cualquier smart contract (HSCS) → Spec 003.
- Creación, minteo, transferencia o fraccionamiento de tokens `PAJ-BRAF` y `BULL` (HTS), decimales, supplies, claves Admin/Treasury de tokens → fuera de esta spec (las claves Admin/Treasury citadas en constitution §4 aplican cuando se toquen tokens, no a este topic).
- Ajuste del motor de validación/tasación, umbrales o valores base ($30,000 / $10) → propiedad exclusiva de la Spec 001 y constitution §5.
- Persistencia local, base de datos, API HTTP, UI, autenticación de usuarios.
- Interpretación veterinaria nueva del Sumario PEGBraf más allá de lo ya definido en la Spec 001.

## Actores del sistema

| Actor | Rol | Interacción con este registro |
|-------|-----|-------------------------------|
| Ganadero / Centro genético | Propietario del toro candidato | Solicita el registro de la tasación APTA de su animal; recibe prueba verificable (enlace HashScan) |
| Oráculo Muurketplace (este sistema) | Publica y certifica tasaciones en HCS | Recibe salida APTA de Spec 001, la publica en el topic, devuelve prueba de consenso |
| Verificador / Auditor / Inversor | Confía sin confiar (trustless) | Consulta el topic / HashScan y comprueba integridad, orden y momento de la tasación |
| Red Hedera Testnet (HCS + mirror node) | Infraestructura de consenso y lectura | Ordena los mensajes, les asigna sello temporal y los sirve para consulta |

## Historias de usuario

- **HU-01 — Prueba inmutable:** Como centro genético, quiero una prueba pública de que mi toro fue tasado en $X el día Y para poder exhibirla ante compradores sin que me acusen de inflar el precio.
- **HU-02 — Auditoría del inversor:** Como inversor, quiero verificar en HashScan que la tasación que respalda un futuro token existió antes de la tokenización y no fue reescrita, para invertir con confianza.
- **HU-03 — Filtro de calidad pública:** Como ecosistema, quiero que los toros RECHAZADOS no ocupen espacio en el registro público para que el topic sea por construcción un catálogo de élite.
- **HU-04 — Operación segura:** Como operador del oráculo, quiero que un fallo de red no duplique registros ni exponga mis claves para poder reintentar con tranquilidad.

## Requisitos Funcionales (notación EARS)

### Precondición transversal (aplica a todos los RF de publicación)

Solo una salida de la Spec 001 con `apto = true` es registrable. Un resultado con `apto = false` nunca llega a HCS (ver RF-03).

- **RF-01 — Crear topic de tasaciones:** `CUANDO el oráculo no tenga un topic de tasaciones configurado, EL SISTEMA creará un topic HCS dedicado al registro de tasaciones y conservará su topicId como referencia del oráculo.`
- **RF-02 — Reutilizar topic existente:** `SI ya existe un topicId de tasaciones configurado, ENTONCES EL SISTEMA lo reutilizará en lugar de crear uno nuevo.`
- **RF-03 — Solo APTOS al registro:** `SI el resultado de evaluateBull tiene apto = false, ENTONCES EL SISTEMA rechazará la solicitud de registro sin publicar ningún mensaje en HCS e informará el motivo de rechazo.`
- **RF-04 — Publicar tasación APTA:** `CUANDO el oráculo reciba un resultado con apto = true, EL SISTEMA publicará exactamente un mensaje JSON de tasación en el topic configurado y devolverá la prueba de consenso (topicId, sequenceNumber, consensusTimestamp y transactionId).`
- **RF-05 — Contenido mínimo del mensaje:** `EL SISTEMA incluirá en cada mensaje de tasación la identificación del toro/lote, los inputs PEGBraf evaluados, el veredicto apto = true, mTotal y ambas tasaciones USD, más el instante de publicación y una referencia a la versión de la Spec 001 aplicada.`
- **RF-06 — Verificación por HashScan / mirror:** `CUANDO un verificador aporte una prueba de consenso (topicId + sequenceNumber o transactionId), EL SISTEMA recuperará el mensaje correspondiente vía mirror node y confirmará si su contenido coincide íntegramente con la tasación reclamada.`
- **RF-07 — Reintentos seguros ante fallos de red:** `SI la creación del topic o la publicación del mensaje falla por error de red o de consenso, ENTONCES EL SISTEMA reintentará un número acotado de veces con espera entre intentos y nunca confirmará un registro sin prueba de consenso de la red.`
- **RF-08 — Sin doble registro involuntario:** `MIENTRAS un reintento de publicación esté en curso para la misma tasación, EL SISTEMA evitará publicar mensajes duplicados de esa tasación una vez que la red ya la haya aceptado.`

## Requisitos No Funcionales

- **RNF-01 — Separación de capas:** la validación y la tasación seguirán siendo lógica pura de `src/logic/` (Spec 001); todo acceso a Hedera vivirá separado y ningún archivo de lógica importará el SDK ni tocará red (constitution §2).
- **RNF-02 — Tests nativos:** cada RF tendrá al menos un test ejecutable con `node --test tests/` sin frameworks externos (constitution §1 y §3); los tests de red usarán dobles/mocks sin exigir conexión real a Testnet.
- **RNF-03 — Costo acotado:** cada publicación consumirá como máximo una comisión HCS estándar de Testnet (orden de céntimos de HBAR); el sistema no realizará operaciones que multipliquen el costo por mensaje.
- **RNF-04 — Finalidad y latencia:** la prueba de consenso se devolverá solo cuando la red haya alcanzado consenso (no antes del receipt); el tiempo típico esperado en Testnet es de pocos segundos.
- **RNF-05 — Seguridad de claves:** el sistema nunca imprimirá, registrará en logs ni commiteará claves privadas, ni Account IDs reales, ni el contenido de `.env` (constitution §4).
- **RNF-06 — Solo Testnet:** todas las operaciones de esta spec se ejecutarán exclusivamente contra Hedera Testnet; cualquier uso de Mainnet requiere aprobación explícita previa (constitution §4).
- **RNF-07 — Verificabilidad pública:** toda tasación registrada será comprobable por un tercero con solo la prueba de consenso, usando HashScan Testnet o mirror node públicos, sin credenciales del operador.
- **RNF-08 — Idioma:** documentación y comentarios en español; identificadores de código en inglés camelCase (constitution §6).

## Supuestos

1. Existe `MY_ACCOUNT_ID` y `MY_PRIVATE_KEY` válidos de Testnet disponibles vía `.env` (nunca commiteado); sin ellos ninguna operación HCS puede firmarse.
2. La salida de `evaluateBull` de la Spec 001 es la única fuente del contenido a registrar; este registro no recalcula ni corrige `mTotal` ni tasaciones.
3. El topic de tasaciones es de solo-agregado (append-only): HCS no permite editar ni borrar mensajes ya consensuados; una corrección futura sería un nuevo mensaje, nunca una mutación.
4. La consulta vía mirror node puede tener retardo de sincronización de segundos; la verificación debe tolerarlo sin declarar falsos negativos.
5. Los límites de tamaño de mensaje HCS vigentes en Testnet se respetan; el JSON de tasación cabe holgadamente en un único mensaje (no se requiere fragmentación en esta spec).

## Casos límite

- Toro RECHAZADO (`apto = false`) → ningún mensaje publicado; se informa el motivo (RF-03).
- Reintento tras timeout sin receipt → al recuperarse, el sistema detecta si la red ya aceptó el mensaje y no duplica (RF-07 + RF-08).
- Credenciales ausentes o inválidas (`.env` sin `MY_ACCOUNT_ID` / `MY_PRIVATE_KEY`) → fallo explícito antes de tocar la red, sin publicar nada.
- TopicId configurado pero inexistente o borrado en la red → error explícito de configuración, no creación silenciosa de un topic paralelo.
- Mirror node aún no sincronizado al verificar inmediatamente después de publicar → la verificación informa "pendiente de sincronización" en lugar de "no existe".
- Mensaje reclamado con contenido alterado en un decimal (ej. `mTotal` 2.45 vs 2.46) → la verificación falla por no coincidencia íntegra.
- Caída total de Testnet → todos los reintentos se agotan, se devuelve error sin prueba de consenso y sin registrar nada localmente como si fuera válido.

## Criterios de finalización (criterios de aceptación verificables)

1. Existe `specs/002-registro-oraculo-hcs/spec.md` con los RF-01 a RF-08 en notación EARS y trazabilidad a constitution.
2. Cada RF-01 a RF-08 tiene al menos un test en `tests/` ejecutable con `node --test tests/` en verde (los de red con mocks, sin requerir Testnet en CI).
3. Una tasación APTA de ejemplo (caso canónico EA-01 de la Spec 001: `M_TOTAL = 2.45`, $73,500 / $24.50) publicada en Testnet devuelve `topicId`, `sequenceNumber`, `consensusTimestamp` y `transactionId` reales y visibles en `hashscan.io/testnet`.
4. Un toro RECHAZADO de ejemplo no produce ningún mensaje en el topic (verificable por ausencia de sequenceNumber nuevo).
5. La verificación por mirror node de un mensaje real confirma coincidencia íntegra; la de un mensaje alterado la niega.
6. Ningún archivo de `src/logic/` importa `@hashgraph/sdk` ni accede a `.env` o red; ninguna clave privada aparece en el repo, logs o tests.
7. Ninguna operación apunta a Mainnet.
8. Veredicto `APROBADO` del revisor SDD (`/sdd-validate`) y `MEMORY.md` actualizado.

## Dudas abiertas

- **D-01:** ¿Un topic único global para todas las tasaciones o un topic por centro genético / temporada? (Propuesta inicial: un único topic de oráculo para simplificar auditoría; escalar a múltiples topics solo si el volumen lo exige.)
- **D-02:** ¿Debe el mensaje incluir el hash del Sumario PEGBraf fuente o basta con los 11 campos de entrada? (Propuesta: incluir los 11 campos más un identificador del lote; el hash del documento fuente queda para una revisión futura.)
- **D-03:** ¿Se registra también un mensaje de "toro presentado pero RECHAZADO" con motivos (solo conteo) o se mantiene el veto total del RF-03? (Propuesta: mantener veto total en esta spec para preservar el carácter de catálogo de élite.)

## Trazabilidad a constitution

| Requisito | Principio constitution |
|-----------|------------------------|
| RF-01, RF-02, RF-04, RF-05 (qué se registra y con qué contenido, sin redefinir umbrales) | §5 Fuente de verdad biológica (solo registra lo que la Spec 001 decidió con respaldo PEGBraf) |
| RNF-01 (separación `src/logic/` vs capa Hedera) | §2 Separación de lógica e infraestructura |
| RF-06, RF-07, RF-08 + RNF-02, Criterios 2/5 | §3 Política de tests (1 test por RF, TDD) |
| RNF-05, RNF-06, Criterios 6/7 | §4 Protección de datos y seguridad (nunca `.env`/claves en repo, nunca Mainnet sin aprobación) |
| RNF-08 | §6 Idioma (español docs, inglés código) |
| Criterios de finalización (tests en verde + revisión contra RF) | §7 Criterio de "Hecho" |
| Fuera de alcance (sin HTS/HSCS en esta spec) | §1 Stack bloqueado (solo Hedera; sin dependencias nuevas sin aprobación) |
