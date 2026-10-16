# Spec 003 — Marketplace y Liquidación de Regalías en HSCS

## Resumen

Esta especificación define **el QUÉ y el POR QUÉ** del marketplace de Muurketplace en **Hedera Smart Contract Service (HSCS / EVM)**: listar genética élite ya certificada, venderla de forma fraccionada y liquidar regalías al criador de manera automática y auditable.

Es la **capa de comercialización** del ecosistema. No valida ni tasa (eso es Spec 001, APROBADA), no certifica trazabilidad (eso es Spec 002, APROBADA con proof VERIFIED), no mintea tokens (eso ya existe en `tokenizarToro.js` vía HTS). Solo comercializa: *este toro APTO y VERIFICADO, a este precio tasado, se vende así y reparte así*.

## Contexto y problema (Background)

Muurketplace tokeniza genética bovina de élite en Hedera mediante dos activos ya definidos:

- `PAJ-BRAF`: fungible, **0 decimales** (1 token = 1 pajuela indivisible de 0.5 ml).
- `BULL`: NFT/equity fraccionable con **4 decimales**, **supply máximo 10** (permite micro-fracciones para inversores minoristas).

La Spec 001 (APROBADA) resolvió *¿es apto y cuánto vale?* con `evaluateBull` → `{ apto, mTotal, tasacionToroUsd, tasacionDosisUsd }`, con bases `$30,000 × M_TOTAL` (toro) y `$10 × M_TOTAL` (dosis, half-up a 2 decimales). La Spec 002 (APROBADA) resolvió *¿cómo pruebo que esa tasación es auténtica?* con mensaje HCS y proof `VERIFIED` (`topicId`, `sequenceNumber`, `consensusTimestamp`, `transactionId` verificables en HashScan).

Falta la pregunta *¿cómo compro una fracción y cómo cobra el criador sus regalías sin intermediarios?* Hoy no existe venta ni reparto: el criador no monetiza, el inversor minorista no puede entrar fraccionado y no hay liquidación auditable de regalías. Esta spec cierra esa brecha con un contrato HSCS en Testnet que lista, vende y liquida, exigiendo siempre proof HCS `VERIFIED` como precondición.

Fuente de verdad biológica: Sumario de Padres PEGBraf, vía skill `ganaderia-pricing-engine` (`parametros_de_toro_lider`) y `docs/constitution.md` §5. Esta spec no redefine ningún umbral, multiplicador ni valor base.

## Objetivos

1. Permitir la **venta fraccionada** de genética élite (pajuelas `PAJ-BRAF` enteras y fracciones `BULL` de hasta 4 decimales) a precios derivados de la tasación.
2. Garantizar la **liquidación automática de regalías al criador** en cada venta, con porcentaje definido al listar y reparto verificable.
3. Garantizar que **solo se comercializa lo APTO con proof HCS VERIFIED** (sin proof válida no hay listado ni compra).
4. Hacerlo con **fallos seguros** (reembolso ante fallo), costo de gas acotado y **cero exposición de claves**, operando solo en Testnet.

## Alcance

### Dentro del alcance

- Creación de listados de venta (precio unitario derivado de la tasación, cantidad disponible, porcentaje de regalía al criador).
- Compra de pajuelas (`PAJ-BRAF`, cantidades enteras) y de fracciones de equity (`BULL`, hasta 4 decimales, respetando supply 10).
- Verificación de proof HCS (`VERIFIED`) como precondición de listar y de comprar.
- Cálculo y liquidación (split) del pago: parte al vendedor / tesorería del listado y parte (`%`) al criador como regalía.
- Retiro/liquidación acumulada de regalías del criador.
- Manejo de fallos de compra y liquidación con reembolso al comprador (sin pérdida de fondos por fallo del contrato o de red).
- Consulta pública del estado de un listado, una compra y una liquidación (verificable en HashScan Testnet).

### Fuera de alcance (NO implementable en esta spec)

- Minteo, creación o configuración de tokens HTS (`PAJ-BRAF`, `BULL`, decimales, supplies, claves Admin/Treasury) → ya existe en `tokenizarToro.js`, no se reimplementa aquí.
- Motor de validación biológica y tasación (umbrales, multiplicadores aditivos, `M_TOTAL`, bases `$30,000` / `$10`, redondeo half-up) → propiedad exclusiva de la Spec 001.
- Registro de oráculo en HCS, formato del mensaje de tasación, topics, mirror node → propiedad exclusiva de la Spec 002.
- Ajuste de umbrales o valores base sin respaldo documental PEGBraf (prohibido por constitution §5).
- Fiat on/off-ramp, KYC, pasarelas de pago, UI, base de datos, API HTTP con autenticación de usuarios.
- Interpretación veterinaria nueva del Sumario PEGBraf.

## Actores del sistema

| Actor | Rol | Interacción con este marketplace |
|-------|-----|----------------------------------|
| Criador / Centro genético | Propietario de la genética y beneficiario de regalías | Crea listados de su toro APTO y VERIFICADO, fija `%` de regalía, cobra liquidaciones |
| Comprador / Inversor | Adquiere pajuelas enteras o fracciones de equity | Compra `PAJ-BRAF` (enteros) o fracciones `BULL` (hasta 4 decimales) al precio tasado; recibe reembolso si la compra falla |
| Marketplace Muurketplace (este sistema, HSCS) | Intermedia, reparte y liquida | Verifica proof `VERIFIED`, ejecuta venta, hace split de regalías, permite retiro y reembolso |
| Red Hedera Testnet (HSCS + HashScan) | Infraestructura de ejecución y auditoría | Ejecuta el contrato, da finalidad a las transacciones y las hace verificables en HashScan Testnet |

## Historias de usuario

- **HU-01 — Venta del criador:** Como criador, quiero listar las pajuelas y fracciones de mi toro APTO y VERIFICADO a precio tasado para monetizar mi genética sin intermediarios.
- **HU-02 — Entrada fraccionada:** Como inversor minorista, quiero comprar una fracción pequeña de un toro de $73,500 (ej. 0.0001 `BULL`) para participar con poco capital.
- **HU-03 — Regalía garantizada:** Como criador, quiero que cada reventa/compra me liquide automáticamente mi `%` pactado para no depender de la palabra del vendedor.
- **HU-04 — Compra segura:** Como comprador, quiero que si la compra falla por red o por el contrato, se me reembolse íntegramente para no perder fondos.
- **HU-05 — Auditoría pública:** Como auditor, quiero verificar en HashScan que cada listado nació de una proof `VERIFIED` y que cada liquidación repartió lo pactado, sin credenciales del operador.

## Requisitos Funcionales (notación EARS)

### Precondición transversal (aplica a todos los RF de listado y compra)

Solo un toro con veredicto `apto = true` de la Spec 001 **y** proof HCS `VERIFIED` de la Spec 002 es comercializable. Sin proof válida no hay listado ni compra.

- **RF-01 — Crear listado verificado:** `CUANDO el criador solicite listar un toro con prueba de consenso válida, EL SISTEMA creará un listado con precio unitario derivado de la tasación, cantidad disponible y porcentaje de regalía, y devolverá el identificador del listado con su referencia a la proof VERIFIED.`
- **RF-02 — Rechazo sin proof VERIFIED:** `SI la prueba HCS aportada no existe, no está VERIFIED o su contenido no coincide íntegramente con la tasación reclamada (mTotal o tasaciones alteradas), ENTONCES EL SISTEMA rechazará la creación del listado y la compra sin mover fondos ni tokens.`
- **RF-03 — Precio desde tasación:** `EL SISTEMA fijará todo precio de venta a partir de la tasación certificada (base toro $30,000 × M_TOTAL para equity BULL y base dosis $10 × M_TOTAL half-up a 2 decimales para PAJ-BRAF), sin negociación subjetiva dentro del contrato.`
- **RF-04 — Compra de pajuelas y fracciones:** `CUANDO el comprador compre una cantidad entera de PAJ-BRAF o una fracción BULL de hasta 4 decimales dentro del supply 10 y del saldo disponible del listado, EL SISTEMA transferirá la cantidad comprada al comprador y registrará la compra con su transacción verificable.`
- **RF-05 — Split de regalías en cada venta:** `CUANDO una compra se complete, EL SISTEMA dividirá el pago automáticamente según el porcentaje de regalía fijado al listar, acreditando la parte del criador como regalía y el resto al vendedor del listado.`
- **RF-06 — Liquidación / retiro de regalías del criador:** `CUANDO el criador solicite liquidar sus regalías acreditadas, EL SISTEMA le transferirá el saldo pendiente y registrará la liquidación con su transacción verificable, sin permitir doble retiro del mismo saldo.`
- **RF-07 — Reembolso ante fallo:** `SI la compra o la liquidación falla por error de red, del contrato o de fondos/tokens insuficientes, ENTONCES EL SISTEMA revertirá la operación y reembolsará íntegramente al pagador sin acreditar tokens ni regalías parciales.`
- **RF-08 — Cancelación segura del listado:** `CUANDO el criador cancele un listado con ventas pendientes de liquidar, EL SISTEMA cerrará el listado a nuevas compras pero preservará los saldos de regalías ya acreditadas para su retiro posterior.`

### Ejemplo de aceptación (no es RF — caso canónico verificable)

- **EA-01 — Caso canónico M_TOTAL = 2.45:** `CUANDO la tasación certificada sea M_TOTAL = 2.45 (toro $73,500 / dosis $24.50) con proof VERIFIED y el listado fije 5% de regalía, EL SISTEMA venderá 10 pajuelas por $245.00 totales, acreditará $12.25 al criador y $232.75 al vendedor, y liquidará $12.25 al criador en el retiro sin doble pago.` Desglose: 10 × $24.50 = $245.00; 5% × $245.00 = $12.25; resto $232.75.

## Requisitos No Funcionales

- **RNF-01 — Separación de capas:** la validación/tasación seguirá siendo lógica pura de `src/logic/` (Spec 001) y el acceso a Hedera vivirá separado; ningún archivo de lógica importará el SDK ni tocará red (constitution §2).
- **RNF-02 — Tests nativos:** cada RF tendrá al menos un test ejecutable con `node --test tests/` sin frameworks externos (constitution §1 y §3); los tests de contrato/red usarán mocks sin exigir Testnet, más una única prueba E2E gateada que solo corre con credenciales Testnet explícitas.
- **RNF-03 — Seguridad de fondos:** el contrato nunca dejará fondos bloqueados ni permitirá doble retiro de la misma regalía ni doble acreditación de la misma compra; todo fallo revierte con reembolso (ver RF-07).
- **RNF-04 — Gas acotado:** cada operación (listar, comprar, liquidar, cancelar) consumirá como máximo una comisión HSCS estándar de Testnet por transacción; el sistema no realizará operaciones que multipliquen el costo por venta.
- **RNF-05 — Finalidad y latencia:** la compra y la liquidación se confirmarán solo cuando la red haya alcanzado finalidad (no antes del receipt); el tiempo típico esperado en Testnet es de pocos segundos.
- **RNF-06 — Verificabilidad pública:** todo listado, compra y liquidación será comprobable por un tercero con solo el identificador de transacción, usando HashScan Testnet, sin credenciales del operador; cada listado conservará su referencia a la proof HCS VERIFIED de origen.
- **RNF-07 — Seguridad de claves:** el sistema nunca imprimirá, registrará en logs ni commiteará claves privadas, ni Account IDs reales, ni el contenido de `.env` (constitution §4).
- **RNF-08 — Solo Testnet:** todas las operaciones de esta spec se ejecutarán exclusivamente contra Hedera Testnet; cualquier uso de Mainnet requiere aprobación explícita previa (constitution §4).
- **RNF-09 — Idioma:** documentación y comentarios en español; identificadores de código en inglés camelCase (constitution §6).

## Supuestos

1. Existen `MY_ACCOUNT_ID` y `MY_PRIVATE_KEY` válidos de Testnet disponibles vía `.env` (nunca commiteado); sin ellos ninguna operación HSCS puede firmarse.
2. Los tokens `PAJ-BRAF` (0 decimales) y `BULL` (4 decimales, supply 10) ya existen y fueron creados con claves Admin/Treasury obligatorias según constitution §4; esta spec solo los comercializa, no los crea.
3. La salida de `evaluateBull` (Spec 001) y la proof `VERIFIED` (Spec 002) son las únicas fuentes de precio y elegibilidad; este marketplace no recalcula ni corrige `mTotal` ni tasaciones.
4. El porcentaje de regalía se fija al crear el listado y no cambia para las compras ya realizadas; un cambio solo aplica a compras futuras o a un nuevo listado.
5. La consulta a mirror node / HashScan puede tener retardo de sincronización de segundos; la verificación de proof debe tolerarlo sin declarar falsos negativos.
6. Los precios en USD de la tasación se representan on-chain con la precisión del contrato sin perder el redondeo half-up a 2 decimales de la dosis certificado en la Spec 001.

## Casos límite

- Proof inexistente, no VERIFIED o con `mTotal` alterado en un decimal (2.45 vs 2.46) → rechazo total sin mover fondos (RF-02).
- Compra de `PAJ-BRAF` fraccionada (ej. 1.5 pajuelas) → rechazada: solo cantidades enteras; 0 decimales.
- Compra de `BULL` con más de 4 decimales o que exceda el supply 10 o el saldo del listado → rechazada sin reembolso necesario (fondos no movidos).
- Compra por $0 o cantidad 0 → rechazada sin crear registro de venta.
- Fallo de red tras pagar pero antes del receipt → reembolso íntegro, sin tokens ni regalías acreditadas (RF-07).
- Doble intento de liquidar la misma regalía → segundo intento rechazado, sin doble pago (RF-06).
- Cancelación con regalías pendientes → listado cerrado a nuevas compras, saldos preservados para retiro (RF-08).
- Regalía del 0% → listado válido, split acredita $0 al criador; regalía del 100% → vendedor recibe $0 (ambos registrados explícitamente).
- Caída total de Testnet → operaciones devuelven error sin receipt y sin registrar nada localmente como si fuera válido.

## Criterios de finalización (criterios de aceptación verificables)

1. Existe `specs/003-marketplace-regalias/spec.md` con los RF-01 a RF-08 en notación EARS, el ejemplo EA-01 y trazabilidad a constitution.
2. Cada RF-01 a RF-08 tiene al menos un test en `tests/` ejecutable con `node --test tests/` en verde (los de red/contrato con mocks, sin requerir Testnet en CI; más una E2E gateada).
3. El caso EA-01 (M_TOTAL = 2.45, 10 pajuelas a $24.50, 5% regalía) reproduce exactamente `$245.00` totales, `$12.25` al criador y `$232.75` al vendedor, con retiro de `$12.25` sin doble pago.
4. Un listado sin proof VERIFIED no crea registro ni mueve fondos; una compra con proof alterada es rechazada (verificable por ausencia de transacción nueva).
5. Toda compra y liquidación exitosa devuelve transacción visible en `hashscan.io/testnet`; la verificación por HashScan confirma reparto pactado y la de un reparto alterado la niega.
6. Ningún archivo de `src/logic/` importa SDK ni accede a `.env` o red; ninguna clave privada aparece en el repo, logs o tests.
7. Ninguna operación apunta a Mainnet.
8. Veredicto `APROBADO` del revisor SDD (`/sdd-validate`) y `MEMORY.md` actualizado.

## Dudas abiertas

- **D-01:** ¿Porcentaje de regalía fijo del protocolo (ej. 5%) o libre por listado dentro de un rango (ej. 0–10%)? (Propuesta inicial: libre al listar, registrado inmutablemente por listado; el protocolo no lo impone en esta spec.)
- **D-02:** ¿Las regalías aplican también a reventas secundarias entre inversores o solo a la venta primaria del criador? (Propuesta: a toda compra ejecutada por el contrato, primaria y secundaria, con el `%` del listado de origen.)
- **D-03:** ¿En qué moneda on-chain se liquida (HBAR vs stablecoin HTS) y con qué oracle de tipo de cambio USD on-chain? (Propuesta: definir en el plan sin cambiar esta spec; el QUÉ no depende de la moneda.)

## Trazabilidad a constitution

| Requisito | Principio constitution |
|-----------|------------------------|
| RF-01, RF-02, RF-03 (solo APTO + VERIFIED, precio desde tasación sin redefinir umbrales) | §5 Fuente de verdad biológica (solo comercializa lo que 001 decidió y 002 certificó con respaldo PEGBraf) |
| RNF-01 (separación `src/logic/` vs capas Hedera) | §2 Separación de lógica e infraestructura |
| RF-04 a RF-08 + RNF-02, Criterios 2/3/4 | §3 Política de tests (1 test por RF, TDD) |
| RNF-07, RNF-08, Criterios 6/7, Supuesto 1 | §4 Protección de datos y seguridad (nunca `.env`/claves en repo, nunca Mainnet sin aprobación; Admin/Treasury ya exigidas al crear los tokens) |
| RNF-09 | §6 Idioma (español docs, inglés código) |
| Criterios de finalización (tests en verde + revisión contra RF) | §7 Criterio de "Hecho" |
| Fuera de alcance (sin minteo HTS, sin motor, sin oráculo en esta spec) | §1 Stack bloqueado (solo Hedera; sin dependencias nuevas sin aprobación) |
