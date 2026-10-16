# Constitution — Muurketplace

> Principios innegociables definidos una sola vez. Todo código, spec y plan debe cumplirlos.
> **Para modificarlos se requiere aprobación explícita del equipo fundador.**

---

## 1. Stack Bloqueado
- **Blockchain:** Hedera Hashgraph exclusivamente (no Ethereum, no Solana).
- **Runtime:** Node.js (CommonJS). No se cambia a ESM sin decisión explícita.
- **Tests:** `node --test` nativo. No se instalan Jest, Mocha ni similares.
- **Dependencias nuevas:** Requieren aprobación antes de `npm install`.

## 2. Separación de Lógica e Infraestructura
- Las funciones de validación biológica y tasación matemática DEBEN ser **funciones puras** (input → output, sin side effects, sin llamadas a Hedera SDK).
- La capa de infraestructura (Hedera SDK, red, `.env`) NUNCA mezcla con la lógica de negocio.
- Estructura de archivos: `src/logic/` para funciones puras, `src/hedera/` para llamadas a la red.

## 3. Política de Tests
- Todo Requisito Funcional (RF) tiene al menos un test que lo verifica.
- TDD obligatorio en implementación: test en rojo → código → test en verde.
- Cobertura mínima del motor de tasación: 100% de las ramas de multiplicadores.

## 4. Protección de Datos y Seguridad
- **NUNCA** commitear `.env`, claves privadas ni Account IDs reales al repositorio.
- **NUNCA** usar Mainnet sin aprobación explícita del equipo.
- Las claves de Admin y Treasury son obligatorias en cualquier token Hedera del proyecto.

## 5. Fuente de Verdad Biológica
- Los parámetros de validación y tasación derivan **exclusivamente** del Sumario de Padres PEGBraf.
- Cualquier cambio en umbrales (ej. circunferencia escrotal mínima) requiere respaldo en un documento oficial del Programa de Evaluación Genética.

## 6. Idioma
- Comentarios y documentación: **español**.
- Nombres de variables, funciones y archivos de código: **inglés (camelCase)**.
- Mensajes de commit: **inglés**.

## 7. Criterio de "Hecho"
Una tarea está hecha cuando: el código pasa `node --test tests/` sin errores Y la implementación fue revisada contra su RF de origen.
