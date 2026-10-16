# /sdd-clarify — Auditar Spec como QA

> **Uso:** `/sdd-clarify` — Audita el `spec.md` activo buscando problemas antes de planificar.

## Instrucción al Agente

1. Pide al usuario que indique qué spec auditar (número o nombre) o usa la más reciente sin `plan.md`.
2. Lee `specs/00N-<nombre>/spec.md` completo.
3. Audita con esta checklist:

### Checklist de Auditoría

**Estructura y Sintaxis EARS:**
- [ ] ¿Cada RF usa exactamente una plantilla EARS válida?
- [ ] ¿Los RFs son declarativos (qué hace el sistema, no cómo)?

**Ambigüedades:**
- [ ] ¿Hay términos sin definir? (ej: "valor alto", "rapidez", "válido")
- [ ] ¿Los umbrales numéricos son inclusivos o exclusivos? (ej: CE ≥ 1.5 vs > 1.5)

**Contradicciones:**
- [ ] ¿Algún RF contradice otro RF de esta spec?
- [ ] ¿Algún RF contradice un principio de `docs/constitution.md`?

**Casos Límite del Dominio Ganadero:**
- [ ] ¿Se cubre el caso "en el exacto límite" para cada validación? (ej: motilidad = 70%)
- [ ] ¿Se cubre qué pasa si un campo falta o es nulo?
- [ ] ¿Se cubre qué pasa si un campo tiene el tipo de dato incorrecto?

**Completitud:**
- [ ] ¿Los criterios de finalización son verificables con `node --test`?
- [ ] ¿El "Fuera de Alcance" está explicitado?

4. Reportar hallazgos en formato:
```
## Reporte de Auditoría — Spec 00N: <Nombre>

### Observaciones
[AMBIGÜEDAD] RF-02: El umbral "≥ 70%" debe confirmarse como inclusivo. Sugerencia: "mayor o igual a 70% (>=)".
[CASO LÍMITE] RF-01: ¿Qué ocurre si `edad_destete_dias` = 100 exacto? La spec dice "> 100" pero el dominio acepta 100.
[CONTRADICCIÓN] RF-03 vs RF-05: Ambos definen comportamiento ante fallo, con resultados distintos.

### Veredicto: [LISTA PARA PLANIFICAR / REQUIERE REVISIÓN]
```
