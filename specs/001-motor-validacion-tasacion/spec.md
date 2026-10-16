# Spec 001 — Motor de Validación y Tasación (lógica pura, sin blockchain)

## Resumen

Esta especificación define el **motor de validación biológica y tasación algorítmica** de reproductores bovinos de élite (Toros Líderes) para la plataforma Muurketplace. Es el núcleo de confianza del ecosistema: decide qué toros son aptos para tokenización y cuánto valen (toro completo y dosis seminal individual).

Es **lógica 100% pura** (input → output, sin red, sin blockchain, sin Hedera SDK). Recibe los datos biométricos, ecográficos y seminales del Sumario de Padres PEGBraf y devuelve un veredicto binario (APTO / RECHAZADO) más, solo si es APTO, los valores de tasación en USD.

## Contexto y problema (Background)

Muurketplace tokeniza genética bovina en Hedera Hashgraph mediante dos activos: `PAJ-BRAF` (fungible, 1 token = 1 pajuela de 0.5 ml) y `BULL` (NFT/equity fraccionable). Sin un filtro biológico riguroso y una tasación objetiva, la plataforma corre el riesgo de tokenizar genética de bajo valor o inconsistente, destruyendo la confianza de inversores y centros genéticos.

Hoy existe un script de demostración (`tokenizarToro.js`) que mintea tokens sin validar ni tasar. Esta spec cierra esa brecha: crea la fuente de verdad computable que las futuras specs (002-oráculo HCS, 003-marketplace HSCS) consumirán como precondición obligatoria.

Fuente de verdad biológica: Sumario de Padres PEGBraf, vía skill `ganaderia-pricing-engine` (`parametros_de_toro_lider`) y `docs/constitution.md` §5.

## Objetivos

1. Validar si un toro califica como **Toro Líder** según 4 barreras biológicas inclusivas (RF-02 a RF-05) más 1 invariante de precisión de pesos (RF-01, no es barrera).
2. Calcular el multiplicador total `M_TOTAL` (base 1.0, sumas aditivas) según 4 reglas de mérito genético (RF-09, RF-10, regla AOB RF-11/RF-12 no acumulable, RF-13).
3. Tasar el toro (`$30,000 × M_TOTAL`) y la dosis (`$10 × M_TOTAL`) de forma determinista.
4. Garantizar que la lógica sea pura, testeable sin red y reutilizable por las capas Hedera futuras.

## Alcance

### Dentro del alcance

- Validación biológica: 4 barreras de entrada (RF-02 a RF-05) + 1 invariante de precisión de pesos (RF-01, no es barrera) + rechazo total (RF-06) e inclusividad (RF-07).
- Cálculo de `M_TOTAL` con 4 reglas aditivas en 5 RF (RF-09, RF-10, RF-11/RF-12 como tramos no acumulables de una sola regla AOB, RF-13), incluyendo no-acumulación AOB.
- Fórmulas finales `TASACIÓN_TORO` y `TASACIÓN_DOSIS`.
- Definición del contrato de datos de entrada/salida (nombres, tipos, unidades).
- Ejemplo de aceptación computable EA-01 ($73,500 / $24.50 con `M_TOTAL = 2.45`).

### Fuera de alcance (NO implementable en esta spec)

- Cualquier interacción con Hedera: HTS (creación/minteo de PAJ-BRAF y BULL), HCS (registro de oráculo), HSCS (marketplace, regalías, contratos). → Specs 002/003.
- Uso del SDK `@hashgraph/sdk`, archivos `.env`, claves, Account IDs, red Testnet/Mainnet, HashScan.
- Persistencia, API HTTP, UI, base de datos.
- Interpretación veterinaria del Sumario PEGBraf más allá de los campos aquí definidos.
- Ajuste de umbrales o valores base sin respaldo documental PEGBraf (prohibido por constitution §5).

## Actores del sistema

| Actor | Rol | Interacción con este motor |
|-------|-----|----------------------------|
| Veterinario / Oráculo de datos | Provee los 11 campos de entrada medidos en campo, ecografía y laboratorio | Invoca la validación con datos del Sumario PEGBraf |
| Motor Muurketplace (este sistema) | Valida y tasa de forma determinista | Recibe inputs, devuelve veredicto + tasación |
| Centro genético / Propietario del toro | Aporta el animal candidato | Recibe APTO/RECHAZADO y precio de referencia |
| Inversor / Comprador futuro | Consumirá el precio aguas abajo | Usa la tasación como precio base (no actúa en esta spec) |

## Historias de usuario

- **HU-01 — Filtro de calidad:** Como centro genético, quiero que mi toro sea evaluado contra barreras objetivas para que solo la genética de élite llegue a tokenización.
- **HU-02 — Precio justo:** Como propietario, quiero una tasación algorítmica reproducible para que el valor de mi toro y sus dosis no dependa de negociación subjetiva.
- **HU-03 — Confianza del inversor:** Como inversor, quiero que cada token esté respaldado por un toro validado y tasado con reglas públicas para poder auditar el precio.
- **HU-04 — Integración futura:** Como desarrollador de las specs 002/003, quiero funciones puras sin dependencia de red para poder llamarlas desde el oráculo HCS y el marketplace HSCS sin mocks de blockchain.

## Requisitos Funcionales (notación EARS)

### Contrato de datos (base para todos los RF)

El sistema recibe un objeto con exactamente 11 campos (lista cerrada, sin alternativas):

1. `pesoNacerDep` (decimal, puede ser negativo — DEP de peso al nacer)
2. `pesoDestateDep` (decimal, kg — DEP de peso al destete)
3. `edadDesteDias` (entero, días)
4. `pesoFinalDep` (decimal, kg — DEP de peso final)
5. `edadPesoFinalDias` (entero, días)
6. `circunferenciaEscrotalCm` (decimal, cm)
7. `areaOjoBifeCm2` (decimal, cm²)
8. `grasaIntramuscularTop5` (boolean)
9. `motilidadSeminalPct` (entero, %)
10. `volumenEyaculadoMl` (decimal, ml — informativo del lote, no afecta `M_TOTAL`)
11. `pajuelasProducidas` (entero — informativo del lote, no afecta `M_TOTAL`)

Los campos 1–9 determinan validación y tasación; los campos 10–11 son solo informativos de trazabilidad del lote y nunca modifican `M_TOTAL` (ver Supuesto 3). Devuelve `{ apto: boolean, motivosRechazo: string[], mTotal: number|null, tasacionToroUsd: number|null, tasacionDosisUsd: number|null }`.

### Validación biológica — barreras de entrada

- **RF-01 — Precisión de peso:** `SI pesoDestateDep = 16.4 O pesoFinalDep = 32.6, ENTONCES EL SISTEMA usará los valores decimales exactos en RF-10 sin redondearlos a múltiplos de 5 o 10 (16.4 no se convierte en 15 ni en 20; el test falla si M_TOTAL difiere del cálculo con el valor exacto).`
- **RF-02 — Edad al destete:** `SI edadDesteDias < 100 O edadDesteDias > 300, ENTONCES EL SISTEMA rechazará al toro por edad de destete fuera de rango.`
- **RF-03 — Edad a la medición final:** `SI edadPesoFinalDias < 450 O edadPesoFinalDias > 730, ENTONCES EL SISTEMA rechazará al toro por edad final fuera de rango.`
- **RF-04 — Circunferencia escrotal:** `SI circunferenciaEscrotalCm < 1.5, ENTONCES EL SISTEMA rechazará al toro por fertilidad insuficiente.`
- **RF-05 — Viabilidad seminal:** `SI motilidadSeminalPct < 70, ENTONCES EL SISTEMA rechazará al toro por viabilidad seminal insuficiente.`
- **RF-06 — Rechazo total (cierra D-01, sin delegar al plan):** `SI una o más barreras (RF-02 a RF-05) fallan, O algún campo requerido 1–9 está ausente/nulo, O algún campo numérico es físicamente imposible (edadDesteDias <= 0, edadPesoFinalDias <= 0, circunferenciaEscrotalCm <= 0, motilidadSeminalPct < 0 O motilidadSeminalPct > 100, areaOjoBifeCm2 < 0), ENTONCES EL SISTEMA devolverá apto = false, listará todos los motivos de rechazo (incluido el motivo explícito de campo ausente/inválido), y fijará mTotal, tasacionToroUsd y tasacionDosisUsd en null sin calcular tasación parcial.`
- **RF-07 — Límites inclusivos:** `EL SISTEMA tratará todos los umbrales como inclusivos (100 y 300 válidos; 450 y 730 válidos; 1.5 válido; 70 válido).`

### Motor de tasación — multiplicadores aditivos

- **RF-08 — Base del multiplicador:** `EL SISTEMA partirá de M_TOTAL = 1.0 para todo toro APTO antes de aplicar bonificaciones.`
- **RF-09 — Facilidad de parto:** `SI pesoNacerDep <= 0.0, ENTONCES EL SISTEMA sumará +0.50 a M_TOTAL.`
- **RF-10 — Crecimiento superior:** `SI pesoDestateDep > 15.0 Y pesoFinalDep > 30.0, ENTONCES EL SISTEMA sumará +0.15 a M_TOTAL.`
- **RF-11 — Área de ojo de bife premium (Top 1-5%):** `SI areaOjoBifeCm2 >= 3.0, ENTONCES EL SISTEMA sumará +0.50 a M_TOTAL.`
- **RF-12 — Área de ojo de bife intermedia (Top 20%, no acumulable):** `SI areaOjoBifeCm2 >= 2.0 Y areaOjoBifeCm2 < 3.0, ENTONCES EL SISTEMA sumará +0.20 a M_TOTAL y no aplicará RF-11 en el mismo cálculo.`
- **RF-13 — Marmoleado premium:** `SI grasaIntramuscularTop5 === true, ENTONCES EL SISTEMA sumará +0.30 a M_TOTAL.`
- **RF-14 — Tasación del toro:** `CUANDO el toro sea APTO, EL SISTEMA calculará tasacionToroUsd = 30000 * M_TOTAL (entero USD).`
- **RF-15 — Tasación de la dosis (cierra D-02):** `CUANDO el toro sea APTO, EL SISTEMA calculará tasacionDosisUsd = 10 * M_TOTAL redondeada half-up a 2 decimales.`
- **RF-16 — Salida APTO:** `SI el toro supera las 4 barreras (RF-02 a RF-05) y ningún campo es ausente/inválido según RF-06, ENTONCES EL SISTEMA devolverá apto = true, motivosRechazo = [], mTotal non-null, tasacionToroUsd non-null y tasacionDosisUsd non-null.`

### Ejemplo de aceptación (no es RF — caso canónico verificable)

- **EA-01 — Caso canónico M_TOTAL = 2.45:** `CUANDO los inputs sean pesoNacerDep = -0.5, pesoDestateDep = 16.0, pesoFinalDep = 32.0, edadDesteDias = 210, edadPesoFinalDias = 540, circunferenciaEscrotalCm = 2.0, motilidadSeminalPct = 80, areaOjoBifeCm2 = 3.2, grasaIntramuscularTop5 = true, EL SISTEMA devolverá apto = true, M_TOTAL = 2.45, tasacionToroUsd = 73500 y tasacionDosisUsd = 24.50.` Desglose: base 1.0 + 0.50 (RF-09: -0.5 <= 0.0) + 0.15 (RF-10: 16.0 > 15.0 y 32.0 > 30.0) + 0.50 (RF-11: 3.2 >= 3.0, sin aplicar RF-12) + 0.30 (RF-13) = 2.45.

## Requisitos No Funcionales

- **RNF-01 — Pureza:** las funciones de validación y tasación serán puras (mismo input → mismo output, sin side effects, sin I/O, sin llamadas al SDK de Hedera ni a red). Verificable por inspección de código y tests sin mocks de red.
- **RNF-02 — Separación de capas:** ningún archivo de lógica importará `@hashgraph/sdk` ni leerá `.env` (constitution §2).
- **RNF-03 — Tests nativos:** suite ejecutable con `node --test tests/` sin frameworks externos (constitution §1); cada RF tendrá al menos un test (constitution §3).
- **RNF-04 — Cobertura de ramas:** 100% de las ramas de multiplicadores (RF-09 a RF-13, incluyendo ambas ramas AOB y el caso sin bono) cubiertas por tests.
- **RNF-05 — Determinismo y precisión:** cálculos deterministas sin aleatoriedad ni dependencia de fecha/hora; `tasacionToroUsd` entero USD; `tasacionDosisUsd` redondeada half-up a 2 decimales (D-02 cerrada: half-up, no banker's).
- **RNF-06 — Idioma:** comentarios y documentación en español; identificadores de código en inglés camelCase (constitution §6); identificadores de dominio PEGBraf en español (`pesoDestateDep`, etc.) eximidos por ser vocabulario oficial de la fuente de verdad.

## Supuestos

1. Los datos de entrada llegan con los tipos y unidades del contrato; este motor no delega la decisión: todo campo requerido 1–9 ausente/nulo o físicamente imposible es RECHAZO con motivo explícito según RF-06 (D-01 cerrada aquí, no en el plan).
2. `VALOR_BASE_TORO_USD = 30000` y `VALOR_BASE_DOSIS_USD = 10` son constantes fijas de esta spec. El volumen estándar de pajuela (0.5 ml) y la concentración mínima por pajuela (30M) NO son constantes de esta spec: pertenecen a las specs 002/003 (tokenización HTS).
3. `volumenEyaculadoMl` (campo 10) y `pajuelasProducidas` (campo 11) son informativos del lote y no modifican `M_TOTAL` en esta spec.
4. Los umbrales provienen del Sumario PEGBraf vigente; cualquier cambio futuro requiere respaldo documental (constitution §5).

## Casos límite

- `edadDesteDias` = 99 → RECHAZADO; 100 → APTO (si resto OK); 300 → APTO; 301 → RECHAZADO. Análogo para 449/450/730/731, CE 1.49/1.5, motilidad 69/70.
- `pesoNacerDep` = 0.0 → bono +0.50 (condición `<=`); 0.01 → sin bono.
- `pesoDestateDep` = 15.0 / `pesoFinalDep` = 30.0 → sin bono (requiere `>` estricto en ambos); basta que uno falle para negar RF-10. `pesoDestateDep` = 16.4 se evalúa exacto (RF-01): 16.4 > 15.0 otorga el tramo de RF-10 si `pesoFinalDep` > 30.0.
- `areaOjoBifeCm2` = 1.99 → sin bono; 2.0 → +0.20; 2.99 → +0.20; 3.0 → +0.50 (nunca +0.70).
- `M_TOTAL` mínimo = 1.0 (toro APTO sin bonos) → $30,000 / $10; máximo teórico = 2.45 → $73,500 / $24.50.
- Múltiples barreras fallidas simultáneamente → todos los motivos listados, sin tasación.
- Valores nulos/ausentes o físicamente imposibles (edades <= 0, CE <= 0, motilidad < 0 o > 100, AOB < 0) → RECHAZO con motivo explícito según RF-06, sin relajar ninguna barrera.

## Fuera de alcance (reafirmación explícita)

HTS (tokens PAJ-BRAF/BULL, decimales, supply), HCS (oráculos/trazabilidad), HSCS (contratos/marketplace/regalías), `.env`, SDK, Testnet/Mainnet, HashScan, persistencia, API y UI. Nada de esta spec toca red ni blockchain.

## Criterios de finalización (criterios de aceptación verificables)

1. Existe `specs/001-motor-validacion-tasacion/spec.md` con los 16 RF en EARS (RF-01 a RF-16) más el ejemplo de aceptación EA-01, y trazabilidad a constitution.
2. Cada RF-01 a RF-16 tiene al menos un test en `tests/` ejecutable con `node --test tests/` en verde; EA-01 también tiene test de aceptación.
3. El ejemplo EA-01 reproduce exactamente `M_TOTAL = 2.45`, `$73,500` y `$24.50`.
4. Ningún archivo de lógica importa `@hashgraph/sdk` ni accede a `.env` o red.
5. Cobertura del 100% de ramas de multiplicadores (RF-09 a RF-13).
6. Veredicto `APROBADO` del revisor SDD (`/sdd-validate`) y `MEMORY.md` actualizado.

## Dudas abiertas

- **D-03:** ¿Se versionan `VALOR_BASE_*` por fecha de tasación o quedan constantes hasta nueva spec? (Propuesta: constantes de esta spec; cambios solo vía `/sdd-change` con respaldo PEGBraf.)

## Decisiones cerradas en esta revisión (ex D-01/D-02)

- **D-01 [CERRADA]:** campos ausentes/nulos o físicamente imposibles → RECHAZO con motivo explícito según RF-06 (decidido aquí, no delegado al plan).
- **D-02 [CERRADA]:** redondeo canónico de `tasacionDosisUsd` → half-up a 2 decimales (fijado en RF-15 y RNF-05).

## Trazabilidad a constitution

| Requisito | Principio constitution |
|-----------|------------------------|
| RF-01 (invariante precisión), RF-02–RF-06 (4 barreras + rechazo total incl. D-01), RF-07, RNF-01, RNF-02 | §2 Separación lógica/infraestructura (`src/logic/` vs `src/hedera/`, sin SDK en lógica) |
| RF-09–RF-16 (tasación + salida APTO), EA-01 (caso canónico 2.45), RNF-04, RNF-05 (half-up, D-02), Criterios 2/3/5 | §3 Política de tests (1 test por RF + test EA-01, TDD, 100% ramas de tasación) |
| Fuera de alcance (sin `.env`/claves/Mainnet) | §4 Protección de datos y seguridad |
| Fuente PEGBraf, umbrales y D-03 | §5 Fuente de verdad biológica |
| RNF-06 | §6 Idioma |
| Criterios de finalización | §7 Criterio de "Hecho" (`node --test tests/` en verde + revisión contra RF) |
