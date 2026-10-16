# Plan Técnico — Spec 001 Motor de Validación y Tasación

> Spec origen: `specs/001-motor-validacion-tasacion/spec.md` (APROBADA).
> Constitución: `docs/constitution.md` §§1–7.
> Alcance de este plan: solo lógica pura. No implementa código, solo diseña.

## 1. Arquitectura propuesta

### 1.1Mapa de archivos (crear, no modificar existentes)

```
src/
└── logic/                      # Capa pura — PROHIBIDO @hashgraph/sdk, .env, red, fs, Date, Math.random
    ├── constants.js            # Umbrales PEGBraf + valores base. Único lugar de números mágicos.
    ├── validator.js            # RF-01–RF-07. Solo validación, no tasa.
    ├── pricing.js              # RF-08–RF-15. Solo cálculo de M_TOTAL y tasaciones.
    └── evaluateBull.js         # Fachada RF-06 + RF-16. Orquesta validator + pricing, aplica contrato nulls.
tests/
├── validator.test.js           # Tests RF-02–RF-07 (+ RF-01 precisión, + RF-06 ausentes/inválidos)
├── pricing.test.js             # Tests RF-08–RF-15 (ramas de bonos + redondeo)
└── evaluateBull.test.js        # Tests integración RF-06, RF-16 y EA-01 canónico
```

Ningún archivo existente se modifica (`tokenizarToro.js` queda intacto por ser demo pre-SDD).
`src/hedera/` **no se crea ni se toca** en esta spec — queda reservado a specs 002/003.

### 1.2 Responsabilidades por archivo

| Archivo | Responsabilidad | Recibe | Devuelve | RF dueños |
|---------|-----------------|--------|----------|-----------|
| `src/logic/constants.js` | Exportar `VALOR_BASE_TORO_USD=30000`, `VALOR_BASE_DOSIS_USD=10`, umbrales (100, 300, 450, 730, 1.5, 70, 0.0, 15.0, 30.0, 2.0, 3.0) y bonos (0.50, 0.15, 0.50, 0.20, 0.30). Congelar con `Object.freeze`. | — | Constantes | Todos (referencia) |
| `src/logic/validator.js` | Validar 4 barreras + detectar ausentes/inválidos. No calcula dinero. | Objeto 11 campos | `{ apto: boolean, motivosRechazo: string[] }` | RF-01–RF-07 |
| `src/logic/pricing.js` | Calcular `M_TOTAL` desde base 1.0 + tasaciones. Asume input APTO (no revalida). | Objeto 11 campos o `mTotal` | `mTotal`, `tasacionToroUsd`, `tasacionDosisUsd` | RF-08–RF-15 |
| `src/logic/evaluateBull.js` | Fachada pública. Único punto que consumirán 002/003. Aplica RF-06 (nulls) y RF-16 (salida APTO). | Objeto 11 campos | `{ apto, motivosRechazo, mTotal, tasacionToroUsd, tasacionDosisUsd }` | RF-06, RF-16, EA-01 |
| `tests/*.test.js` | Un test `node:test` + `node:assert/strict` por RF + 1 por EA-01. Sin frameworks. | — | Verde/rojo | Ver §5 matriz |

Dependencias entre módulos (una sola dirección, sin ciclos):

```
evaluateBull.js → validator.js → constants.js
evaluateBull.js → pricing.js   → constants.js
validator.js  ✕  pricing.js (no se conocen entre sí)
```

### 1.3 Interfaz con Hedera SDK

**No aplica en esta spec — explícitamente excluida.**

- Ningún archivo de `src/logic/` importa `@hashgraph/sdk`, lee `.env`/`process.env`, hace `fetch`/I-O ni usa `Date`/`Math.random` (RNF-01, RNF-02).
- Verificación: `grep -r "hashgraph\|process.env\|fetch\|random" src/logic/` debe devolver vacío; el revisor lo audita (criterio 4 de la spec).
- Contrato para futuro: specs 002 (oráculo HCS) y 003 (marketplace HSCS) importarán `require('../logic/evaluateBull')` como precondición (`if (!result.apto) abortar`) antes de cualquier llamada HTS/HCS. Este plan no diseña esos callers.

## 2. Diseño de funciones puras

Convenciones: Node.js CommonJS (`require`/`module.exports`), comentarios en español, identificadores de código en inglés camelCase; IDs de dominio PEGBraf en español (`pesoDestateDep`, etc.) eximidos por RNF-06 por ser vocabulario oficial.

### 2.1 Contrato de datos (entrada/salida)

```js
// BullInput — 11 campos cerrados (tipos según spec § Contrato)
{
  pesoNacerDep: number,          // puede ser negativo (DEP). 0.0 es válido y bonifica.
  pesoDestateDep: number,        // kg DEP decimal exacto (RF-01)
  edadDesteDias: number,         // entero días
  pesoFinalDep: number,          // kg DEP decimal exacto (RF-01)
  edadPesoFinalDias: number,     // entero días
  circunferenciaEscrotalCm: number, // cm decimal
  areaOjoBifeCm2: number,        // cm² decimal
  grasaIntramuscularTop5: boolean,
  motilidadSeminalPct: number,   // entero %
  volumenEyaculadoMl: number,    // informativo, nunca modifica M_TOTAL
  pajuelasProducidas: number     // informativo, nunca modifica M_TOTAL
}

// BullResult — salida cerrada
{
  apto: boolean,
  motivosRechazo: string[],          // [] si apto; ≥1 código legible si rechazo
  mTotal: number | null,             // null SIEMPRE que apto === false (RF-06)
  tasacionToroUsd: number | null,    // null SIEMPRE que apto === false
  tasacionDosisUsd: number | null    // null SIEMPRE que apto === false
}
```

Regla de nulls (RF-06/RF-16): **no existe tasación parcial.** Si `apto === false`, las tres salidas numéricas son `null` aunque `M_TOTAL` fuese computable. Si `apto === true`, las tres son non-null y `motivosRechazo` es `[]`.

### 2.2 `validator.js`

```js
function validateBull(data) // (BullInput) => { apto: boolean, motivosRechazo: string[] }
```

Pseudocódigo:

```
validateBull(data):
  motivos = []
  // RF-06a: campos requeridos 1–9 ausentes o nulos → un motivo por campo
  PARA cada campo EN [pesoNacerDep, pesoDestateDep, edadDesteDias,
                      pesoFinalDep, edadPesoFinalDias, circunferenciaEscrotalCm,
                      areaOjoBifeCm2, grasaIntramuscularTop5, motilidadSeminalPct]:
    SI data[campo] === undefined O data[campo] === null:
      motivos.push("campo ausente: <campo>")
  // RF-06b: físicamente imposibles (solo si el campo existe; no duplicar motivo de ausencia)
  SI existe edadDesteDias Y edadDesteDias <= 0: motivos.push("edad destete inválida")
  SI existe edadPesoFinalDias Y edadPesoFinalDias <= 0: motivos.push("edad final inválida")
  SI existe circunferenciaEscrotalCm Y circunferenciaEscrotalCm <= 0: motivos.push("CE inválida")
  SI existe motilidadSeminalPct Y (motilidad < 0 O motilidad > 100): motivos.push("motilidad inválida")
  SI existe areaOjoBifeCm2 Y areaOjoBifeCm2 < 0: motivos.push("AOB inválida")
  // RF-02–RF-05 barreras (comparaciones inclusivas, ver RF-07; solo si campo existe y es posible)
  SI existe edadDesteDias Y (edadDesteDias < 100 O edadDesteDias > 300):
    motivos.push("edad de destete fuera de rango")
  SI existe edadPesoFinalDias Y (edadPesoFinalDias < 450 O edadPesoFinalDias > 730):
    motivos.push("edad final fuera de rango")
  SI existe circunferenciaEscrotalCm Y circunferenciaEscrotalCm < 1.5:
    motivos.push("fertilidad insuficiente")
  SI existe motilidadSeminalPct Y motilidadSeminalPct < 70:
    motivos.push("viabilidad seminal insuficiente")
  // RF-01 es invariante: aquí NO se redondea nada; RF-10 en pricing usa valores exactos.
  // Campos 10–11 (volumen, pajuelas) se ignoran por completo en validación.
  DEVOLVER { apto: motivos.length === 0, motivosRechazo: motivos }
```

Notas: acumula **todos** los motivos (no cortocircuito). Cada rama `SI existe` evita doble motivo ausencia+barrera sobre el mismo campo.

### 2.3 `pricing.js`

```js
function calculateMTotal(data)      // (BullInput) => number (M_TOTAL con 2 decimales exactos esperados)
function calculateBullPrice(mTotal) // (number) => number (entero USD)
function calculateDosePrice(mTotal) // (number) => number (half-up 2 decimales)
function roundHalfUp2(value)        // (number) => number (helper interno exportado para test)
```

Pseudocódigo:

```
calculateMTotal(data):
  m = 1.0                                            // RF-08 base
  SI data.pesoNacerDep <= 0.0: m += 0.50             // RF-09 (<=, 0.0 bonifica)
  SI data.pesoDestateDep > 15.0 Y data.pesoFinalDep > 30.0:  // RF-10 (AND estricto, valores exactos RF-01)
    m += 0.15
  SI data.areaOjoBifeCm2 >= 3.0:                     // RF-11
    m += 0.50
  SINO SI data.areaOjoBifeCm2 >= 2.0:                // RF-12 (else-if garantiza no-acumulación; <3.0 implícito)
    m += 0.20
  SI data.grasaIntramuscularTop5 === true:           // RF-13 (=== estricto, truthy no vale)
    m += 0.30
  // campos 10–11 jamás se leen aquí
  DEVOLVER m

calculateBullPrice(mTotal):
  DEVOLVER 30000 * mTotal                            // RF-14 entero USD (1.0→30000 … 2.45→73500)

roundHalfUp2(value):
  DEVOLVER Math.floor(value * 100 + 0.5 + Number.EPSILON) / 100   // half-up, no banker's

calculateDosePrice(mTotal):
  DEVOLVER roundHalfUp2(10 * mTotal)                  // RF-15 (2.45→24.50)
```

### 2.4 `evaluateBull.js` (fachada)

```js
function evaluateBull(data) // (BullInput) => BullResult
```

Pseudocódigo:

```
evaluateBull(data):
  { apto, motivosRechazo } = validateBull(data)      // RF-02–RF-07 + RF-06
  SI NO apto:
    DEVOLVER { apto: false, motivosRechazo, mTotal: null,
               tasacionToroUsd: null, tasacionDosisUsd: null }   // RF-06 nulls
  mTotal = calculateMTotal(data)                     // RF-08–RF-13
  DEVOLVER { apto: true, motivosRechazo: [],
             mTotal, tasacionToroUsd: calculateBullPrice(mTotal),      // RF-14
             tasacionDosisUsd: calculateDosePrice(mTotal) }            // RF-15, RF-16
```

`evaluateBull` es la única función que las specs 002/003 necesitan importar.

## 3. Decisiones técnicas justificadas

| # | Decisión | Justificación | Alternativa descartada y por qué |
|---|----------|---------------|----------------------------------|
| T-01 | Tres módulos (`validator` / `pricing` / `evaluateBull`) + `constants.js` en vez de un solo archivo | Un archivo por responsabilidad (AGENTS.md); permite testear validación sin tocar dinero y viceversa; `evaluateBull` da punto único de integración a 002/003. | Monolito `motor.js`: mezcla validación y tasación, dificulta matriz RF→test y reutilización parcial. |
| T-02 | `else-if` para AOB (RF-11/RF-12) en lugar de dos `if` independientes + guarda | La no-acumulación queda garantizada por construcción (imposible sumar +0.70); el test de 3.0 lo confirma. | Dos `if` con `&& < 3.0` duplicado: correcto pero frágil — un futuro cambio de umbral podría romper la exclusión sin que el código lo evidencie. |
| T-03 | Half-up manual `Math.floor(x*100+0.5+EPSILON)/100`, sin `toFixed` ni librería decimal | RNF-05 exige half-up (D-02); `toFixed` tiene bordes binarios documentados (`1.005`→`1.00`); `Number.EPSILON` absorbe el error de representación. Sin dependencias nuevas (constitution §1). | `decimal.js` / `big.js`: precisión perfecta pero viola "sin dependencias sin aprobación" y es sobredimensionado para `10 × M_TOTAL` con 2 decimales. `toFixed(2)`: redondeo half-away en decimales exactos pero falla en binarios cercanos al borde. |
| T-04 | Comparaciones directas con literales de `constants.js`, sin tolerancia epsilon en umbrales | Los umbrales son decimales de 1 cifra (1.5, 2.0, 3.0) exactamente representables en binario; la tolerancia epsilon desplazaría bordes inclusivos (riesgo mayor que el que resuelve). Epsilon solo en redondeo (T-03). | Epsilon en todas las comparaciones (`x >= 1.5 - 1e-9`): convertiría 1.499999999 en APTO y violaría el caso límite 1.49→rechazo de la spec. |
| T-05 | Chequeo de ausencia con `=== undefined \|\| === null`, nunca falsy | `pesoNacerDep = 0` y `grasaIntramuscularTop5 = false` son valores válidos falsy; `if (!x)` los rechazaría (ver riesgo R-03). | `if (!data[campo])`: bug clásico que rechaza DEP 0.0 (bono RF-09) y GI false (caso sin bono). |
| T-06 | `grasaIntramuscularTop5 === true` estricto | RF-13 exige booleano; `1`/`"true"` truthy no deben bonificar. | `if (grasaIntramuscularTop5)`: aceptaría basura truthy y rompería determinismo. |
| T-07 | `Object.freeze` en constantes + CommonJS `require` | Evita mutación accidental de `VALOR_BASE_*`; CommonJS es stack bloqueado (constitution §1). | ESM `import`: prohibido sin decisión explícita. Constantes inline por archivo: duplica números mágicos y permite divergencia. |
| T-08 | `motivosRechazo` como strings legibles en español (códigos estables, ej. `"edad de destete fuera de rango"`, `"campo ausente: <campo>"`) | La spec exige "motivo explícito" pero no fija enum; strings legibles son auditables por el veterinario y testeables con `includes`. | Enum numérico o códigos crípticos: exige tabla de traducción fuera de alcance y dificulta la auditoría HU-03. |

## 4. Estrategia TDD (`node --test`, sin frameworks)

Orden de implementación (cada paso: test rojo → código mínimo → verde; `node --test tests/` tras cada paso):

1. **Esqueleto + constantes** (sin RF): crear `constants.js` + stubs que lanzan `Error("no implementado")`. Test humo: `require` no lanza y constantes congeladas.
2. **Barreras** (RF-02–RF-05, RF-07): tests de cada borde inclusivo (99/100/300/301, 449/450/730/731, 1.49/1.5, 69/70) sobre `validateBull` con resto de inputs canónicos APTOS.
3. **Rechazo total** (RF-06): multi-barrera simultánea (todos los motivos), campo ausente por cada uno de los 9 requeridos, e inválidos físicos (edad ≤ 0, CE ≤ 0, motilidad −1/101, AOB < 0). Assert de triple-`null` vía `evaluateBull`.
4. **Invariante precisión** (RF-01): `pesoDestateDep = 16.4` exacto otorga RF-10 (vs stub redondeado a 15/20 que daría otro `M_TOTAL`).
5. **Bonos** (RF-08–RF-13): base 1.0 sin bonos; RF-09 (0.0 sí / 0.01 no); RF-10 tabla AND (solo-uno-falla → sin bono; 15.0/30.0 exactos → sin bono); AOB (1.99/2.0/2.99/3.0, nunca 0.70); RF-13 (`true` sí / `false` no / `1` no).
6. **Tasación + salida** (RF-14–RF-16): toro entero, dosis half-up, salida APTO non-null + `[]`.
7. **EA-01 canónico**: `evaluateBull` con los 9 inputs de referencia → `deepStrictEqual` `{ apto: true, motivosRechazo: [], mTotal: 2.45, tasacionToroUsd: 73500, tasacionDosisUsd: 24.50 }` (con tolerancia cero en enteros y `24.50`; `mTotal` con `assert.ok(Math.abs(m-2.45) < 1e-9)` por representación binaria — ver riesgo R-01).
8. **Antirregresión pureza**: test/grep que falla si `src/logic/**` contiene `require('@hashgraph/sdk')`, `process.env`, `fetch`, `Math.random`, `Date.now`.

Todos los tests usan `node:test` (`describe/it`) + `node:assert/strict`, CommonJS, sin `npm install`.

## 5. Matriz RF → test (cobertura constitution §3: 1 test por RF + EA-01, 100% ramas RF-09–RF-13)

| RF | Test(s) | Archivo | Aserción clave |
|----|---------|---------|----------------|
| RF-01 | `precisión decimal exacta 16.4/32.6 sin redondear` | `validator.test.js` + `pricing.test.js` | RF-10 otorga bono con 16.4 exacto; variante redondeada a 15/20 daría distinto `M_TOTAL` |
| RF-02 | `rechaza edad destete 99 y 301; acepta 100 y 300` | `validator.test.js` | 2 rechazos + 2 APTOS de borde |
| RF-03 | `rechaza edad final 449 y 731; acepta 450 y 730` | `validator.test.js` | 2 rechazos + 2 APTOS de borde |
| RF-04 | `rechaza CE 1.49; acepta CE 1.5` | `validator.test.js` | Barrera inclusiva |
| RF-05 | `rechaza motilidad 69; acepta 70` | `validator.test.js` | Barrera inclusiva |
| RF-06 | `múltiples barreras listan todos los motivos y triple-null` + `cada campo 1–9 ausente rechaza con motivo explícito` + `inválidos físicos rechazan` | `evaluateBull.test.js` + `validator.test.js` | `mTotal/tasacionToro/tasacionDosis === null`, `motivosRechazo.length ≥ 2` / `includes("campo ausente")` |
| RF-07 | cubierto dentro de RF-02–RF-05 (bordes inclusivos) + `test agregado todos los umbrales inclusivos válidos a la vez` | `validator.test.js` | APTO con 100/450/1.5/70 simultáneos |
| RF-08 | `M_TOTAL base 1.0 sin bonos → $30,000 / $10.00` | `pricing.test.js` | Toro APTO mínimo tasado a base |
| RF-09 | `PN -0.5 y 0.0 bonifican; 0.01 no` | `pricing.test.js` | `+0.50` solo con `<= 0.0` |
| RF-10 | `bono solo si ambos > umbral (tabla 15.0/30.0 estrictos)` | `pricing.test.js` | 4 combinaciones AND + caso 16.4 (RF-01) |
| RF-11 | `AOB 3.0 y 3.2 → +0.50` | `pricing.test.js` | Tramo premium |
| RF-12 | `AOB 2.0 y 2.99 → +0.20; 1.99 → +0; 3.0 no duplica (+0.50, nunca +0.70)` | `pricing.test.js` | No-acumulación |
| RF-13 | `GI true → +0.30; false/1 → +0` | `pricing.test.js` | Estricto `=== true` |
| RF-14 | `toro = 30000 × M_TOTAL entero (2.45 → 73500)` | `pricing.test.js` | Sin decimales |
| RF-15 | `dosis = 10 × M_TOTAL half-up 2 decimales (2.45 → 24.50; borde 1.005 → 1.01)` | `pricing.test.js` | Half-up, no banker's |
| RF-16 | `salida APTO completa non-null y motivos []` | `evaluateBull.test.js` | `mTotal/tasaciones non-null` |
| EA-01 | `caso canónico M 2.45 → $73,500 / $24.50` | `evaluateBull.test.js` | `deepStrictEqual` del resultado completo |

RNF-04 (100% ramas RF-09–RF-13): la matriz cubre ambas ramas de cada bono + caso sin bono + ambas ramas AOB, verificable por inspección (5 reglas × 2 ramas).

## 6. Riesgos y mitigaciones

| # | Riesgo | Impacto | Mitigación en este plan |
|---|--------|---------|--------------------------|
| R-01 | **Float binario:** `1.0+0.5+0.15+0.5+0.3` puede dar `2.4499999999999997`, y `10×2.45 = 24.499999…` | EA-01 falla por `!== 2.45`; dosis mal redondeada | Comparar `mTotal` con tolerancia `1e-9` en tests; redondeo half-up con `+EPSILON` absorbe el error antes de `floor`; `tasacionToroUsd` siempre entero (30000×M da entero en los 2 únicos decimales posibles). No usar tolerancia en umbrales (T-04). |
| R-02 | **Bordes inclusivos off-by-one** (`<` vs `<=`, `>` vs `>=` invertidos) | Falsos APTOS/RECHAZOS en 100/300/450/730/1.5/70/0.0/15.0/30.0/2.0/3.0 | Tests de borde pareados (justo-dentro/justo-fuera) para cada RF-02–RF-05, RF-09–RF-12; tabla AND de RF-10 con 15.0/30.0 exactos. |
| R-03 | **DEP negativa falsy:** `pesoNacerDep = -0.5` es truthy pero `0.0` es falsy; `if (!x)` rompe RF-09 y RF-06 | Toro válido rechazado o bono perdido | T-05: ausencia solo con `=== undefined \|\| === null`; RF-09 con `<= 0.0` numérico. Test explícito `0.0 → bono`. |
| R-04 | **AOB doble conteo** (+0.70 en 3.0) | `M_TOTAL` máximo 2.65 en vez de 2.45; EA-01 roto | T-02 `else-if`; test `3.0 → +0.50 y nunca +0.70` + EA-01 como guardián del máximo teórico. |
| R-05 | **Campos informativos contaminan precio** (leer volumen/pajuelas en `pricing.js`) | `M_TOTAL` no determinista respecto a spec; supuesto 3 violado | `pricing.js` jamás referencia campos 10–11 (auditable por grep); test: mismo toro con volúmenes distintos → idéntico `M_TOTAL`. |
| R-06 | **Fuga de SDK/red a `src/logic/`** | Viola constitution §2; tests dejan de ser offline | T-08/test antirregresión grep; estructura `src/hedera/` inexistente en esta spec recuerda el límite. |
| R-07 | **Confusión RF-01 (invariante) con barrera** | Implementar RF-01 como 5ª barrera rechazaría toros válidos | Este plan la trata como invariante de precisión (sin `motivosRechazo` propio); su test vive en `pricing` (exactitud), no en `validator`. |

## 7. Criterio de listo (para `tasks.md` y `/sdd-validate`)

1. `src/logic/constants.js`, `validator.js`, `pricing.js`, `evaluateBull.js` existen, son CommonJS puros y congelan constantes.
2. `node --test tests/` en verde: 16 RF con ≥1 test cada uno + EA-01 exacto (`2.45`, `73500`, `24.50`).
3. 100% ramas RF-09–RF-13 cubiertas (matriz §5) incluyendo no-acumulación AOB y caso sin bono.
4. `grep` confirma cero imports de `@hashgraph/sdk`, cero `process.env`/red en `src/logic/`.
5. Veredicto `APROBADO` del revisor y `MEMORY.md` actualizado (fuera del alcance de este plan, registrado para `tasks.md`).

## 8. Trazabilidad spec → plan → constitution

| Spec | Este plan | Constitution |
|------|-----------|--------------|
| RF-01–RF-07, invariante precisión | `validator.js` + T-04/T-05, riesgos R-02/R-03/R-07 | §2 separación, §5 umbrales PEGBraf |
| RF-08–RF-15, half-up D-02 | `pricing.js` + T-02/T-03/T-04, riesgos R-01/R-04/R-05 | §2 pureza, §3 100% ramas |
| RF-06/RF-16 nulls, EA-01 2.45 | `evaluateBull.js` fachada, matriz §5 | §3 1 test por RF, §7 hecho |
| Fuera de alcance HTS/HCS/HSCS, sin `.env`/SDK | §1.3 (no aplica), riesgo R-06 | §1 stack, §4 seguridad |
| Español docs / inglés código, IDs PEGBraf eximidos | §2 convenciones | §6 idioma |
