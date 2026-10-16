# /sdd-plan — Generar Plan Técnico

> **Uso:** `/sdd-plan` — Toma el `spec.md` aprobado y genera `plan.md` con el diseño técnico.

## Instrucción al Agente

**Prerrequisito:** La spec debe tener veredicto "LISTA PARA PLANIFICAR" del `/sdd-clarify`.

1. Lee `specs/00N-<nombre>/spec.md` y `docs/constitution.md`.
2. Genera `specs/00N-<nombre>/plan.md` con esta estructura:

```markdown
# Plan Técnico — Spec 00N: <Nombre>

## Archivos a Crear/Modificar
| Archivo | Responsabilidad |
|---------|----------------|
| `src/logic/<nombre>.js` | Funciones puras de <lógica> |
| `tests/<nombre>.test.js` | Tests de los RF cubiertos |

## Funciones Puras (src/logic/)
### `funcionNombre(param1, param2)`
- **RF cubiertos:** RF-01, RF-02
- **Input:** `{ campo: tipo }` — descripción
- **Output:** `{ resultado: tipo }` — descripción
- **Pseudocódigo:**
  ```
  SI condición ENTONCES
    retornar valor_a
  SINO
    retornar valor_b
  ```

## Interacción con Hedera SDK (src/hedera/) — si aplica
- Servicio: HTS / HCS / HSCS
- Operación: <descripción>
- Manejo de errores: <estrategia>

## Decisiones Técnicas
| Decisión | Alternativas descartadas | Razón |
|----------|--------------------------|-------|

## Estrategia de Tests
| Test | RF que cubre | Tipo |
|------|-------------|------|
| `tests/<nombre>.test.js` → caso normal | RF-01 | Unitario |
| `tests/<nombre>.test.js` → caso límite | RF-02 | Unitario |
```

## Reglas del Plan
- Las funciones puras de `src/logic/` NO deben importar `@hashgraph/sdk`.
- Cada RF debe tener al menos un test mapeado.
- Preferir funciones pequeñas y componibles sobre funciones grandes y monolíticas.
