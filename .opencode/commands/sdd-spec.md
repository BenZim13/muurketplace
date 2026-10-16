# /sdd-spec — Generar Especificación

> **Uso:** `/sdd-spec` — Entrevista al usuario y genera `specs/00N-<nombre>/spec.md`.

## Instrucción al Agente

### Fase 1: Entrevista (Preguntas clave)
Haz estas preguntas de forma conversacional (no como formulario):

1. ¿Qué problema concreto resuelve esta funcionalidad?
2. ¿Quién la usa? (veterinario oráculo / inversor / productor / consumidor final)
3. ¿Cuál es el flujo principal paso a paso?
4. ¿Qué debe rechazar o no permitir el sistema?
5. ¿Qué casos especiales o límite se te ocurren?
6. ¿Cómo sabemos que está correctamente implementada?

### Fase 2: Generar spec.md
Crea el archivo en `specs/00N-<nombre-kebab>/spec.md` con esta estructura:

```markdown
# Spec 00N: <Nombre>

## Contexto y Problema
<Por qué existe esta funcionalidad>

## Actores
- **<Actor>:** <rol en esta spec>

## Historias de Usuario
- Como <actor>, quiero <acción> para <beneficio>.

## Requisitos Funcionales (Notación EARS)
- **RF-01:** CUANDO <evento>, EL SISTEMA <respuesta>.
- **RF-02:** SI <condición>, ENTONCES EL SISTEMA <respuesta>.

## Requisitos No Funcionales
- **RNF-01:** <Restricción técnica/performance/seguridad>

## Casos Límite
- <Límite 1>: <comportamiento esperado>

## Fuera de Alcance
- <Qué NO hace esta spec>

## Criterios de Finalización
- [ ] <Criterio verificable 1>

## Dudas Abiertas
- <Pregunta pendiente de respuesta>
```

### Fase 3: Validar contra Constitution
Verificar que ningún RF viola `docs/constitution.md`. Si hay conflicto, marcar como "Duda Abierta".
