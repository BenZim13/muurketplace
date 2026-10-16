# /sdd-validate — Validar Implementación RF por RF

> **Uso:** `/sdd-validate` — Verifica que todos los RFs de la spec activa están implementados y testeados.

## Instrucción al Agente

**Prerrequisito:** Todas las tareas de `tasks.md` marcadas como `[x]`.

### Protocolo de Validación

**Paso 1 — Correr suite completa**
```bash
node --test tests/
```
Registrar: N tests pasados, M fallidos.

**Paso 2 — Validar RF por RF**
Para cada RF en `spec.md`:
1. Buscar en `plan.md` qué test lo cubre.
2. Verificar que el test existe en `tests/`.
3. Leer el test y comparar con la redacción exacta del RF.
4. Marcar: ✅ cubierto / ⚠️ parcialmente / ❌ no cubierto.

**Paso 3 — Emitir Veredicto**

```markdown
## Veredicto de Validación — Spec 00N: <Nombre>
**Fecha:** <fecha>
**Suite de tests:** <N> pasados, <M> fallidos

| RF | Descripción | Test | Resultado |
|----|-------------|------|-----------|
| RF-01 | <descripción EARS> | `tests/x.test.js:L10` | ✅ |
| RF-02 | <descripción EARS> | `tests/x.test.js:L25` | ❌ |

### Observaciones
<Detalles de los RFs con problemas>

### Veredicto Final: [✅ APROBADO / ⚠️ CAMBIOS NECESARIOS]
<Justificación en 2-3 líneas>
```

**Paso 4 — Si APROBADO:**
- Actualizar `MEMORY.md`: marcar spec como completada, anotar aprendizajes.
- Informar al usuario qué spec puede iniciarse a continuación.
