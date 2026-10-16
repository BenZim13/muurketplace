# /sdd-change — Gestionar Cambios de Requisitos

> **Uso:** `/sdd-change` — Para modificar cualquier requisito ya especificado, siguiendo el orden correcto: Spec → Plan → Tasks → Código.

## Instrucción al Agente

⚠️ **NUNCA cambiar código sin antes actualizar la spec.**

### Protocolo de Cambio

**Paso 1 — Capturar el cambio**
Preguntar al usuario:
1. ¿Qué RF específico cambia? (ej: RF-03)
2. ¿Cuál es la nueva redacción en notación EARS?
3. ¿Por qué cambia? (registrar para MEMORY.md)
4. ¿Este cambio afecta otros RFs existentes?

**Paso 2 — Impacto**
Analizar:
- ¿Qué tareas en `tasks.md` están afectadas?
- ¿Qué tests existentes deben actualizarse?
- ¿El cambio viola `docs/constitution.md`?

**Paso 3 — Propagación (en orden)**
1. Actualizar `spec.md` con el nuevo RF.
2. Actualizar `plan.md` si cambia la arquitectura o los tests.
3. Actualizar `tasks.md`: desmarcar `[x]` de las tareas afectadas.
4. Implementar los cambios en código con TDD (usar `/sdd-implement`).

**Paso 4 — Registrar**
Agregar en `MEMORY.md` bajo "Decisiones Tomadas":
```
| Cambio RF-XX en Spec 00N | <Razón del cambio> |
```

### Señales de Alerta
- Si el cambio afecta más de 3 tareas: considerar crear una nueva spec en lugar de modificar.
- Si el cambio contradice `docs/constitution.md`: detener y consultar con el equipo.
