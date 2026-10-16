/**
 * Motor de Validación Biológica y Tasación Algorítmica (SKILL: ganaderia-pricing-engine)
 * Especificación de Toros Líderes (Braford / Brangus) - NEA Argentina
 */

export const VALOR_BASE_TORO = 30000; // USD piso comercial
export const VALOR_BASE_DOSIS = 10;   // USD piso comercial por pajuela

export function validateBullParameters(data) {
  const errors = [];
  const warnings = [];

  const edadDestete = Number(data.edad_destete_dias);
  const edadFinal = Number(data.edad_peso_final_dias);
  const circEscrotal = Number(data.circunferencia_escrotal_cm);
  const motilidad = Number(data.motilidad_seminal_pct);
  const pesoDestete = Number(data.peso_destete_kg);
  const pesoFinal = Number(data.peso_final_kg);

  // 1. Regla de Escala de Peso: sin redondeos gruesos
  if (!Number.isFinite(pesoDestete) || !Number.isFinite(pesoFinal)) {
    errors.push("Los pesos de destete y peso final deben ser números válidos con precisión de 1 kg.");
  }

  // 2. Regla de Edad al Destete (100 - 300 días)
  if (edadDestete < 100 || edadDestete > 300) {
    errors.push(`Edad al destete (${edadDestete} d) fuera de rango normativo [100 - 300 días].`);
  }

  // 3. Regla de Edad Final (450 - 730 días)
  if (edadFinal < 450 || edadFinal > 730) {
    errors.push(`Edad a medición final (${edadFinal} d) fuera de rango normativo [450 - 730 días].`);
  }

  // 4. Regla de Circunferencia Escrotal (>= +1.5 cm)
  if (circEscrotal < 1.5) {
    errors.push(`Circunferencia escrotal (+${circEscrotal} cm) por debajo del piso de fertilidad (+1.5 cm).`);
  }

  // 5. Regla de Viabilidad Seminal (>= 70%)
  if (motilidad < 70) {
    errors.push(`Motilidad seminal (${motilidad}%) rechazada: se requiere un mínimo de 70% de motilidad progresiva.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function calculateBullValuation(data) {
  const validation = validateBullParameters(data);

  let mTotal = 1.0;
  const breakdown = [
    {
      name: "Piso Base de Padre Probado",
      factor: 1.0,
      description: "Valor base de referencia para reproductor de centro genético",
      applied: true,
    }
  ];

  // 1. Facilidad de Parto (Peso al Nacer <= 0.0 DEP)
  const pesoNacer = Number(data.peso_nacer_kg);
  if (pesoNacer <= 0.0) {
    mTotal += 0.50;
    breakdown.push({
      name: "Facilidad de Parto (Top 1%)",
      factor: "+0.50x",
      description: `DEP PN ≤ 0.0 (${pesoNacer} kg): minimiza distocias en vaquillonas`,
      applied: true,
      color: "text-fluor"
    });
  } else {
    breakdown.push({
      name: "Facilidad de Parto (Top 1%)",
      factor: "+0.00x",
      description: `DEP PN > 0.0 (${pesoNacer} kg): sin bonificación`,
      applied: false,
      color: "text-slate-500"
    });
  }

  // 2. Rentabilidad por Crecimiento (PD > +15 AND PF > +30)
  const pesoDestete = Number(data.peso_destete_kg);
  const pesoFinal = Number(data.peso_final_kg);
  if (pesoDestete > 15.0 && pesoFinal > 30.0) {
    mTotal += 0.15;
    breakdown.push({
      name: "Rentabilidad por Crecimiento",
      factor: "+0.15x",
      description: `DEP PD > +15 (${pesoDestete} kg) & PF > +30 (${pesoFinal} kg)`,
      applied: true,
      color: "text-fluor"
    });
  } else {
    breakdown.push({
      name: "Rentabilidad por Crecimiento",
      factor: "+0.00x",
      description: "No supera los umbrales simultáneos de PD (+15kg) y PF (+30kg)",
      applied: false,
      color: "text-slate-500"
    });
  }

  // 3. Rendimiento Carnicero (AOB)
  const aob = Number(data.area_ojo_bife_cm2);
  if (aob >= 3.0) {
    mTotal += 0.50;
    breakdown.push({
      name: "Rendimiento Carnicero (AOB Top 1-5%)",
      factor: "+0.50x",
      description: `Área de Ojo de Bife ≥ +3.0 (${aob} cm²): altísimo rinde industrial`,
      applied: true,
      color: "text-fluor"
    });
  } else if (aob >= 2.0) {
    mTotal += 0.20;
    breakdown.push({
      name: "Rendimiento Carnicero (AOB Top 20%)",
      factor: "+0.20x",
      description: `Área de Ojo de Bife ≥ +2.0 y < +3.0 (${aob} cm²)`,
      applied: true,
      color: "text-emerald-400"
    });
  } else {
    breakdown.push({
      name: "Rendimiento Carnicero (AOB)",
      factor: "+0.00x",
      description: `Área de Ojo de Bife (${aob} cm²) debajo del Top 20% (+2.0 cm²)`,
      applied: false,
      color: "text-slate-500"
    });
  }

  // 4. Calidad Premium (Grasa Intramuscular GI Top 5%)
  const giTop5 = Boolean(data.grasa_intramuscular_pct_top5);
  if (giTop5) {
    mTotal += 0.30;
    breakdown.push({
      name: "Calidad Premium Marmóreo (GI Top 5%)",
      factor: "+0.30x",
      description: "Top 5% Grasa Intramuscular: terneza y marbling para exportación cuota Hilton",
      applied: true,
      color: "text-fluor"
    });
  } else {
    breakdown.push({
      name: "Calidad Premium Marmóreo (GI)",
      factor: "+0.00x",
      description: "Sin certificación Top 5% de marbling",
      applied: false,
      color: "text-slate-500"
    });
  }

  // Redondear factor a 2 decimales
  const finalMultiplier = Number(mTotal.toFixed(2));
  const bullValuation = Math.round(VALOR_BASE_TORO * finalMultiplier);
  const doseValuation = Number((VALOR_BASE_DOSIS * finalMultiplier).toFixed(2));

  return {
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings,
    multiplier: finalMultiplier,
    bullValuationUSD: bullValuation,
    doseValuationUSD: doseValuation,
    breakdown
  };
}
