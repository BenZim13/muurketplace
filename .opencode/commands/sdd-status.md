# /sdd-status — Estado Actual del Proyecto

> **Uso:** `/sdd-status` — Reporta el estado actual, progreso de tareas y el siguiente comando a ejecutar.

## Instrucción al Agente

Leer los siguientes archivos y generar un reporte:
1. `MEMORY.md` — Estado general y próximos pasos.
2. `specs/` — Listar todas las specs y su estado.
3. Para cada spec activa: leer `tasks.md` y contar checkboxes.

### Formato del Reporte

```markdown
## 📊 Estado del Proyecto Muurketplace
**Fecha:** <fecha actual>

### Specs
| # | Nombre | Fase | Progreso |
|---|--------|------|----------|
| 001 | Motor de Validación | Implementación | 3/5 tareas ✅ |
| 002 | Oráculo HCS | ⏳ Pendiente | — |

### Spec Activa: 001 — Motor de Validación
**Fase actual:** Implementación
**Tarea en curso:** Tarea 4: Calcular multiplicadores de tasación
**Tests:** `node --test tests/` → 8 pasados, 0 fallidos

### Próxima Acción Recomendada
👉 Ejecutar `/sdd-implement` para continuar con la Tarea 4.
```
