# Tasks — Spec 001 Motor de Validación y Tasación

> Spec origen APROBADA: `specs/001-motor-validacion-tasacion/spec.md` (16 RF + EA-01).
> Plan técnico: `specs/001-motor-validacion-tasacion/plan.md` (§§1–8).
> Constitución: `docs/constitution.md` §§1–7.

## Instrucciones para el Implementer (una tarea a la vez, TDD estricto)

1. Ejecutar **exactamente una tarea por sesión** en orden secuencial (Tarea N requiere Tarea N-1 en verde).
2. Ciclo TDD obligatorio por tarea: **test rojo → código mínimo → test verde**.
3. Stack: Node.js CommonJS (`require`/`module.exports`), `node:test` + `node:assert/strict`, sin frameworks, sin `npm install`.
4. Tras cada cambio: `node --test tests/` debe seguir en verde (sin regresiones).
5. Lógica 100% pura: prohibido `@hashgraph/sdk`, `.env`/`process.env`, red/`fetch`, `fs`, `Date`/`Date.now`, `Math.random` en `src/logic/`.
6. No tocar `tokenizarToro.js` ni crear `src/hedera/` en esta spec.
7. Marcar el checkbox `- [x]` solo cuando el criterio "Hecho cuando" se cumpla verificado.

## Cadena de dependencias

```
T1 (esqueleto) → T2 (barreras) → T3 (rechazo total) → T4 (precisión RF-01/RF-10)
→ T5 (bonos) → T6 (tasación half-up) → T7 (fachada + EA-01) → T8 (pureza + cierre)
```

---

## Tarea 1: Esqueleto constants + stubs TDD
- **RF cubiertos:** Ninguno (habilitador; referencia para todos los RF)
- **Archivos:** `src/logic/constants.js`, `src/logic/validator.js`, `src/logic/pricing.js`, `src/logic/evaluateBull.js`, `tests/constants.test.js`
- **Hecho cuando:** `node --test tests/` pasa en verde Y `require` de los 4 módulos no lanza y las constantes están congeladas (`Object.isFrozen`).
- **Depende de:** Nada (primera tarea).
- [x] Crear `src/logic/constants.js` con `VALOR_BASE_TORO_USD=30000`, `VALOR_BASE_DOSIS_USD=10`, umbrales (100, 300, 450, 730, 1.5, 70, 0.0, 15.0, 30.0, 2.0, 3.0) y bonos (0.50, 0.15, 0.50, 0.20, 0.30) exportados con `Object.freeze` (T-07 del plan); crear stubs `validateBull`, `calculateMTotal`, `calculateBullPrice`, `calculateDosePrice`/`roundHalfUp2`, `evaluateBull` que lanzan `Error("no implementado")`; test humo en `tests/constants.test.js` que verifica valores y congelamiento (TDD: test rojo con stubs → verde al definir constantes).

## Tarea 2: Validator barreras inclusivas RF-02 a RF-05 + RF-07
- **RF cubiertos:** RF-02, RF-03, RF-04, RF-05, RF-07
- **Archivos:** `src/logic/validator.js`, `tests/validator.test.js`
- **Hecho cuando:** `node --test tests/validator.test.js` pasa en verde Y los 8 bordes justo-dentro/justo-fuera están cubiertos (99/100/300/301, 449/450/730/731, 1.49/1.5, 69/70).
- **Depende de:** Tarea 1.
- [x] TDD en `validateBull(data)`: implementar solo las 4 barreras con comparaciones inclusivas exactas sin epsilon (T-04), acumulando todos los motivos en `motivosRechazo` sin cortocircuito; tests con resto de inputs canónicos APTOS y casos pareados de borde por cada RF más test agregado RF-07 (100+450+1.5+70 simultáneos → APTO); no tratar ausentes/inválidos aquí (van en Tarea 3) salvo guardar `SI existe` para no duplicar motivos.

## Tarea 3: Rechazo total RF-06 (ausentes, inválidos, triple-null)
- **RF cubiertos:** RF-06
- **Archivos:** `src/logic/validator.js`, `src/logic/evaluateBull.js`, `tests/validator.test.js`, `tests/evaluateBull.test.js`
- **Hecho cuando:** `node --test tests/validator.test.js tests/evaluateBull.test.js` pasa en verde Y `evaluateBull` con cualquier fallo devuelve triple-`null` (`mTotal`, `tasacionToroUsd`, `tasacionDosisUsd === null`) con todos los motivos listados.
- **Depende de:** Tarea 2.
- [x] TDD: detectar cada uno de los 9 campos requeridos 1–9 con `=== undefined || === null` (nunca falsy, T-05) emitiendo `campo ausente: <campo>`; detectar físicamente imposibles (edades ≤ 0, CE ≤ 0, motilidad < 0 o > 100, AOB < 0) solo si el campo existe; test multi-barrera simultánea (`motivosRechazo.length ≥ 2`), test por cada campo ausente, test de inválidos físicos, y test vía `evaluateBull` de triple-`null` sin tasación parcial (puede ser stub parcial de fachada que solo aplica la rama de rechazo).

## Tarea 4: Invariante precisión RF-01 + crecimiento RF-10
- **RF cubiertos:** RF-01, RF-10
- **Archivos:** `src/logic/pricing.js`, `tests/pricing.test.js`
- **Hecho cuando:** `node --test tests/pricing.test.js` pasa en verde Y `pesoDestateDep = 16.4` exacto otorga el bono RF-10 (el test falla si el valor se redondea a 15 o 20).
- **Depende de:** Tarea 3.
- [x] TDD en `calculateMTotal(data)`: implementar base `m = 1.0` (RF-08, solo lo necesario para este test) más regla RF-10 con `AND` estricto (`pesoDestateDep > 15.0 Y pesoFinalDep > 30.0`, comparaciones directas sin epsilon); tests de tabla AND (ambos OK → +0.15; solo uno OK → sin bono; 15.0/30.0 exactos → sin bono) más test RF-01 (`16.4/32.6` exactos → bono; documenta que variante redondeada daría distinto `M_TOTAL`); no implementar RF-09/RF-11/RF-12/RF-13 aún.

## Tarea 5: Bonos pricing RF-08, RF-09, RF-11/RF-12, RF-13
- **RF cubiertos:** RF-08, RF-09, RF-11, RF-12, RF-13
- **Archivos:** `src/logic/pricing.js`, `tests/pricing.test.js`
- **Hecho cuando:** `node --test tests/pricing.test.js` pasa en verde Y las 5 reglas × 2 ramas están cubiertas (con bono / sin bono) incluyendo no-acumulación AOB (3.0 → +0.50, nunca +0.70).
- **Depende de:** Tarea 4.
- [x] TDD: completar `calculateMTotal` con RF-09 (`pesoNacerDep <= 0.0` → +0.50; tests -0.5 y 0.0 sí, 0.01 no), AOB con `else-if` (T-02: `>= 3.0` → +0.50 sino `>= 2.0` → +0.20; tests 1.99→+0, 2.0/2.99→+0.20, 3.0/3.2→+0.50 y assert nunca +0.70), RF-13 (`grasaIntramuscularTop5 === true` estricto, T-06; tests `true`→+0.30, `false`/`1`→+0), test RF-08 (toro sin bonos → `M_TOTAL = 1.0`) y test supuesto 3 (mismo toro con distinto `volumenEyaculadoMl`/`pajuelasProducidas` → idéntico `M_TOTAL`, riesgo R-05).

## Tarea 6: Tasación RF-14 + RF-15 half-up a 2 decimales
- **RF cubiertos:** RF-14, RF-15
- **Archivos:** `src/logic/pricing.js`, `tests/pricing.test.js`
- **Hecho cuando:** `node --test tests/pricing.test.js` pasa en verde Y `2.45 → 73500 / 24.50` y el borde half-up `1.005 → 1.01` redondea hacia arriba (no banker's).
- **Depende de:** Tarea 5.
- [x] TDD: implementar `calculateBullPrice(mTotal) = 30000 * mTotal` (entero USD, RF-14) y `roundHalfUp2` + `calculateDosePrice(mTotal) = roundHalfUp2(10 * mTotal)` con `Math.floor(x*100+0.5+EPSILON)/100` sin `toFixed` ni librerías (T-03); tests de toro entero (1.0→30000, 2.45→73500), de dosis (1.0→10.00, 2.45→24.50) y de borde half-up; `mTotal` comparado con tolerancia `1e-9` donde aplique (riesgo R-01 documentado en el test).

## Tarea 7: Fachada evaluateBull + salida APTO RF-16 + EA-01 canónico 2.45
- **RF cubiertos:** RF-06, RF-16, EA-01
- **Archivos:** `src/logic/evaluateBull.js`, `tests/evaluateBull.test.js`
- **Hecho cuando:** `node --test tests/evaluateBull.test.js` pasa en verde Y el caso canónico devuelve exactamente `{ apto: true, motivosRechazo: [], mTotal: 2.45, tasacionToroUsd: 73500, tasacionDosisUsd: 24.50 }` (`mTotal` con tolerancia `1e-9`, enteros con igualdad estricta).
- **Depende de:** Tarea 6.
- [x] TDD según pseudocódigo del plan §2.4: `validateBull` → si NO apto devolver triple-`null` (RF-06), si apto `calculateMTotal` + `calculateBullPrice` + `calculateDosePrice` con `motivosRechazo = []` (RF-16); tests de salida APTO completa non-null, de rechazo triple-`null` vía fachada, y test EA-01 con los 9 inputs de referencia (`pesoNacerDep=-0.5, pesoDestateDep=16.0, pesoFinalDep=32.0, edadDesteDias=210, edadPesoFinalDias=540, circunferenciaEscrotalCm=2.0, motilidadSeminalPct=80, areaOjoBifeCm2=3.2, grasaIntramuscularTop5=true`) verificando desglose 1.0+0.50+0.15+0.50+0.30=2.45.

## Tarea 8: Antirregresión pureza (sin SDK) + cierre y verificación total
- **RF cubiertos:** RNF-01, RNF-02, RNF-03, RNF-04 (antirregresión; verifica RF-01 a RF-16 + EA-01)
- **Archivos:** `tests/purity.test.js`, `tests/` (solo verificación, sin cambios en `src/logic/`)
- **Hecho cuando:** `node --test tests/` pasa 100% en verde Y el grep de pureza devuelve vacío (`hashgraph`, `process.env`, `fetch`, `Math.random`, `Date.now`).
- **Depende de:** Tarea 7.
- [x] TDD: crear `tests/purity.test.js` que lee cada archivo de `src/logic/` y falla si contiene `require('@hashgraph/sdk')`, `process.env`, `fetch(`, `Math.random` o `Date.now` (riesgo R-06), más verificación de matriz de cobertura (1 test por RF-01…RF-16 + EA-01 y 100% ramas RF-09–RF-13 según plan §5); correr `node --test tests/` completo en verde como criterio de finalización de la spec (listo para `/sdd-validate`).

## Matriz final de cobertura (verificación del revisor)

| RF / EA | Tarea | Archivo de test |
|---------|-------|-----------------|
| RF-01 | T4 | `tests/pricing.test.js` |
| RF-02 | T2 | `tests/validator.test.js` |
| RF-03 | T2 | `tests/validator.test.js` |
| RF-04 | T2 | `tests/validator.test.js` |
| RF-05 | T2 | `tests/validator.test.js` |
| RF-06 | T3 + T7 | `tests/validator.test.js` + `tests/evaluateBull.test.js` |
| RF-07 | T2 | `tests/validator.test.js` |
| RF-08 | T4 + T5 | `tests/pricing.test.js` |
| RF-09 | T5 | `tests/pricing.test.js` |
| RF-10 | T4 | `tests/pricing.test.js` |
| RF-11 | T5 | `tests/pricing.test.js` |
| RF-12 | T5 | `tests/pricing.test.js` |
| RF-13 | T5 | `tests/pricing.test.js` |
| RF-14 | T6 | `tests/pricing.test.js` |
| RF-15 | T6 | `tests/pricing.test.js` |
| RF-16 | T7 | `tests/evaluateBull.test.js` |
| EA-01 (2.45 → $73,500 / $24.50) | T7 | `tests/evaluateBull.test.js` |
| Pureza RNF-01/RNF-02 | T8 | `tests/purity.test.js` |
