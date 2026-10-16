# /sdd-tasks — Desglosar Plan en Tareas

> **Uso:** `/sdd-tasks` — Toma el `plan.md` aprobado y genera `tasks.md` con tareas verificables.

## Instrucción al Agente

**Prerrequisito:** El `plan.md` debe estar aprobado por el usuario.

1. Lee `specs/00N-<nombre>/plan.md`.
2. Genera `specs/00N-<nombre>/tasks.md` con este formato estricto:

```markdown
# Tasks — Spec 00N: <Nombre>

> Estado: 0/N tareas completadas

## Tarea 1: <Título descriptivo de acción>
- **RF cubiertos:** RF-01
- **Archivos:** `tests/<nombre>.test.js` (CREAR), `src/logic/<nombre>.js` (CREAR)
- **Hecho cuando:** `node --test tests/<nombre>.test.js` pasa en verde Y la función retorna <resultado esperado> para <input de ejemplo>.
- [ ] Crear `tests/<nombre>.test.js` con los casos para RF-01 (test debe fallar inicialmente).
- [ ] Implementar `src/logic/<nombre>.js` con la función `<nombre>()`.
- [ ] Correr `node --test tests/` y verificar que pasa en verde.

## Tarea 2: ...
```

## Reglas para Generar Tareas
- Máximo **10 tareas** por spec.
- Cada tarea debe completarse en **máximo 20-30 minutos**.
- El orden respeta las dependencias: primero lo que otros necesitan.
- La primera acción de cada tarea es SIEMPRE escribir el test (TDD).
- El criterio "Hecho cuando:" debe ser objetivo y verificable sin interpretación.
- Si una tarea involucra Hedera SDK: separar en tarea propia (no mezclar con lógica pura).
