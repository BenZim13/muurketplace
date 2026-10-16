# /sdd-implement — Implementar Una Tarea

> **Uso:** `/sdd-implement` — Ejecuta la siguiente tarea pendiente del `tasks.md` activo con TDD estricto.

## Instrucción al Agente

**Prerrequisito:** El `tasks.md` debe estar aprobado y tener tareas sin marcar.

### Protocolo Obligatorio

**Paso 1 — Identificar tarea**
1. Leer `specs/00N-<nombre>/tasks.md`.
2. Encontrar el primer checkbox `[ ]` sin marcar.
3. Anunciar: "Voy a implementar: **Tarea N: <título>**. ¿Confirmás?"
4. Esperar confirmación del usuario.

**Paso 2 — Test primero (ROJO)**
1. Crear/editar el archivo de test indicado en la tarea.
2. Correr `node --test tests/<archivo>.test.js`.
3. Confirmar que **falla** (esto es correcto, es el estado rojo).
4. Mostrar el error al usuario.

**Paso 3 — Implementar (VERDE)**
1. Escribir el código mínimo para pasar el test.
2. NO agregar funcionalidad extra no pedida en la tarea.
3. Correr `node --test tests/` (todos los tests, no solo el nuevo).
4. Si algún test previo falla: corregir antes de continuar.

**Paso 4 — Cerrar tarea**
1. Marcar el checkbox en `tasks.md`: `[x]`.
2. Actualizar el contador de estado: "Estado: N/M tareas completadas".
3. Reportar: "✅ Tarea N completada. Tests: X pasados, 0 fallidos. Siguiente: Tarea N+1."
4. **DETENERSE.** No implementar la siguiente tarea automáticamente.

## Señales de Alerta (Detener e Informar)
- Un test previo que pasaba ahora falla → regresión, no avanzar.
- La tarea requiere cambiar la spec o el plan → detener, informar al Coordinador.
- La implementación necesita `npm install` → detener, pedir aprobación.
