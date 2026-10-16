---
name: ganaderia-pricing-engine
description: Motor de validación biológica y tasación algorítmica para reproductores bovinos de élite (Toros Líderes). Define los parámetros exactos del dominio PEGBraf para el proyecto Muurketplace.
---

# Skill: ganaderia-pricing-engine

## Cuándo Cargar Esta Skill
Cargar cuando se trabaje con cualquier función que:
- Valide parámetros biológicos de un toro
- Calcule el valor de tasación de un espécimen o sus dosis
- Interprete datos del Sumario de Padres (PEGBraf)
- Genere o valide tokens PAJ-BRAF o BULL

---

## Diccionario de Datos (Inputs del Veterinario/Oráculo)

### Datos Biométricos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `pesoNacerDep` | Decimal | DEP peso al nacer (puede ser negativo) |
| `pesoDestateDep` | Entero | DEP peso al destete en kg |
| `edadDesteDias` | Entero | Edad del animal al destete en días |
| `pesoFinalDep` | Entero | DEP peso a los 18 meses en kg |
| `edadPesoFinalDias` | Entero | Edad al momento de medición final en días |
| `circunferenciaEscrotalCm` | Decimal | CE en cm (fertilidad y precocidad) |

### Datos Ecográficos (Carcasa a 18 meses ±60 días)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `areaOjoBifeCm2` | Decimal | AOB en cm² (rendimiento carnicero) |
| `grasaIntramuscularTop5` | Boolean | true si GI está en Top 5% (marmoleado premium) |

### Datos de Laboratorio Seminal
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `motilidadSeminalPct` | Entero | % de espermatozoides con movimiento rectilíneo rápido |

### Datos de Salto (Extracción)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `volumenEyaculadoMl` | Decimal | Volumen total extraído en el salto |
| `pajuelasProducidas` | Entero | Cantidad de dosis del lote |

---

## Reglas de Validación (Barreras de Entrada)
**Si UNA SOLA regla falla → el toro es RECHAZADO completo. No hay tasación parcial.**

| Regla | Condición | Límites |
|-------|-----------|---------|
| Escala de Peso | Precisión de 1 kg (no múltiplos de 5 o 10 automáticos) | — |
| Edad al Destete | `edadDesteDias` | **≥ 100** Y **≤ 300** |
| Edad Final | `edadPesoFinalDias` | **≥ 450** Y **≤ 730** |
| Circunferencia Escrotal | `circunferenciaEscrotalCm` | **≥ 1.5** (inclusivo) |
| Viabilidad Seminal | `motilidadSeminalPct` | **≥ 70** (inclusivo) |

> ⚠️ Los límites son **inclusivos** (≥, ≤). Ej: `edadDesteDias = 100` es VÁLIDO.

---

## Motor de Tasación (Multiplicadores Aditivos)

**Base de partida:** `M_TOTAL = 1.0`

Los multiplicadores se SUMAN (no se multiplican entre sí):

| # | Condición | Suma a M_TOTAL |
|---|-----------|----------------|
| 1 | `pesoNacerDep <= 0.0` (facilidad de parto, Top 1%) | **+0.50** |
| 2 | `pesoDestateDep > 15.0` AND `pesoFinalDep > 30.0` | **+0.15** |
| 3a | `areaOjoBifeCm2 >= 3.0` (Top 1-5%) | **+0.50** |
| 3b | `areaOjoBifeCm2 >= 2.0` AND `< 3.0` (Top 20%) | **+0.20** *(no acumula con 3a)* |
| 4 | `grasaIntramuscularTop5 === true` | **+0.30** |

---

## Valores Base

```js
const VALOR_BASE_TORO_USD = 30000;   // Piso comercial toro padre de centro
const VALOR_BASE_DOSIS_USD = 10;     // Piso comercial pajuela de semen
const VOLUMEN_PAJUELA_ESTANDAR_ML = 0.5;
const CONCENTRACION_MINIMA_PAJUELA = 30_000_000; // espermatozoides/pajuela
```

---

## Fórmula Final

```
TASACIÓN_TORO = VALOR_BASE_TORO_USD * M_TOTAL
TASACIÓN_DOSIS = VALOR_BASE_DOSIS_USD * M_TOTAL
```

---

## Ejemplo Completo de Referencia

**Datos de entrada:**
- `pesoNacerDep = -0.5`, `pesoDestateDep = 16`, `pesoFinalDep = 32`
- `edadDesteDias = 210`, `edadPesoFinalDias = 540`
- `circunferenciaEscrotalCm = 2.0`, `motilidadSeminalPct = 80`
- `areaOjoBifeCm2 = 3.2`, `grasaIntramuscularTop5 = true`

**Validación:** ✅ Todas las barreras superadas

**Cálculo de M_TOTAL:**
- Base: `1.0`
- PN ≤ 0.0 → `+0.50` → `1.50`
- Crecimiento (16 > 15 AND 32 > 30) → `+0.15` → `1.65`
- AOB ≥ 3.0 → `+0.50` → `2.15`
- GI Top 5% → `+0.30` → `2.45`

**Tasación Toro:** `$30,000 * 2.45 = $73,500 USD`
**Tasación Dosis:** `$10 * 2.45 = $24.50 USD`
