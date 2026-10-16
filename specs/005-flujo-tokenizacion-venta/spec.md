# Spec 005 — Flujo End-to-End de Tokenización, Venta y Registro en Wallets (HTS + HCS)

## Resumen

Esta especificación define **el QUÉ y el POR QUÉ** del flujo completo que va desde que una cabaña carga un animal ya validado/tasado hasta que un cliente compra su genética, con **todos los activos emitidos y transferidos on-chain por Hedera Token Service (HTS)** y **toda compra registrada de forma inmutable en Hedera Consensus Service (HCS)**, quedando la operación reflejada en la wallet de ambas partes y verificable públicamente en HashScan Testnet.

Es la **capa de activos + trazabilidad de compra** del ecosistema. No valida ni tasa (Spec 001, APROBADA), no certifica la tasación en HCS (Spec 002, APROBADA), ni persiste el espejo off-chain (Spec 004, APROBADA). **Por decisión explícita del usuario, esta spec reabre y reemplaza el contrato de la Spec 003 (APROBADA):** la Spec 003 conserva su lógica pura de listado, precio desde tasación y split half-up (**R-REV-01**) como base **reutilizada por equivalencia, no duplicada**, mientras que la Spec 005 introduce un **contrato atómico** (`MuurketplaceAtomic.sol`, que **reemplaza por completo a `Muurketplace.sol`** —el cual **deja de ser el contrato operativo**, preservándose sus capacidades declaradas de listado, cancelación y consultas—) que mueve HBAR y tokens HTS **en una sola transacción HSCS**. Cierra el eslabón que faltaba entre *"este toro está tasado y certificado"* y *"este cliente posee en su wallet las pajuelas/equity que compró, con un comprobante público"*: **la tokenización HTS y la compra atómica de HTS↔HBAR, con su registro de compra en HCS**.

## Contexto y problema (Background)

Muurketplace tiene el backend 001–004 COMPLETO y APROBADO (317 tests verdes):

- **001:** `evaluateBull` puro → `{ apto, motivos, mTotal, tasacionToroUsd, tasacionDosisUsd }` desde 11 inputs PEGBraf.
- **002:** oráculo HCS con mensaje canónico de tasación y proof `{ topicId, sequenceNumber, consensusTimestamp, transactionId }` (estados `VERIFIED` / `MISMATCH` / `PENDING`).
- **003:** marketplace (lógica pura + `Muurketplace.sol` + cliente HSCS) que lista, vende fraccionado y liquida regalías, con EA-01 canónico (`$245.00` / `$12.25` / `$232.75`).
- **004:** persistencia espejo en Supabase (chain = verdad, espejo = memoria), idempotencia por `purchaseId`.

Sin embargo, hoy **el flujo de activos reales está incompleto y desconectado**:

1. **Minteo:** solo existe el script de demostración `tokenizarToro.js`, que crea **un único** `PAJ-BRAF` fungible sin decimales y **no crea `BULL`**, sin asociación explícita ni flujo reutilizable (Spec 001/002/003 lo declaran fuera de su alcance).
2. **Transferencia:** el contrato de la Spec 003 liquida en **HBAR (`msg.value`) y NO transfiere tokens HTS** en la misma llamada. Es decir, la Spec 003 resuelve el *pago y el split* pero **no mueve la genética tokenizada** (`PAJ-BRAF` / `BULL`) a la wallet del comprador ni lo hace de forma atómica con el cobro.
3. **Registro de compra:** la Spec 002 registra la *tasación*, pero **no registra el evento de compra** (quién compró, qué activo, cuánta cantidad, contra qué listado/compra y con qué txId).

Esta spec cierra esas tres brechas con un flujo end-to-end sobre Hedera Testnet: la **cabaña tokeniza** el animal creando/emitiendo un **par de activos HTS propios por animal/lote** (`PAJ-BRAF` + `BULL`) con claves Admin/Treasury obligatorias (constitution §4), se **asocian** los tokens a la wallet de la cabaña y del comprador y la cabaña **autoriza al contrato vía allowance HTS (HIP-336)** para mover sus tokens, la **compra transfiere HTS real** (`PAJ-BRAF` entero o fracción `BULL` de hasta 4 decimales) a la wallet del comprador **de forma atómica con el pago y el split en una sola transacción HSCS**, y el evento de compra se **registra en HCS reutilizando el topic de tasaciones de la Spec 002**, con su proof de consenso verificable en HashScan.

> **Hallazgo técnico y relación con la Spec 003 (decisión del usuario: reabrir y reemplazar).** El contrato de la Spec 003 liquida en **HBAR** (`msg.value`) y **no mueve tokens HTS**. Por decisión explícita del usuario, la Spec 005 **reabre y reemplaza** el contrato de la Spec 003 (D-03/D-06): introduce `MuurketplaceAtomic.sol`, que en **una sola transacción HSCS** recibe el pago en HBAR, ejecuta la transferencia de la cantidad exacta de tokens HTS vía el *system contract* HTS (precompilado `0x167`) **consumiendo una allowance HIP-336 que la cabaña concede al contrato** y aplica el split de regalías, de modo que **o se mueven a la vez el pago y los tokens, o no se mueve nada** (revert total). La lógica pura de listado, precio desde tasación y split half-up (**R-REV-01**) de la Spec 003 se **reutiliza por equivalencia (misma semántica, garantizada por un test EA-01), no se duplica**; `MuurketplaceAtomic.sol` **reemplaza por completo** a `Muurketplace.sol`, que queda solo como **base lógica histórica** de 003. La Spec 005 posee la capa de activos HTS (minteo, asociación, allowance, transferencia atómica) y la trazabilidad HCS del evento de compra.

Fuente de verdad biológica: Sumario de Padres PEGBraf, vía skill `ganaderia-pricing-engine` (`parametros_de_toro_lider`) y `docs/constitution.md` §5. Esta spec **no redefine** ningún umbral, multiplicador, valor base, formato de mensaje de tasación, split ni regla de listado.

## Objetivos

1. **Tokenizar el animal** creando/emitiendo un **par de activos HTS propios por animal/lote** (`PAJ-BRAF` fungible 0 decimales con emisión del lote completo; `BULL` fraccionable 4 decimales con acuñación de sus 10 unidades) a la treasury de la cabaña, con claves Admin/Treasury obligatorias.
2. **Asociar** los tokens a la wallet de la cabaña y del comprador antes de poder recibir/transferir (`AssociateTransaction`) y **autorizar al contrato vía allowance HTS (HIP-336)** para mover los tokens de la cabaña.
3. **Vender/comprar con transferencia HTS real y atómica** de `PAJ-BRAF` (cantidades enteras) o `BULL` (hasta 4 decimales, ≤ supply 10, ≤ saldo del listado) a la wallet del comprador, **en la misma transacción HSCS que el cobro y el split** (ni tokens ni pago parciales).
4. **Registrar la compra en HCS** (comprador, activo, cantidad, `listingId`/`purchaseId`, `txId`) reutilizando el topic de tasaciones de la Spec 002, con proof de consenso publicable y comprobable en HashScan.
5. Garantizar **verificabilidad pública** de wallets y transacciones HTS/HCS por un tercero sin credenciales, operando **solo en Testnet**.
6. **Reemplazar el contrato de la Spec 003** por `MuurketplaceAtomic.sol` —reabriendo su alcance por decisión del usuario— para que la compra sea atómica, **reutilizando por equivalencia** la lógica de split half-up (R-REV-01) de 003 sin duplicarla.

## Alcance

### Dentro del alcance

- **Tokenización HTS por animal/lote:** creación/emisión de un **par de tokens propios** (`PAJ-BRAF` fungible 0 decimales, con emisión del lote completo; `BULL` fraccionable 4 decimales, con acuñación de sus **10 unidades**) a la treasury de la cabaña, con claves Admin y Treasury obligatorias.
- **Asociación de tokens:** `AssociateTransaction` a la wallet de la cabaña y del comprador, idempotente, antes de recibir/transferir.
- **Allowance HTS (HIP-336):** la cabaña concede al contrato `MuurketplaceAtomic.sol` una aprobación de allowance **suficiente y revocable** para mover sus tokens hacia el comprador; ciclo conceder/consumir/revocable. La **granularidad** (amplia por lote vs. exacta por compra) queda abierta para decidirse en el plan (D-08), sin cambiar el QUÉ de esta spec.
- **Compra atómica HTS↔HBAR:** `PAJ-BRAF` (enteros) o `BULL` (hasta 4 decimales, ≤ supply 10 y ≤ saldo del listado) transferidos desde la treasury de la cabaña al comprador **dentro de la misma transacción HSCS** que recibe el pago HBAR y aplica el split, vía el *system contract* HTS (`0x167`); un fallo revierte todo.
- **Registro HCS del evento de compra:** **reutiliza el `topicId` de tasaciones ya configurado de la Spec 002** (no se crea topic dedicado) y publica un único mensaje JSON canónico de compra **discriminado del mensaje de tasación** por `kind = "purchase"` y `specVersion = "005"` (vs. `specVersion = "001"` de 002), con su proof de consenso.
- **Verificación pública:** consulta del resultado HTS/HCS vía HashScan Testnet / mirror node y comprobación de integridad del mensaje de compra mediante un **verificador de compras propio**, separado del `oracleVerifier.js` de la Spec 002 (que rechaza `specVersion !== "001"`).
- **Reemplazo del contrato de la Spec 003:** nuevo contrato `MuurketplaceAtomic.sol` que **reemplaza por completo a `Muurketplace.sol`** (que queda como base lógica histórica), conservando el ciclo de listado y sustituyendo el retiro diferido de regalías por un **split inmediato** en la transacción atómica; **reutiliza por equivalencia** la lógica de split half-up (R-REV-01) de 003; esto **reabre el alcance de 003** por decisión explícita del usuario. **Solo listados nuevos (D-09):** `MuurketplaceAtomic.sol` aplica **únicamente a listados creados tras el reemplazo**; los listados vigentes de 003 **no se migran ni se recrean** y quedan como base lógica/no operativa.
- **Definición del contrato de datos** de entrada/salida del flujo (tokenización, allowance, compra, transferencia atómica, registro) y un ejemplo de aceptación canónico coherente con el EA-01 de la Spec 003.

### Fuera de alcance (NO implementable en esta spec)

- **Validación biológica y tasación** (umbrales, multiplicadores aditivos, `M_TOTAL`, bases `$30,000` / `$10`, redondeo half-up) → propiedad exclusiva de la Spec 001.
- **Formato del mensaje de oráculo de tasación**, topics de tasación, **verificador de tasación de 002** → propiedad exclusiva de la Spec 002 (esta spec solo **publica en su topic** un mensaje discriminado de compra y aporta un **verificador de compras propio**; no altera el formato ni el verificador de tasación).
- **Lógica pura de listado, precio desde tasación, compra fraccionada y regla de split half-up (R-REV-01)** → base lógica de la Spec 003 que esta spec **reutiliza por equivalencia**; la Spec 005 **sí reabre y reemplaza** el *contrato* de 003 sustituyéndolo por completo por `MuurketplaceAtomic.sol` (pago + transferencia HTS atómica), por decisión explícita del usuario.
- **Persistencia espejo** (Supabase, `valuationKey`, `purchaseId` idempotente off-chain, consultas públicas del espejo) → propiedad exclusiva de la Spec 004.
- **Gestión/custodia de claves** (rotación, HSM, multifirma) más allá de exigir que Admin y Treasury existan y nunca se expongan.
- **Fiat on/off-ramp, KYC, UI/frontend, autenticación de usuarios, pasarelas de pago.**
- **Ajuste de umbrales o valores base sin respaldo documental PEGBraf** (prohibido por constitution §5).
- **Mainnet**, cualquier red distinta de Hedera Testnet.
- **Nuevas dependencias:** esta spec no requiere ninguna dependencia nueva; `@hashgraph/sdk` ya está aprobada y en uso.

## Actores del sistema

| Actor | Rol | Interacción con este flujo |
|-------|-----|----------------------------|
| Cabaña / Centro genético | Propietario del animal ya validado/tasado y dueño de las claves Admin/Treasury; **treasury del token** | Tokeniza (crea/emite el par `PAJ-BRAF`+`BULL`), asocia tokens, **concede allowance al contrato** y transfiere genética al comprador |
| Comprador / Cliente | Adquiere pajuelas enteras o fracciones de equity `BULL` | Asocia el token a su wallet, paga y recibe la transferencia HTS atómica; comprueba su saldo en HashScan |
| Motor Muurketplace (001–004) | Precondición de elegibilidad y precio | Aporta APTO + tasación (001), proof `VERIFIED` (002), listado/split (003) y espejo (004); esta spec los consume, no los redefine |
| Contrato atómico `MuurketplaceAtomic.sol` (HSCS) | Ejecutor atómico de la compra | En una sola transacción recibe el pago HBAR, transfiere los tokens HTS vía el *system contract* `0x167` usando la allowance de la cabaña y reparte el split inmediato; un fallo revierte todo |
| Registro de compras (este sistema, HTS + HCS) | Emite, asocia, autoriza, transfiere y registra | Crea/emite activos, asocia wallets, gestiona allowance, invoca la compra atómica y publica el evento de compra en el topic de la 002 devolviendo la proof |
| Red Hedera Testnet (HTS + HCS + HSCS + mirror / HashScan) | Infraestructura de activos, contratos, consenso y auditoría | Ejecuta la transferencia de tokens y el contrato atómico, da finalidad a las transacciones y las sirve para consulta pública sin credenciales |

## Historias de usuario

- **HU-01 — Tokenizar la genética:** Como cabaña, quiero cargar mi animal ya validado/tasado y crear/emitir el par de activos (`PAJ-BRAF` y `BULL`) con claves Admin/Treasury para poder vender su genética on-chain con trazabilidad propia en HashScan.
- **HU-02 — Recibir en mi wallet:** Como comprador, quiero asociar el token a mi wallet antes de comprar para poder recibir las pajuelas/fracciones que adquiera.
- **HU-03 — Compra atómica real:** Como comprador, quiero que al comprar se me transfieran de verdad los tokens HTS **y** se cobre el pago de forma atómica (todo o nada), para tener posesión on-chain verificable sin riesgo de pagar sin recibir ni recibir sin pagar.
- **HU-04 — Vender sin custodiar:** Como cabaña, quiero conceder al contrato un permiso (allowance) para mover mis tokens en la venta sin depositarlos en escrow, para no ceder la custodia de mi genética.
- **HU-05 — Trazabilidad de la compra:** Como cabaña/comprador, quiero que el evento de compra quede registrado inmutablemente en HCS con comprador, activo, cantidad, `listingId`/`purchaseId` y `txId`, para probar la operación ante un tercero.
- **HU-06 — Auditoría sin credenciales:** Como auditor, quiero comprobar en HashScan Testnet las wallets de ambas partes, la transacción atómica HSCS y el mensaje HCS de compra sin credenciales del operador.
- **HU-07 — Reemplazo limpio de 003:** Como desarrollador, quiero que `MuurketplaceAtomic.sol` reemplace a `Muurketplace.sol` conservando listado y cancelación, reutilizando por equivalencia su split y **aplicando solo a listados nuevos** (sin migrar los históricos de 003), para no duplicar reglas ni romper el marketplace ya aprobado.

## Contrato de datos (base para todos los RF)

### Entrada de tokenización (cabaña carga su animal)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `bullId` | string | Identificación no vacía del animal/lote |
| `certifiedValuation` | object | `{ mTotal, tasacionToroUsd, tasacionDosisUsd }` salida de la Spec 001 |
| `proof` | object | `{ topicId, sequenceNumber, consensusTimestamp, transactionId }` proof `VERIFIED` de la Spec 002 |
| `pajuelaCount` | entero | Pajuelas del lote a emitir como `PAJ-BRAF` (> 0); se emite el **lote completo** al tokenizar (D-04) |
| `bullSupply` | entero | Unidades `BULL` a acuñar (≤ 10; por defecto 10, 4 decimales) (B2) |
| `cabanaAccountId` | string | Cuenta Testnet de la cabaña (**treasury del token**, D-02) |
| `contractId` | string | Cuenta/contrato `MuurketplaceAtomic.sol` desplegado, **spender** de la allowance (B1) |

**Salida de tokenización:** `{ pajBrafTokenId, bullTokenId, bullSupply, txIds: { pajBraf, bull }, hashscanUrls }` — un **par de tokens propios por animal/lote** (D-05), con el **lote completo** de `PAJ-BRAF` y las **`bullSupply` unidades de `BULL`** acuñadas a la treasury de la cabaña (B2). Esta salida cubre únicamente RF-01/RF-02; los `txId` de allowance **no** forman parte de la salida de tokenización y corresponden a **RF-06** (su número y granularidad quedan condicionados a la decisión D-08).

### Entrada de compra (cliente compra genética)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `listingId` | string | Identificador del listado (que fija `royaltyPct`) |
| `purchaseId` | string | Identificador único de compra, **generado por el contrato atómico** de forma determinista (N6) |
| `bullId` | string | Animal/lote de origen |
| `tokenId` | string | `tokenId` HTS del activo del listado (`PAJ_BRAF` o `BULL` del par del animal); **el listado referencia su `tokenId` (D-07)** |
| `assetType` | `"PAJ_BRAF"` \| `"BULL"` | Activo a transferir |
| `quantity` | número | Entero para `PAJ_BRAF`; hasta 4 decimales para `BULL` (≤ 10 y ≤ saldo) |
| `unitPriceUsd` | número | Precio unitario tasado (> 0; Spec 001/003) |
| `royaltyPct` | número | Porcentaje de regalía **fijado al crear el listado** (0-100, inmutable), consumido por el split (B3) |
| `buyerAccountId` | string | Cuenta Testnet del comprador |
| `cabanaAccountId` | string | Cuenta Testnet de la cabaña (treasury/origen de los tokens) |
| `contractId` | string | Contrato `MuurketplaceAtomic.sol` (ejecutor y **spender** de la allowance) |

**Salida de compra (transacción atómica):** `{ purchaseId, atomicTxId, assetType, quantity, buyer, seller, split: { totalUsd, royaltyUsd, sellerUsd }, hashscanUrl, purchaseProof }`, donde `atomicTxId` es el identificador de la **única transacción HSCS** que movió tokens HTS, cobró HBAR y repartió el split, y `purchaseId` (generado por el contrato) es la **misma clave de idempotencia que consume el espejo de la Spec 004** (N6).

> **Custodia de tokens (D-07):** los tokens `PAJ-BRAF`/`BULL` **permanecen en la treasury de la cabaña** hasta la compra atómica; **no hay escrow de tokens en el contrato**. El listado solo referencia su `tokenId`; la compra atómica los mueve directamente desde la treasury de la cabaña al comprador.

> **Autorización de la transferencia (B1):** como en la compra firma el comprador (no la cabaña), el contrato **no puede** mover tokens de la treasury sin autorización. La cabaña concede una **allowance HTS/HIP-336** (`AccountAllowanceApproveTransaction`, spender = contrato `MuurketplaceAtomic.sol`); el contrato **consume** esa allowance en el `transferToken` (`0x167`) al ejecutar la compra y la cabaña puede **revocarla** en cualquier momento. Sin allowance suficiente la compra revierte (RF-11).

### Mensaje canónico de compra en HCS (RF-14)

Publicado en el **topic de tasaciones de la Spec 002** (reutilizado, D-01). El campo discriminador `kind = "purchase"` y `specVersion = "005"` lo distinguen inequívocamente del mensaje de tasación de 002 (`specVersion = "001"`), que coexiste en el mismo topic.

```json
{
  "kind": "purchase",
  "specVersion": "005",
  "schemaVersion": 1,
  "bullId": "BRAF-001",
  "assetType": "PAJ_BRAF",
  "tokenId": "0.0.<token>",
  "quantity": 10,
  "listingId": "<listingId>",
  "purchaseId": "<purchaseId generado por el contrato>",
  "buyerAccountId": "0.0.<buyer>",
  "sellerAccountId": "0.0.<cabana>",
  "atomicTxId": "<txId HSCS atómico>",
  "publishedAt": "<ISO-8601>",
  "purchaseKey": "<sha256 estable del mensaje sin purchaseKey>"
}
```

## Requisitos Funcionales (notación EARS)

### Precondición transversal (aplica a todos los RF de tokenización, autorización y compra)

Solo un animal con `apto = true` (Spec 001) **y** proof HCS `VERIFIED` (Spec 002) es tokenizable y comprable. La compra atómica exige además **wallets asociadas** (RF-04/RF-05) y **allowance suficiente de la cabaña al contrato** (RF-06). La asociación de la propia cabaña (RF-04) **no** exige APTO+VERIFIED porque no mueve activos (N3).

- **RF-01 — Tokenizar PAJ-BRAF (par propio por animal/lote):** `CUANDO la cabaña tokenice un animal APTO y VERIFIED, EL SISTEMA creará un token fungible PAJ-BRAF propio de ese animal/lote (0 decimales, supply finito) con claves Admin y Treasury obligatorias —treasury = cuenta de la cabaña—, emitirá el lote completo de pajuelas a la treasury y devolverá su tokenId verificable en HashScan Testnet.`
- **RF-02 — Tokenizar BULL (par propio por animal/lote, 10 unidades):** `CUANDO la cabaña tokenice un animal APTO y VERIFIED, EL SISTEMA creará un token BULL propio de ese animal/lote (fraccionable, 4 decimales, supply máximo 10) con claves Admin y Treasury obligatorias, acuñará sus 10 unidades (o el bullSupply indicado, ≤ 10) a la treasury de la cabaña y devolverá su tokenId y su supply emitido verificables en HashScan Testnet.`
- **RF-03 — Precondición de elegibilidad:** `SI el animal no tiene veredicto apto = true (Spec 001) o su proof HCS no está VERIFIED (Spec 002), ENTONCES EL SISTEMA rechazará la tokenización y la compra sin crear tokens ni mover activos.`
- **RF-04 — Asociar token a wallet de la cabaña:** `CUANDO la cabaña vaya a recibir un activo HTS, EL SISTEMA asociará ese token a la wallet de la cabaña (AssociateTransaction) de forma idempotente (si ya está asociado, no re-asocia ni falla); esta asociación no exige veredicto APTO ni proof VERIFIED porque no mueve activos.`
- **RF-05 — Asociar token a wallet del comprador:** `CUANDO un comprador vaya a recibir un activo HTS, EL SISTEMA asociará ese token a la wallet del comprador antes de la transferencia y, si la asociación no se puede completar, no ejecutará la compra.`
- **RF-06 — Autorizar al contrato vía allowance HTS:** `CUANDO la cabaña vaya a vender tokens de su treasury a través del contrato MuurketplaceAtomic, EL SISTEMA solicitará y registrará una aprobación de allowance HTS/HIP-336 (AccountAllowanceApproveTransaction) de la cabaña a favor del contrato como spender, por una cantidad suficiente para la venta, de forma idempotente y revocable, y devolverá su txId verificable.`
- **RF-07 — Compra atómica de PAJ-BRAF (enteros):** `CUANDO un comprador compre una cantidad entera de PAJ-BRAF dentro del saldo del listado y con allowance suficiente, EL SISTEMA ejecutará la compra atómica del contrato MuurketplaceAtomic (RF-10) que mueva exactamente esa cantidad de PAJ-BRAF desde la treasury de la cabaña al comprador (0 decimales, sin fracciones), cobre el pago y reparta el split en la misma transacción, y devolverá el txId verificable.`
- **RF-08 — Compra atómica de BULL (fracciones):** `CUANDO un comprador compre una fracción de BULL de hasta 4 decimales que no exceda el supply 10 ni el saldo del listado y con allowance suficiente, EL SISTEMA ejecutará la compra atómica del contrato MuurketplaceAtomic (RF-10) que mueva exactamente esa fracción de BULL desde la treasury de la cabaña al comprador, cobre el pago y reparta el split en la misma transacción, y devolverá el txId verificable.`
- **RF-09 — Rechazo de compras inválidas:** `SI la cantidad es fraccionada en PAJ-BRAF, o tiene más de 4 decimales en BULL, o excede el supply 10, o excede el saldo del listado, o el precio unitario es 0 (regla de listado de la Spec 003), ENTONCES EL SISTEMA rechazará la compra sin ejecutar ninguna transacción ni mover activos.`
- **RF-10 — Compra atómica HTS↔HBAR (camino normal):** `CUANDO un comprador compre un activo HTS a precio tasado, con wallets asociadas y allowance suficiente, EL SISTEMA ejecutará una única transacción HSCS en MuurketplaceAtomic.sol (que reemplaza por completo a Muurketplace.sol) que, en la misma llamada, reciba el pago en HBAR, transfiera la cantidad exacta del token HTS desde la treasury de la cabaña al comprador vía el system contract HTS (precompilado 0x167) consumiendo la allowance concedida (RF-06), y reparta el split de regalías según el royaltyPct del listado.`
- **RF-11 — Reversión total ante fallo atómico:** `SI cualquier paso de la compra atómica (RF-10) falla —fondos HBAR insuficientes, saldo o supply insuficiente en la treasury de la cabaña, allowance ausente/insuficiente/revocada, wallet no asociada, o error de red— ENTONCES EL SISTEMA revertirá la transacción HSCS completa sin mover tokens ni HBAR, sin acreditar regalías parciales y sin dejar estado intermedio.`
- **RF-12 — Reutilizar el topic de tasaciones de la Spec 002 (sin topic dedicado):** `CUANDO el sistema deba registrar una compra en HCS, EL SISTEMA reutilizará el topicId de tasaciones ya configurado de la Spec 002 para publicar el mensaje de compra; SI no hay ningún topicId de tasaciones configurado, ENTONCES EL SISTEMA devolverá un error explícito de configuración sin crear un topic nuevo ni un topic paralelo.`
- **RF-13 — Discriminar compra de tasación en el topic compartido:** `EL SISTEMA incluirá en el mensaje de compra un campo discriminador (kind = "purchase" más specVersion = "005") que permita distinguirlo inequívocamente del mensaje de tasación de la Spec 002 (specVersion = "001"), de modo que ambos coexistan en el mismo topic sin ambigüedad ni colisión.`
- **RF-14 — Registrar evento de compra en HCS:** `CUANDO una compra atómica se complete con su transacción HSCS confirmada, EL SISTEMA publicará exactamente un mensaje JSON de compra en el topic de tasaciones reutilizado (RF-12), discriminado como compra (RF-13), con comprador, activo (PAJ_BRAF/BULL), cantidad, listingId, purchaseId y txId, y devolverá la prueba de consenso (topicId, sequenceNumber, consensusTimestamp, transactionId).`
- **RF-15 — Registro en la wallet de ambas partes:** `CUANDO se confirme la compra atómica, EL SISTEMA verificará el débito en la wallet de la cabaña y el crédito en la del comprador (saldos consultables en HashScan Testnet) y devolverá ambos saldos de referencia.`
- **RF-16 — Verificación pública de la compra (verificador propio):** `CUANDO un verificador aporte la prueba de consenso de una compra, EL SISTEMA recuperará el mensaje vía mirror node mediante un verificador de compras propio (separado del verificador de tasación de la Spec 002) y confirmará si coincide íntegramente con la compra reclamada (mismo comprador, activo, cantidad, listingId, purchaseId y txId), distinguiéndolo del mensaje de tasación por su campo discriminador.`
- **RF-17 — Reintentos seguros e idempotencia:** `SI una operación HTS (minteo, asociación, allowance) o HCS (registro de compra) falla por error de red, ENTONCES EL SISTEMA reintentará un número acotado de veces y nunca confirmará sin receipt/txId de la red; MIENTRAS un reintento esté en curso, EL SISTEMA evitará duplicar la operación una vez que la red ya la haya aceptado. La compra atómica (RF-10/RF-11) no requiere reintento parcial: si revierte, no hubo movimiento alguno y puede reintentarse desde cero.`

### Ejemplo de aceptación (no es RF — caso canónico verificable)

- **EA-01 — Caso canónico M_TOTAL = 2.45 (coherente con EA-01 de la Spec 003):** `CUANDO la cabaña tokenice el animal BRAF-001 (APTO + VERIFIED, M_TOTAL = 2.45 → toro $73,500 / dosis $24.50) creando un par de tokens propios PAJ-BRAF (0 decimales, lote completo de 300 pajuelas) y BULL (4 decimales, 10 unidades acuñadas) con claves Admin/Treasury, asocie los tokens a su wallet y el comprador asocie PAJ-BRAF a la suya, y la cabaña conceda al contrato la allowance HTS sobre PAJ-BRAF, y el comprador compre 10 pajuelas a $24.50 cada una (total $245.00 con 5% de regalía), EL SISTEMA ejecutará una única transacción atómica en MuurketplaceAtomic.sol que mueva exactamente 10 PAJ-BRAF de la treasury de la cabaña a la del comprador vía el system contract 0x167 usando la allowance, cobre los $245.00 en HBAR y reparta $12.25 al criador y $232.75 al vendedor (split inmediato half-up equivalente a R-REV-01) —todo o nada, revirtiendo por completo si cualquier paso falla—, y publicará en el topic de tasaciones de la Spec 002 exactamente un mensaje de compra { kind: "purchase", specVersion: "005", assetType: "PAJ_BRAF", quantity: 10, listingId, purchaseId, atomicTxId, buyerAccountId, sellerAccountId } con su prueba de consenso verificable.` Coherente con la Spec 003 EA-01: 10 × $24.50 = $245.00 → $12.25 al criador y $232.75 al vendedor; la Spec 005 aporta la **transferencia HTS atómica** (10 PAJ-BRAF) y el **registro HCS de compra**, reutilizando por equivalencia el split half-up (R-REV-01) de 003 sin recalcularlo ni duplicarlo.

## Requisitos No Funcionales

- **RNF-01 — Separación de capas:** la lógica de cantidades/precio/coordinación y la coincidencia de mensajes de compra vivirán en `src/logic/` (pura, sin SDK de Hedera, sin red, sin `.env`); el acceso a HTS/HCS vivirá en `src/hedera/` —incluido un **verificador de compras propio** (`src/hedera/purchaseVerifier.js`), distinto del `oracleVerifier.js` de 002— y el contrato atómico en `src/contracts/` (`MuurketplaceAtomic.sol`) (constitution §2).
- **RNF-02 — Tests nativos con dobles + 1 E2E gateada:** cada RF tendrá al menos un test ejecutable con `node --test tests/` sin frameworks externos (constitution §1 y §3); los tests de red usarán mocks/dobles sin exigir Testnet, más una única prueba E2E gateada por credenciales Testnet explícitas que no bloquea el verde local. Incluye un **test de equivalencia del split (EA-01)** que compara la implementación pura off-chain (`src/logic/marketplace.js`) con la del contrato: la reutilización de R-REV-01 significa **misma semántica garantizada por este test**, ya que en Solidity la regla se **reimplementa** (N2).
- **RNF-03 — Claves Admin/Treasury obligatorias y nunca expuestas:** todo token creado por esta spec llevará claves Admin y Treasury (constitution §4); el sistema nunca imprimirá, registrará en logs ni commiteará claves privadas, Account IDs reales ni el contenido de `.env`.
- **RNF-04 — Costo acotado:** cada compra consumirá como máximo una transacción HSCS atómica (que incluye el cobro HBAR, la transferencia HTS interna y el split) más una publicación HCS estándar de Testnet; el sistema no multiplicará transacciones por compra (reintentos solo ante fallo real). El número de transacciones de allowance dependerá de su granularidad, a fijar en el plan (D-08), sin multiplicar el costo por compra.
- **RNF-05 — Finalidad y latencia:** la compra atómica y el registro se confirmarán solo cuando la red haya alcanzado finalidad (no antes del receipt/txId); el tiempo típico esperado en Testnet es de pocos segundos.
- **RNF-06 — Verificabilidad pública:** toda wallet, transacción atómica y mensaje de compra será comprobable por un tercero con solo el txId o la prueba de consenso, usando HashScan Testnet o mirror node públicos, sin credenciales del operador.
- **RNF-07 — Solo Testnet:** todas las operaciones se ejecutarán exclusivamente contra Hedera Testnet; cualquier uso de Mainnet requiere aprobación explícita previa (constitution §4).
- **RNF-08 — Idioma:** documentación y comentarios en español; identificadores de código en inglés camelCase (constitution §6).
- **RNF-09 — Atomicidad total:** una compra es indivisible on-chain; nunca queda estado intermedio con tokens movidos sin pago, pago sin tokens, o regalía acreditada parcialmente: cualquier fallo de un paso revierte la transacción HSCS completa (RF-11).

## Supuestos

1. Las Specs 001, 002, 003 y 004 están APROBADAS y son la única definición de *qué* es elegible, cuánto vale, cómo se certifica, cómo se lista/liquida y cómo se persiste; esta spec no recalcula `mTotal`, no reimplementa la lógica pura del split ni redefine el formato del oráculo de tasación.
2. Existen `MY_ACCOUNT_ID` y `MY_PRIVATE_KEY` válidos de Testnet vía `.env` (nunca commiteado); la cabaña es titular de las claves Admin y Treasury del token. Sin esas claves ninguna operación HTS/HCS puede firmarse.
3. **Relación con la Spec 003 (declarada; reabre y reemplaza su alcance):** el contrato de 003 liquida en **HBAR** (`msg.value`) y **no transfiere tokens HTS**. Por decisión explícita del usuario (D-03/D-06), la Spec 005 **reemplaza** `Muurketplace.sol` por `MuurketplaceAtomic.sol`. "**Reemplaza por completo**" significa que `Muurketplace.sol` **deja de ser el contrato operativo** (queda solo como **base lógica histórica**), **preservándose sus capacidades declaradas** de listado, cancelación y consultas. **Se conservan** el ciclo de listado (`createListing`, `cancelListing`) y las consultas públicas (`getListing`, `isSettled`); **se eliminan** el retiro diferido `withdrawRoyalties` y el acumulador `pendingRoyalties` (sustituidos por el **split inmediato** en la transacción atómica); el contrato **lee `royaltyPct` del listado** (fijado al crear, inmutable) como único origen del porcentaje de regalía (B3). **Solo listados nuevos (D-09):** `MuurketplaceAtomic.sol` aplica **únicamente a listados creados tras el reemplazo**; los listados vigentes de 003 **no se migran ni se recrean** y quedan como base lógica/no operativa.
4. **Terminología `BULL`:** en coherencia con AGENTS.md, la Skill y la Spec 003, `BULL` es un **token fungible fraccionable de 4 decimales con supply máximo 10** (no un NFT HTS, que no admite decimales); se le llama "equity fraccionable" por dominio, pero su implementación es fungible con decimales.
5. **Emisión:** al tokenizar se emite el **lote completo** de `PAJ-BRAF` (D-04) y se **acuñan las `bullSupply` unidades de `BULL`** (por defecto 10) a la treasury de la cabaña (B2); cada animal/lote tiene su **par de tokens propio** (D-05), con su `tokenId` y trazabilidad directa en HashScan.
6. La consulta vía mirror node / HashScan puede tener retardo de sincronización de segundos; la verificación debe tolerarlo sin declarar falsos negativos (coherente con Specs 002/004).
7. Esta spec no requiere dependencias nuevas: `@hashgraph/sdk` y `dotenv` ya están aprobadas y en uso (constitution §1).
8. **Topic compartido:** el mensaje de compra coexiste con el de tasación en el **mismo topic de la Spec 002** (D-01); se discrimina por `kind = "purchase"` y `specVersion = "005"` (frente a `"001"`) y no colisiona con el schemaVersion del mensaje de tasación.
9. La **treasury** de los tokens `PAJ-BRAF`/`BULL` es la **cuenta de la cabaña** (D-02), sin custodia compartida. **Los tokens permanecen en esa treasury hasta la compra atómica y no se depositan en escrow en el contrato** (D-07); el listado solo referencia su `tokenId`.
10. **Allowance (B1):** como en la compra firma el comprador, la cabaña **concede al contrato** una allowance HTS/HIP-336 (`AccountAllowanceApproveTransaction`, spender = contrato) **suficiente y revocable** que el contrato **consume** al transferir vía `0x167`; la cabaña puede **revocarla** en cualquier momento. Ciclo de vida: conceder → consumir (por compra) → revocar/renovar. Sin allowance suficiente la compra atómica revierte (RF-11). La **granularidad** (amplia por lote vs. exacta por compra) queda **abierta a decisión del plan** (D-08); esta spec solo exige el comportamiento (suficiente y revocable).
11. **Origen de `purchaseId` (N6):** el `purchaseId` lo **genera el contrato atómico** de forma determinista (p.ej. `keccak256(listingId, quantity, buyer, nonce)`), y es **el mismo identificador que consume el espejo de la Spec 004** como clave de idempotencia; así no se rompe la idempotencia de 004.
12. **Reutilización del split (N2):** on-chain la regla half-up (R-REV-01) **se reimplementa en Solidity**; "reutilizar" significa **misma semántica garantizada por un test de equivalencia (EA-01)** entre `src/logic/marketplace.js` (off-chain puro) y el contrato, no una importación de código.

## Casos límite

- `PAJ-BRAF` con cantidad fraccionada (ej. 1.5 pajuelas) → rechazada: solo enteros (RF-09).
- `BULL` con más de 4 decimales (ej. 0.00001) → rechazada sin transferencia (RF-09).
- `BULL` que excede el supply 10 o el saldo del listado → rechazada sin transferencia (RF-09).
- Compra con cantidad 0 o **precio unitario 0** (regla de listado de 003) → rechazada sin crear registro de compra (RF-09).
- Token no asociado a la wallet del comprador → se asocia antes; si la asociación falla, no se ejecuta la compra y no se mueve nada (RF-05).
- **Allowance ausente/insuficiente/revocada al momento de la compra** → la compra atómica revierte sin mover nada (RF-06/RF-11).
- Animal `apto = false` o proof `PENDING`/`MISMATCH` → ninguna tokenización ni compra (RF-03).
- **Fallo de cualquier paso de la compra atómica** (fondos HBAR insuficientes, saldo/supply insuficiente en la treasury, wallet no asociada o error de red) → la transacción HSCS revierte por completo: no se mueven tokens ni HBAR, no se acredita regalía y no queda estado intermedio (RF-11/RNF-09).
- **Pago HBAR correcto pero transferencia HTS fallaría** → por atomicidad revierte también el pago: nunca se cobra sin entregar tokens ni se entrega sin cobrar.
- **Retiro diferido eliminado (B3):** una llamada al antiguo `withdrawRoyalties` de 003 no existe en `MuurketplaceAtomic.sol`; la regalía se paga en el mismo acto de compra (split inmediato), sin acumulador `pendingRoyalties`.
- Reintento tras timeout de una operación HTS no atómica (minteo/asociación/allowance) → al recuperarse, el sistema detecta la operación ya aceptada y no duplica; ídem para el mensaje HCS (RF-17).
- **Compra atómica confirmada pero registro HCS fallido** → la compra conserva su `atomicTxId` verificable y solo se reintenta la publicación HCS (idempotente por `purchaseId`); nunca se re-ejecuta la compra ni se declara "registrada" sin proof de consenso (RF-14/RF-17).
- **`purchaseId` repetido** (reintento del espejo) → no se re-acredita la regalía ni se duplica la compra (misma clave que consume 004) (N6).
- Treasury sin saldo de `PAJ-BRAF` (lote agotado) o de `BULL` (10 ya transferido) → la compra atómica revierte sin mover tokens ni cobrar.
- **Sin escrow (D-07):** el listado referencia su `tokenId` y los tokens siguen en la treasury de la cabaña; si la treasury no tiene el saldo/`tokenId` del listado, la compra atómica revierte (no hay reserva de tokens en el contrato).
- Mirror node aún no sincronizado al verificar la compra → la verificación informa `PENDING`, no un falso negativo (RF-16).
- **Topic de tasaciones compartido:** un mensaje de compra (`kind = "purchase"`, `specVersion = "005"`) nunca se confunde con uno de tasación (`specVersion = "001"`) al filtrar por el campo discriminador (RF-13); el verificador de compras (RF-16) lo trata sin usar el `oracleVerifier.js` de 002.
- Mensaje de compra con un campo alterado (ej. `quantity` 10 vs 11) → la verificación falla por no coincidencia íntegra (RF-16).
- Claves Admin/Treasury ausentes o inválidas → fallo explícito antes de tocar la red, sin crear tokens.

## Criterios de finalización (criterios de aceptación verificables)

1. Existe `specs/005-flujo-tokenizacion-venta/spec.md` con los RF-01 a RF-17 en notación EARS, el ejemplo EA-01 (M_TOTAL = 2.45), ambas capas (dentro/fuera de alcance), la reapertura/reemplazo explícito del contrato de la Spec 003 y trazabilidad a constitution.
2. Cada RF-01 a RF-17 tiene al menos un test en `tests/` ejecutable con `node --test tests/` en verde (los de red/contrato con mocks/dobles, sin requerir Testnet en CI; más una única E2E gateada por credenciales Testnet). Incluye el **test de equivalencia del split (EA-01)** entre `src/logic/marketplace.js` y el contrato (N2).
3. El caso EA-01 reproduce: tokenización de `BRAF-001` (par de tokens propios `PAJ-BRAF` 0 decimales con lote completo / `BULL` 4 decimales con 10 unidades acuñadas) con claves Admin/Treasury; allowance de la cabaña al contrato (RF-06); **compra atómica** en `MuurketplaceAtomic.sol` que mueve exactamente 10 `PAJ-BRAF` de la treasury de la cabaña al comprador vía `0x167` y cobra los $245.00 con split inmediato $12.25/$232.75 en la misma transacción; registro del débito de la cabaña y del crédito del comprador en sus wallets (RF-15); mensaje HCS de compra publicado en el topic de la Spec 002 y discriminado con `kind`/`specVersion`, con su proof de consenso; y coherencia con los importes de la Spec 003 EA-01 sin recalcular el split.
4. Se distinguen dos clases de intento fallido, cada una verificable por un tercero:
   - **Rechazos pre-red (RF-09):** `PAJ-BRAF` fraccionado, `BULL` con > 4 decimales / > supply 10 / > saldo, o precio 0 → no se crea ninguna transacción (verificable por ausencia de txId nuevo).
   - **Fallo atómico (RF-11):** allowance ausente/insuficiente/revocada, fondos HBAR insuficientes, saldo/supply insuficiente o wallet no asociada → la transacción HSCS existe pero queda **revertida** con estado `FAIL` (verificable en HashScan por el estado de la transacción), sin movimiento de saldos (ni tokens ni HBAR) y sin regalía acreditada.
5. Un fallo en cualquier paso de la compra atómica revierte la transacción HSCS completa: no se mueven tokens ni HBAR y no se acredita regalía parcial (verificable por ausencia de transferencia y de saldo).
6. Toda compra atómica y mensaje HCS de compra exitosos devuelven transacción/proof visibles en `hashscan.io/testnet`, con el saldo reflejado en ambas wallets (RF-15); la verificación por el **verificador de compras propio** confirma la compra y la de un mensaje alterado la niega (`MISMATCH`), sin confundirla con un mensaje de tasación del mismo topic.
7. Ningún archivo de `src/logic/` importa `@hashgraph/sdk` ni accede a `.env` o red; el verificador de compras vive en `src/hedera/` y **no altera** el `oracleVerifier.js` de 002; ninguna clave privada ni Account ID real aparece en el repo, logs o tests.
8. Ninguna operación apunta a Mainnet; no se instaló ninguna dependencia nueva; el split (R-REV-01) se **reimplementa** en Solidity con equivalencia verificada por test; y `MuurketplaceAtomic.sol` declara la preservación de `createListing`/`cancelListing` y la eliminación del retiro diferido (B3).
9. **La verificación real de la reversión atómica y del movimiento vía `0x167` depende de la E2E gateada en Testnet**; el nivel mock solo verifica orquestación, validación y composición de mensajes, no la atomicidad on-chain (N5).
10. Veredicto `APROBADO` del revisor SDD (`/sdd-validate`) y `MEMORY.md` actualizado.

## Dudas abiertas

### Decisiones cerradas (ex D-01 a D-07 y D-09)

- **D-01 [CERRADA] — Topic HCS de compras:** **se reutiliza el `topicId` de tasaciones de la Spec 002**; no se crea un topic dedicado (RF-12/RF-13). Trade-off aceptado: historial de compras y catálogo de tasaciones coexisten en el mismo topic, discriminados por `kind = "purchase"`/`specVersion = "005"`.
- **D-02 [CERRADA] — Treasury:** la treasury de `PAJ-BRAF`/`BULL` es la **cuenta de la cabaña**, sin custodia compartida.
- **D-03 [CERRADA] — Atomicidad:** **es obligatoria**. La transferencia HTS y el pago/split son **atómicos on-chain en una sola transacción HSCS**. Reabre/reemplaza el contrato de 003 con `MuurketplaceAtomic.sol` (RF-10/RF-11/RNF-09).
- **D-04 [CERRADA] — Emisión PAJ-BRAF:** se emite el **lote completo** al tokenizar.
- **D-05 [CERRADA] — Granularidad de tokens:** **un par de tokens (`PAJ-BRAF` + `BULL`) por animal/lote**.
- **D-06 [CERRADA] — Contrato:** `MuurketplaceAtomic.sol` **reemplaza por completo** a `Muurketplace.sol`, que queda como **base lógica histórica** de 003; el split half-up (R-REV-01) se reutiliza por equivalencia, no se duplica.
- **D-07 [CERRADA] — Custodia de tokens:** los tokens permanecen en la **treasury de la cabaña** hasta la compra atómica; el listado referencia su `tokenId` y **no hay escrow** en el contrato.
- **D-09 [CERRADA] — Listados de 003:** **solo listados nuevos**. `MuurketplaceAtomic.sol` aplica únicamente a listados creados tras el reemplazo; los listados vigentes de `Muurketplace.sol` (003) **no se migran ni se recrean** y quedan como base lógica/no operativa.

### Dudas diferidas al Plan

- **D-08 [DIFERIDA AL PLAN] — Granularidad de la allowance:** la spec exige el **comportamiento** (allowance HTS suficiente y revocable, RF-06), sin fijar si es **amplia revocable por lote** o **exacta por compra**; la decisión se tomará en la fase de Plan sin cambiar el QUÉ de esta spec.

No quedan dudas bloqueantes abiertas en la spec; D-08 se resolverá en el plan.

## Trazabilidad a constitution

| Requisito | Principio constitution |
|-----------|------------------------|
| Precondición transversal y RF-03 (solo APTO de 001 + VERIFIED de 002; sin redefinir umbrales ni valores base) | §5 Fuente de verdad biológica (solo tokeniza lo que 001 decidió con respaldo PEGBraf y 002 certificó) |
| RNF-01 (lógica pura en `src/logic/` sin SDK; capa HTS/HCS/HSCS en `src/hedera/` y `src/contracts/`, con verificador de compras propio) | §2 Separación de lógica e infraestructura |
| RF-12, RF-13 (reutilizar el topic HCS de la Spec 002 sin crear topic nuevo; discriminador de mensaje) | §2 Separación de lógica e infraestructura (la capa `src/hedera/` reutiliza el topic de 002, sin lógica de negocio en la capa de red) |
| RF-01 a RF-17 + RNF-02, Criterios 2/3/4/5/6/9 (incluye test de equivalencia del split) | §3 Política de tests (1 test por RF, TDD; dobles sin red + 1 E2E gateada) |
| RF-01, RF-02, RF-04, RF-05, RF-06, RNF-03, Supuesto 2, Criterio 7 | §4 Protección de datos y seguridad (claves Admin/Treasury obligatorias, allowance HIP-336 sin exponer claves, nunca `.env`/claves en repo o logs, nunca Mainnet sin aprobación) |
| RF-07, RF-08, RF-10, RF-11, Supuesto 9 (custodia: tokens en la treasury de la cabaña, sin escrow, D-07) | §4 Protección de datos y seguridad (nunca se dejan activos bloqueados en un contrato intermedio) |
| RNF-08 | §6 Idioma (español docs, inglés código) |
| RF-10, RF-11, RNF-09, Supuesto 3 (compra atómica HSCS `MuurketplaceAtomic.sol` con transferencia HTS vía `0x167`; reemplaza el contrato de 003 preservando listado y eliminando el retiro diferido) | §1 Stack bloqueado (Hedera exclusivamente: HTS + HSCS en la misma red; sin dependencias nuevas) |
| Supuesto 11 (origen de `purchaseId` por el contrato, igual al usado por 004) | §2 Separación de lógica e infraestructura (contrato y espejo comparten la misma clave de idempotencia sin acoplar capas) |
| Criterios de finalización (tests en verde + revisión contra RF) | §7 Criterio de "Hecho" (`node --test` en verde + revisión contra RF) |
| Fuera de alcance (sin motor 001, sin oráculo/verificador de tasación 002, sin espejo 004, sin minteo del script demo; el contrato de 003 se reemplaza vía `MuurketplaceAtomic.sol`, no se reimplementa su lógica pura) y Supuesto 7 (sin dependencias nuevas) | §1 Stack bloqueado (solo Hedera; sin dependencias nuevas sin aprobación) |
