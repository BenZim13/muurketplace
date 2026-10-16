# Tasks — Spec 003 Marketplace y Liquidación de Regalías en HSCS

> Spec origen APROBADA: `specs/003-marketplace-regalias/spec.md` (RF-01 a RF-08 + EA-01 canónico M_TOTAL 2.45).
> Plan técnico APROBADO: `specs/003-marketplace-regalias/plan.md` (§§1–8, R-REV-01 a R-REV-04).
> Constitución: `docs/constitution.md` §§1–7.

## Instrucciones para el Implementer (una tarea a la vez, TDD estricto)

1. Ejecutar **exactamente una tarea por sesión** en orden secuencial (Tarea N requiere Tarea N-1 en verde).
2. Ciclo TDD obligatorio por tarea: **test rojo → código mínimo → test verde**.
3. Stack: Node.js CommonJS (`require`/`module.exports`), `node:test` + `node:assert/strict`, sin frameworks, sin `npm install`. Contrato en Solidity `^0.8` solo Testnet.
4. Tras cada cambio: `node --test tests/` debe seguir en verde (sin regresiones de Spec 001 ni Spec 002).
5. Lógica 100% pura en `src/logic/marketplace.js`: prohibido `@hashgraph/sdk`, `process.env`, red/`fetch`, `fs`, `Date.now`, `Math.random`. Todo Hedera vive en `src/hedera/` + `config/` + `src/contracts/`.
6. Tests con **mocks inyectados, sin red** (`verifyFn`, `contractExec`, `mirrorFetch`). Único test con red: Tarea 8 E2E gateada.
7. No tocar `src/logic/constants.js`, `validator.js`, `pricing.js`, `evaluateBull.js`, `oracleMessage.js`, `src/hedera/hcsClient.js`, `oracleVerifier.js` ni `tokenizarToro.js`. Solo reutilizarlos.
8. Solo Testnet: prohibido `forMainnet` / `mainnet`. Nunca commitear `.env` ni claves. Precios on-chain en céntimos enteros; cantidades BULL en diezmilésimas.
9. Marcar el checkbox `- [ ]` → `- [x]` solo cuando el criterio "Hecho cuando" se cumpla verificado.

## Cadena de dependencias

```
T1 (config habilitadora) → T2 (split puro RF-05 + EA-01) → T3 (reglas listado/compra RF-01/RF-03/RF-04)
→ T4 (settlement RF-06/RF-08) → T5 (contrato Muurketplace.sol) → T6 (client listar/comprar RF-01/RF-02/RF-04)
→ T7 (client liquidar/cancelar/fallo RF-06/RF-07/RF-08) → T8 (E2E gateada criterio 5)
→ T9 (pureza+seguridad+cierre)
```

---

## Tarea 1: Config del marketplace + cliente base (habilitadora)
- **RF cubiertos:** Ninguno (habilitadora; base para RF-01, RF-04)
- **Archivos:** `config/marketplace.config.js`, `.env.example`, `tests/marketplaceConfig.test.js`
- **Hecho cuando:** `node --test tests/marketplaceConfig.test.js` pasa en verde Y `loadMarketplaceConfig` con env válido devuelve `contractId` Testnet y sin env devuelve `contractId: null` sin tocar red.
- **Depende de:** Nada (primera tarea).
- [x] TDD: crear `config/marketplace.config.js` con función `loadMarketplaceConfig(env)` que lee solo `MARKETPLACE_CONTRACT_ID` (ausente → `contractId: null`), valida formato `0.0.<n>` (malformada → error explícito de configuración inválida), devuelve red fija `testnet` más timeout de confirmación operativo; documentar `MARKETPLACE_CONTRACT_ID=0.0.000000` ficticio en `.env.example` sin valores reales; tests con envs falsos (vacío, válido, malformado) sin red ni SDK real.

## Tarea 2: Split puro half-up con residuo al vendedor + EA-01
- **RF cubiertos:** RF-05, EA-01 (parcial: reparto canónico)
- **Archivos:** `src/logic/marketplace.js`, `tests/marketplace.test.js`
- **Hecho cuando:** `node --test tests/marketplace.test.js` pasa en verde Y `calculateSplit(245.00, 5)` devuelve exactamente `royalty 12.25` y `seller 232.75` con invariante `royalty + seller === total`.
- **Depende de:** Tarea 1.
- [x] TDD según plan §2.2 (R-REV-01): implementar en `src/logic/marketplace.js` solo `roundHalfUp2` reutilizado desde `pricing.js` (sin duplicar semántica) y `calculateSplit(totalUsd, royaltyPct)` que valida rango 0–100, calcula regalía con half-up a 2 decimales trabajando en céntimos enteros y obtiene la parte del vendedor por resta exacta; tests del caso EA-01, de bordes de medio céntimo (ej. porcentaje con tercer decimal que genera residuo), de invariante suma-exacta en varios totales, y de rechazos con porcentaje -1 y 101, más casos 0% (regalía 0) y 100% (vendedor 0) registrados explícitamente.

## Tarea 3: Reglas puras de listado y compra (precio tasado + cantidades)
- **RF cubiertos:** RF-01, RF-03, RF-04
- **Archivos:** `src/logic/marketplace.js`, `tests/marketplace.test.js`
- **Hecho cuando:** `node --test tests/marketplace.test.js` pasa en verde Y precio distinto de la tasación lanza, `PAJ_BRAF` 1.5 lanza y `BULL` 0.0001 acepta.
- **Depende de:** Tarea 2.
- [x] TDD según plan §2.2: implementar `validateListingParams(params, certifiedValuation)` que exige presencia de `proof` con referencia, precio unitario idéntico a la tasación certificada (comparación exacta a 2 decimales), cantidad mayor que cero con reglas por activo (`PAJ_BRAF` solo enteros, `BULL` máximo 4 decimales y máximo 10), porcentaje 0–100, e `validatePurchaseParams(purchase, listing)` que exige listado no cancelado, mismas reglas de cantidad más disponible suficiente y total pagado idéntico al redondeo half-up de precio por cantidad; tests de precio alterado, de cantidades límite (0, 1.5 pajuelas, 5 decimales, mayor que 10, mayor que disponible, total que no cuadra) y de aceptaciones canónicas (10 pajuelas a 24.50, fracción 0.0001 BULL).

## Tarea 4: Settlement puro sin doble pago + cancelación que preserva saldos
- **RF cubiertos:** RF-06, RF-08
- **Archivos:** `src/logic/marketplace.js`, `tests/marketplace.test.js`
- **Hecho cuando:** `node --test tests/marketplace.test.js` pasa en verde Y el segundo retiro del mismo `purchaseId` lanza mientras el retiro posterior a una cancelación sigue válido.
- **Depende de:** Tarea 3.
- [x] TDD según plan §2.2: implementar `applySettlement(purchaseId, split, balances)` que acredita regalía al criador y resto al vendedor marcando el `purchaseId` como liquidado y lanza ante doble retiro, más la regla de cancelación (listado cancelado bloquea nuevas compras pero preserva saldos ya acreditados para retiro); tests de acreditación correcta del EA-01 (12.25 al criador, 232.75 al vendedor), de doble retiro denegado, y de compra tras cancelación rechazada con retiro pendiente aún válido.

## Tarea 5: Contrato Muurketplace.sol (estado on-chain mínimo Testnet)
- **RF cubiertos:** RF-01, RF-04, RF-05, RF-06, RF-07, RF-08 (ejecución on-chain)
- **Archivos:** `src/contracts/Muurketplace.sol`, `tests/marketplace.test.js` (solo asserts estáticos de ABI, sin desplegar)
- **Hecho cuando:** `node --test tests/marketplace.test.js` pasa en verde Y el contrato compila para Hedera Testnet, no expone ningún setter de porcentaje y todo `require` fallido revierte sin mover fondos.
- **Depende de:** Tarea 4.
- [x] Crear `src/contracts/Muurketplace.sol` según plan §2.3 (T-06, R-REV-03, T-07): estructura de listado con precio en céntimos enteros, disponible, porcentaje inmutable sin setter, beneficiario criador, vendedor, referencia de proof y bandera de cancelación, más mapas de regalías pendientes y compras liquidadas; funciones de crear listado (exige referencia de proof no vacía, acepta 0% y 100%), comprar (exige cantidad válida y pago exacto, calcula split con la misma regla half-up más resta, emite evento de compra liquidada), retirar regalías (transfiere pendiente y marca liquidado, segundo intento revierte), y cancelar listado (cierra a nuevas compras sin tocar pendientes); verificación con tests estáticos que leen el fuente y fallan si aparece setter de regalía, si aparece red Mainnet o si falta el evento de liquidación, sin desplegar ni tocar red.

## Tarea 6: Client listar y comprar con guarda VERIFIED (mocks)
- **RF cubiertos:** RF-01, RF-02, RF-04
- **Archivos:** `src/hedera/marketplaceClient.js`, `tests/marketplaceClient.test.js`
- **Hecho cuando:** `node --test tests/marketplaceClient.test.js` pasa en verde Y proof no-VERIFIED deja `contractExec` en 0 llamadas mientras proof VERIFIED deja exactamente 1 llamada con identificadores y transacción.
- **Depende de:** Tarea 5.
- [x] TDD según plan §2.3 (T-04): implementar `createListing` y `buy` en `src/hedera/marketplaceClient.js` que primero validan en puro sin red, luego exigen veredicto `VERIFIED` vía `verifyFn` inyectada (reutiliza `oracleVerifier`) y solo entonces invocan al `contractExec` inyectado devolviendo identificadores más `txId` más reparto; tests con dobles mock que verifican rechazo sin mover fondos ante estados no verificados o tasación alterada en un decimal, éxito con 1 llamada ante prueba válida, y registro de compra con cantidad y transacción verificables.

## Tarea 7: Client liquidar, cancelar y reembolso ante fallo (mocks)
- **RF cubiertos:** RF-06, RF-07, RF-08
- **Archivos:** `src/hedera/marketplaceClient.js`, `tests/marketplaceClient.test.js`
- **Hecho cuando:** `node --test tests/marketplaceClient.test.js` pasa en verde Y el fallo del contrato no acredita compra ni regalía, el doble retiro es denegado y la cancelación preserva el retiro pendiente.
- **Depende de:** Tarea 6.
- [x] TDD según plan §2.3 (T-07, R-REV-02): implementar `withdrawRoyalties`, `cancelListing` y las consultas públicas de solo lectura (`getListing`, `getPurchase`, `getSettlement`) que no calculan ni validan negocio y solo devuelven estado más referencias HashScan; tests con `contractExec` mock que revierte (propaga fallo como reembolso sin acreditar parciales), con segundo retiro del mismo saldo denegado, con compra tras cancelación rechazada pero retiro posterior válido, y con consultas que devuelven estado sin exigir claves.

## Tarea 8: E2E Testnet gateada criterio 5 + EA-01 real
- **RF cubiertos:** RF-04, RF-05, RF-06, criterio 5 spec (R-REV-04)
- **Archivos:** `tests/marketplaceIntegration.test.js`
- **Hecho cuando:** Con `RUN_MARKETPLACE_INTEGRATION=1` ejecuta el EA-01 real en Testnet con reparto exacto 245.00 / 12.25 / 232.75 y enlaces `hashscan.io/testnet` visibles; sin la variable se salta (`skip`) y `node --test tests/` sigue en verde sin red.
- **Depende de:** Tarea 7.
- [x] Crear `tests/marketplaceIntegration.test.js` gateado que solo corre con `RUN_MARKETPLACE_INTEGRATION=1` más `MY_ACCOUNT_ID` / `MY_PRIVATE_KEY` / `MARKETPLACE_CONTRACT_ID` más proof VERIFIED real de la Spec 002: lista con 5% de regalía, compra 10 pajuelas a 24.50, verifica totales y reparto pactado, retira 12.25, reintenta retiro (rechazado sin doble pago), imprime enlaces HashScan de cada transacción, y verifica por mirror que el reparto coincide y que un reparto alterado no coincide; nunca corre en CI por defecto.

## Tarea 9: Antirregresión pureza/seguridad + cierre y verificación total
- **RF cubiertos:** RNF-01, RNF-02, RNF-07, RNF-08 (antirregresión; verifica RF-01 a RF-08 + EA-01)
- **Archivos:** `tests/purity.test.js`, `tests/` (solo verificación, sin cambios en `src/logic/` salvo lo necesario)
- **Hecho cuando:** `node --test tests/` pasa 100% en verde sin red Y los greps de pureza/seguridad devuelven vacío (cero SDK en lógica, cero Mainnet, cero claves).
- **Depende de:** Tarea 8.
- [x] Extender `tests/purity.test.js` para que lea cada archivo de `src/logic/` y falle si contiene SDK de Hedera, acceso a entorno, red, tiempo o aleatoriedad, más asserts de `src/**` y `config/**` sin referencias a Mainnet y de `tests/`, `config/`, `src/contracts/` sin claves ni identificadores reales salvo ejemplo ficticio; correr `node --test tests/` completo en verde como criterio de finalización de la spec (listo para `/sdd-validate` más actualización de `MEMORY.md` fuera de esta spec).

## Matriz final de cobertura (verificación del revisor)

| RF / EA / RNF | Tarea | Archivo de test |
|---------------|-------|-----------------|
| RF-01 | T3 + T5 + T6 | `tests/marketplace.test.js` + `tests/marketplaceClient.test.js` |
| RF-02 | T6 | `tests/marketplaceClient.test.js` |
| RF-03 | T3 | `tests/marketplace.test.js` |
| RF-04 | T3 + T5 + T6 + T8 E2E | `tests/marketplace.test.js` + `tests/marketplaceClient.test.js` + `tests/marketplaceIntegration.test.js` |
| RF-05 | T2 + T5 + T8 E2E | `tests/marketplace.test.js` + `tests/marketplaceIntegration.test.js` |
| RF-06 | T4 + T7 + T8 E2E | `tests/marketplace.test.js` + `tests/marketplaceClient.test.js` + `tests/marketplaceIntegration.test.js` |
| RF-07 | T5 + T7 | `tests/marketplaceClient.test.js` |
| RF-08 | T4 + T5 + T7 | `tests/marketplace.test.js` + `tests/marketplaceClient.test.js` |
| EA-01 (2.45 → 10×24.50=245.00 → 12.25/232.75, retiro único 12.25) | T2 + T4 + T8 | `tests/marketplace.test.js` + `tests/marketplaceIntegration.test.js` |
| Criterio 5 (HashScan Testnet) | T8 | `tests/marketplaceIntegration.test.js` (gateado) |
| RNF-01/RNF-02/RNF-07/RNF-08 | T9 | `tests/purity.test.js` |
| Habilitadora config | T1 | `tests/marketplaceConfig.test.js` |
