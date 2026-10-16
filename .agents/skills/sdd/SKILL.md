---
name: sdd-workflow
description: Flujo, reglas y plantillas para trabajar con Spec-Driven Development (SDD) en Muurketplace. Cargar cuando se trabaje en cualquier fase del ciclo SDD.
---

# Skill: sdd-workflow

## Ciclo SDD Completo

```
/sdd-spec → /sdd-clarify → [Aprobación] → /sdd-plan → [Aprobación]
→ /sdd-tasks → [Aprobación] → /sdd-implement (loop) → /sdd-validate
```

## Reglas de Oro del SDD

1. **Spec-first siempre:** Ningún cambio de código sin actualizar la spec primero (`/sdd-change`).
2. **Una tarea a la vez:** El implementador ejecuta exactamente una tarea por sesión.
3. **TDD obligatorio:** Test rojo → código → test verde. Sin excepciones.
4. **Aprobación entre fases:** El usuario aprueba explícitamente antes de avanzar.
5. **Spec viva:** La spec se actualiza durante toda la vida del proyecto.

## Notación EARS — Plantillas

| Plantilla | Uso |
|-----------|-----|
| `CUANDO <evento>, EL SISTEMA <respuesta>.` | Comportamiento reactivo a un evento |
| `SI <condición>, ENTONCES EL SISTEMA <respuesta>.` | Comportamiento condicional |
| `MIENTRAS <estado>, EL SISTEMA <comportamiento>.` | Comportamiento continuo |
| `EL SISTEMA <comportamiento>.` | Comportamiento incondicional/invariante |

## Estructura de Carpetas SDD

```
specs/
└── 001-motor-validacion-tasacion/
    ├── spec.md    ← QUÉ y POR QUÉ
    ├── plan.md    ← CÓMO técnico
    └── tasks.md   ← Tareas verificables
```

## Checklist de Finalización de una Spec
- [ ] Todos los checkboxes de tasks.md marcados `[x]`
- [ ] `node --test tests/` pasa 100% en verde
- [ ] `/sdd-validate` emitió veredicto `APROBADO`
- [ ] `MEMORY.md` actualizado con estado y aprendizajes
