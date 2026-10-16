# AGENTS.md — Muurketplace: Ecosistema Ganadero Tokenizado en Hedera

## Stack y Tecnología
- **Runtime:** Node.js (CommonJS, `require`)
- **Blockchain:** Hedera Testnet — SDK `@hashgraph/sdk`
- **Servicios Hedera:** HTS (tokens), HCS (trazabilidad/oráculos), HSCS (smart contracts)
- **Configuración:** `.env` con `MY_ACCOUNT_ID` y `MY_PRIVATE_KEY`
- **Tests:** `node --test` (sin frameworks externos)
- **Dependencias:** `dotenv`, `@hashgraph/sdk`

## Estructura del Proyecto
```
muurketplace/
├── AGENTS.md / MEMORY.md        # Harness del agente
├── docs/constitution.md         # Principios innegociables
├── specs/                       # Spec-Driven Development (SDD)
├── .opencode/agents/            # Agentes multiagente
├── .opencode/commands/          # Comandos custom (/sdd-*)
├── .agents/skills/              # Skills modulares
├── tests/                       # Suite de pruebas node --test
├── tokenizarToro.js             # Script demostración (no tocar en prod)
└── .env                         # Credenciales (nunca commitear)
```

## Reglas de Dominio (Nunca Olvidar)
- Un **Toro Líder** se valida por: edad destete 100-300 días, CE ≥ 1.5 cm, motilidad ≥ 70%.
- **PAJ-BRAF** = token fungible sin decimales (1 token = 1 pajuela de 0.5 ml).
- **BULL** = NFT/equity fraccionable con 4 decimales (10 supply máximo).
- Tasación: `VALOR_BASE * M_TOTAL`; base toro = \$30,000 USD, base dosis = \$10 USD.
- Los datos de entrada provienen del **Sumario de Padres PEGBraf** (fuente de verdad oficial).

## Comandos Exactos
```bash
node --test tests/          # Correr todos los tests
node tokenizarToro.js       # Mintear PAJ-BRAF en Testnet
```

## Convenciones
- Un archivo por responsabilidad; lógica pura separada de la interacción con Hedera.
- Las funciones de tasación y validación NO deben depender del SDK de Hedera (testeables sin red).
- Comentarios en español; código en inglés (nombres de variables/funciones).

## Límites del Agente
| Siempre | Pregunta antes | Nunca |
|---------|---------------|-------|
| Correr tests tras cada cambio | Cambiar el motor de tasación | Hardcodear claves privadas |
| Marcar tareas completadas en tasks.md | Usar MAINNET | Commitear `.env` |
| Seguir el flujo SDD secuencial | Añadir dependencias nuevas | Redondear pesos en múltiplos de 5/10 |

## Verificación
- Cada RF debe tener al menos un test en `tests/` que lo cubra.
- Antes de cerrar una tarea: `node --test tests/` debe pasar en verde.
- Validar transacciones en https://hashscan.io/testnet