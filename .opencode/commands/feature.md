# /feature — Planificar una funcionalidad pequeña

> **Uso:** `/feature` — Para funcionalidades de menos de 3 horas que no necesitan spec completa.

## Instrucción al Agente

1. Pregunta al usuario: ¿Qué funcionalidad querés agregar? Describiela en 1-3 oraciones.
2. Identifica qué archivos del proyecto serán afectados.
3. Lista los requisitos funcionales en notación EARS (máximo 5).
4. Propone un plan de implementación en máximo 3 tareas, con TDD.
5. Pide aprobación antes de implementar.
6. Implementa una tarea a la vez, corriendo `node --test tests/` entre cada una.

## Contexto del Proyecto
- Stack: Node.js CommonJS, `@hashgraph/sdk`, `dotenv`
- Tests: `node --test tests/`
- Lógica pura en `src/logic/`, Hedera en `src/hedera/`
