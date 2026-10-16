# MEMORY.md — Estado Persistente del Proyecto

> **Instrucción al Agente:** Leer este archivo al inicio de cada sesión. Actualizar las secciones relevantes al finalizar cada tarea.

---

## Estado Actual del Proyecto
- **Fase:** Backend 001-004 COMPLETAS y APROBADAS (317 tests verdes). **Spec 005**: `spec.md` (17 RF) validado por `/sdd-clarify` (LISTA PARA PLANIFICAR) y `plan.md` APROBADO por el usuario; pendiente `/sdd-tasks` e implementación.
- **Último hito:** Spec 005 (`specs/005-flujo-tokenizacion-venta/`): spec + plan aprobados. Flujo end-to-end cabaña tokeniza su animal (par `PAJ-BRAF`+`BULL` por animal/lote) → cliente compra con transferencia HTS real → compra **atómica HTS↔HBAR** vía `MuurketplaceAtomic.sol` (reemplaza a `Muurketplace.sol`) → registro de compra en el **topic HCS de 002** → wallets de ambas partes verificables en HashScan.
- **Spec activa:** `specs/005-flujo-tokenizacion-venta` (plan aprobado; siguiente fase `/sdd-tasks`). Pendiente previo: correr E2E real 002/003/004 en Testnet.

## Decisiones Tomadas (y Por Qué)
| Decisión | Razón |
|----------|-------|
| Usar Hedera HTS sobre EVM estándar | Velocidad de finalidad y bajo costo por tx en Testnet/Mainnet |
| PAJ-BRAF sin decimales | 1 pajuela es indivisible físicamente |
| BULL con 4 decimales y supply=10 | Permite micro-fracciones para inversores minoristas |
| Motor de tasación separado del SDK | Permite testear lógica pura sin conexión a la red |
| Notación EARS para requisitos | Evita ambigüedades; directamente verificables en tests |
| Supabase como espejo off-chain (004) | Chain = verdad, Supabase solo recuerda; idempotencia por valuationKey/purchaseId |
| Aprobar `@supabase/supabase-js` al implementar 004 | Decisión usuario 2026-10-16; usada solo en `src/db/supabaseClient.js` server-side (T9 004 verificada en `tests/purity.test.js`) |
| Spec 005: `MuurketplaceAtomic.sol` reemplaza a `Muurketplace.sol` con atomicidad HTS↔HBAR | Decisión usuario (D-03/D-06): reabre/ajusta 003; conserva listado/cancelación/consultas, elimina retiro diferido (split inmediato) |
| Spec 005: allowance HIP-336 amplia y revocable por lote (D-08) | Una firma de la cabaña por lote (no por compra); mínimo privilegio; resolvió el bloqueante B1 de factibilidad |
| Spec 005: reutilizar el topic HCS de 002 para compras (D-01) | Evita topic extra; discriminador `kind`/`specVersion`; verificador de compras propio (`purchaseVerifier.js`), deja intacto `oracleVerifier.js` |

## Aprendizajes y Errores a Evitar
- ⚠️ `PrivateKey.fromStringECDSA()` requiere la clave sin el prefijo `0x`.
- ⚠️ Los multiplicadores de tasación son **aditivos** desde base 1.0 (no multiplicativos entre sí).
- ⚠️ El peso al nacer en el Sumario PEGBraf es una DEP (Diferencia Esperada en la Progenie), puede ser negativo.
- ⚠️ `.env` con `MY_PRIVATE_KEY` (Hedera Testnet) está en el repo público `github.com/BenZim13/muurketplace` (`e8058bf`/`91d612a`). **DECISIÓN (usuario 2026-10-16): NO rotar** — es Testnet, sin fondos reales, y la cuenta ya está integrada. Riesgo aceptado. `.env` ya untrackeado en `6bb75b5` (local, sin push); archivo en disco intacto.
- ⚠️ Node/Windows: `node --test tests/` (forma directorio) falla por resolución; usar `node --test "tests/*.test.js"`.
- ⚠️ Variables server-side para Node: `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY` en `.env` (las `VITE_*` de `.env.local` son solo frontend). Cargar con `node --env-file=.env`.

## Próximos Pasos
1. [x] Crear `docs/constitution.md` (principios innegociables del proyecto).
2. [x] Spec 001: Motor de Validación y Tasación — COMPLETA y APROBADA (105 tests).
3. [x] Spec 002: Registro de Oráculo en HCS — COMPLETA y APROBADA (153 tests).
4. [x] Spec 003: Marketplace y liquidación de regalías (HSCS) — COMPLETA y APROBADA (233 tests).
5. [x] Spec 004: Persistencia espejo Supabase — COMPLETA y APROBADA (317 tests).
6. [x] DB física Supabase aplicada y verificada (5 tablas + RLS + FKs).
7. [ ] E2E real Testnet: `RUN_SUPABASE_INTEGRATION=1 node --env-file=.env --test tests/supabaseIntegration.test.js`.
8. [ ] E2E real 002 (HCS) y 003 (HSCS) + despliegue del contrato `Muurketplace.sol`.
9. [ ] (Descartado por decisión) Rotar clave Hedera Testnet — riesgo aceptado, cuenta integrada.
10. [ ] `git push` del commit `6bb75b5` (opcional; deja de trackear `.env` hacia adelante).
11. [ ] Spec 005: `/sdd-tasks` (desglose TDD) → `/sdd-implement` (1 tarea a la vez) → `/sdd-validate`. Requiere desplegar `MuurketplaceAtomic.sol` en Testnet para la E2E gateada (`RUN_TOKENIZATION_INTEGRATION=1`).
