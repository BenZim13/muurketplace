import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  ExternalLink,
  RefreshCw,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { calculateBullValuation } from '../utils/pricingEngine';

export default function BullPricingAndMinting({ onBullMinted, setActiveView }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(null);

  // Form State initialized with a high-performing bull conforming to SKILL/parametros_de_toro_lider
  const [formData, setFormData] = useState({
    // Step 1: Identificación
    nombre: 'Don Luis — Gran Campeón Palermo',
    raza: 'Braford',
    subtipo: '3/8 Cebú x 5/8 Hereford',
    hba: 'HBA 184.920',
    caravana: 'ARG-COR-401',
    fecha_nacimiento: '2023-08-14',
    padre: 'Experto TE 142 (Don Enzo)',
    madre: 'Guaraní Payé 410 (Corona)',
    foto: '/assets/braford_palermo.jpg',

    // Step 2: Datos Biométricos DEP
    peso_nacer_kg: -0.5,
    peso_destete_kg: 16.0,
    edad_destete_dias: 205,
    peso_final_kg: 34.0,
    edad_peso_final_dias: 540,
    circunferencia_escrotal_cm: 2.4,

    // Step 3: Datos Ecográficos
    area_ojo_bife_cm2: 3.4,
    grasa_intramuscular_pct_top5: true,
    espesor_grasa_dorsal_mm: 8.5,

    // Step 4: Semen & Fraccionamiento
    motilidad_seminal_pct: 86,
    volumen_eyaculado_ml: 8.5,
    pajuelas_producidas: 250,
    total_tokens_lote: 3000,
    simbolo_token: 'PAJ-DLUIS',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Real-time valuation calculation
  const valuation = useMemo(() => {
    return calculateBullValuation(formData);
  }, [formData]);

  // Quick preset loaders
  const loadPreset = (type) => {
    if (type === 'record') {
      setFormData({
        nombre: 'Don Luis — Gran Campeón Palermo',
        raza: 'Braford',
        subtipo: '3/8 Cebú x 5/8 Hereford',
        hba: 'HBA 184.920',
        caravana: 'ARG-COR-401',
        fecha_nacimiento: '2023-08-14',
        padre: 'Experto TE 142 (Don Enzo)',
        madre: 'Guaraní Payé 410 (Corona)',
        foto: '/assets/braford_palermo.jpg',
        peso_nacer_kg: -0.5,
        peso_destete_kg: 16.0,
        edad_destete_dias: 205,
        peso_final_kg: 34.0,
        edad_peso_final_dias: 540,
        circunferencia_escrotal_cm: 2.4,
        area_ojo_bife_cm2: 3.4,
        grasa_intramuscular_pct_top5: true,
        espesor_grasa_dorsal_mm: 8.5,
        motilidad_seminal_pct: 86,
        volumen_eyaculado_ml: 8.5,
        pajuelas_producidas: 250,
        total_tokens_lote: 3000,
        simbolo_token: 'PAJ-DLUIS',
      });
    } else if (type === 'brangus') {
      setFormData({
        nombre: 'Pucará 459 — Rey del NEA',
        raza: 'Brangus',
        subtipo: 'Negro Mochilero (3/8 x 5/8)',
        hba: 'HBA 192.031',
        caravana: 'CHA-PIL-459',
        fecha_nacimiento: '2023-09-02',
        padre: 'Aoraki Black Thunder',
        madre: 'Pilagá 1109 Elegida',
        foto: '/assets/brangus_champion.jpg',
        peso_nacer_kg: -0.2,
        peso_destete_kg: 17.5,
        edad_destete_dias: 210,
        peso_final_kg: 33.1,
        edad_peso_final_dias: 550,
        circunferencia_escrotal_cm: 2.8,
        area_ojo_bife_cm2: 3.1,
        grasa_intramuscular_pct_top5: true,
        espesor_grasa_dorsal_mm: 7.8,
        motilidad_seminal_pct: 89,
        volumen_eyaculado_ml: 9.2,
        pajuelas_producidas: 250,
        total_tokens_lote: 3000,
        simbolo_token: 'PAJ-PUCARA',
      });
    } else {
      setFormData({
        nombre: 'Federal Mocho Estándar',
        raza: 'Braford',
        subtipo: 'Colorada Mocho',
        hba: 'HBA 165.412',
        caravana: 'COR-STD-088',
        fecha_nacimiento: '2023-10-10',
        padre: 'Payé Pampeano',
        madre: 'Vaquillona 21',
        foto: '/assets/braford_champion.jpg',
        peso_nacer_kg: 0.8,
        peso_destete_kg: 12.0,
        edad_destete_dias: 200,
        peso_final_kg: 26.0,
        edad_peso_final_dias: 530,
        circunferencia_escrotal_cm: 1.8,
        area_ojo_bife_cm2: 1.5,
        grasa_intramuscular_pct_top5: false,
        espesor_grasa_dorsal_mm: 5.5,
        motilidad_seminal_pct: 74,
        volumen_eyaculado_ml: 6.5,
        pajuelas_producidas: 200,
        total_tokens_lote: 3000,
        simbolo_token: 'PAJ-FEDSTD',
      });
    }
  };

  // Hedera Minting Flow
  const handleMintOnHedera = async () => {
    if (!valuation.isValid) return;
    setIsMinting(true);

    setTimeout(() => {
      const generatedTokenId = `0.0.${Math.floor(800000 + Math.random() * 99999)}`;
      const generatedTxId = `0.0.482910@${Math.floor(Date.now() / 1000)}.000000001`;

      const newBull = {
        id: `toro-${Date.now()}`,
        name: formData.nombre,
        breed: formData.raza,
        breedSubtype: formData.subtipo,
        cabana: 'Cabaña Los Guaraníes',
        location: 'Mercedes, Corrientes (NEA)',
        image: formData.foto,
        valuationUSD: valuation.bullValuationUSD,
        pricePerTokenUSDC: valuation.doseValuationUSD,
        totalTokens: Number(formData.total_tokens_lote),
        tokensSold: 0,
        fundedPercent: 0,
        estimatedAPY: Number((22 + valuation.multiplier * 3.5).toFixed(1)),
        htsTokenId: generatedTokenId,
        symbol: formData.simbolo_token,
        hbaRegister: formData.hba,
        tagCode: formData.caravana,
        verifiedAssociation: formData.raza === 'Braford' ? 'Asociación Braford Argentina' : 'Asociación Argentina de Brangus',
        status: 'funding',
        totalStrawsStock: Number(formData.pajuelas_producidas) * 10,
        strawsSoldYTD: 0,
        quarterlyYieldUSDC: 0,
        biometrics: { ...formData },
        pedigree: {
          padre: formData.padre,
          madre: formData.madre,
          abueloMaterno: 'Chañar TE'
        },
        oracleAudit: {
          hashScanUrl: `https://hashscan.io/testnet/token/${generatedTokenId}`,
          inspector: 'Dr. Roberto Maidana (Méd. Vet. Col. 1408)',
          certificationDate: 'Fecha actual (Testnet)',
          consensusTx: generatedTxId,
        }
      };

      setIsMinting(false);
      setMintSuccess(newBull);

      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.6 }
      });

      if (onBullMinted) {
        onBullMinted(newBull);
      }
    }, 2400);
  };

  const steps = [
    { num: 1, label: 'Identificación', desc: 'Genealogía y Registro' },
    { num: 2, label: 'Biometría DEP', desc: 'Pesos y Circunferencia' },
    { num: 3, label: 'Ecografía Carcasa', desc: 'Área Ojo de Bife y Marmóreo' },
    { num: 4, label: 'Laboratorio Seminal', desc: 'Motilidad y Emisión HTS' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-crema-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-salvia-light text-salvia font-mono text-[10px] uppercase font-bold border border-salvia-border">
              Protocolo de Valuación Ganadera
            </span>
            <span className="text-tinta-muted text-xs">· Estándar PEGBraf / Hedera HTS</span>
          </div>
          <h1 className="text-2xl font-heading font-extrabold text-tinta">
            Publicación y Tasación de Reproductor
          </h1>
          <p className="text-sm text-tinta-muted mt-0.5">
            Ingreso de métricas biológicas y ecográficas validadas para el cálculo de valor de mercado y emisión de tokens.
          </p>
        </div>

        {/* Presets de Prueba */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-tinta-muted font-medium">Cargar caso:</span>
          <button
            onClick={() => loadPreset('record')}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-crema-surface border border-crema-border text-xs text-tinta font-bold shadow-sm transition-all"
          >
            Don Luis (Palermo 2.45x)
          </button>
          <button
            onClick={() => loadPreset('brangus')}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-crema-surface border border-crema-border text-xs text-tinta-muted hover:text-tinta font-medium shadow-sm transition-all"
          >
            Pucará 459 (Brangus)
          </button>
          <button
            onClick={() => loadPreset('base')}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-crema-surface border border-crema-border text-xs text-tinta-muted hover:text-tinta font-medium shadow-sm transition-all"
          >
            Toro Estándar Base
          </button>
        </div>
      </div>

      {/* Stepper Progress Indicator */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {steps.map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <button
              key={s.num}
              onClick={() => setCurrentStep(s.num)}
              className={`p-3.5 rounded-xl text-left transition-all border ${
                isActive
                  ? 'bg-monte text-white border-monte shadow-sm'
                  : isDone
                    ? 'bg-salvia-light border-salvia-border text-salvia'
                    : 'bg-white border-crema-border text-tinta-muted hover:bg-crema-surface shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`w-5 h-5 rounded-md text-xs font-mono font-bold flex items-center justify-center ${
                  isActive
                    ? 'bg-white text-monte'
                    : isDone
                      ? 'bg-salvia text-white'
                      : 'bg-crema-surface text-tinta-muted'
                }`}>
                  {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
                </span>
                <span className={`text-[10px] font-mono uppercase font-semibold ${isActive ? 'text-white/80' : 'text-tinta-subtle'}`}>
                  Paso {s.num}/4
                </span>
              </div>
              <p className={`text-xs font-heading font-bold ${isActive ? 'text-white' : isDone ? 'text-salvia' : 'text-tinta'}`}>
                {s.label}
              </p>
              <p className={`text-[11px] truncate ${isActive ? 'text-white/80' : 'text-tinta-muted'}`}>
                {s.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Grid: Form Inputs (Left 7 Cols) & Smart Valuation Calculator (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Form Container (7 Cols) */}
        <div className="lg:col-span-7 space-y-5 muurket-card bg-white border border-crema-border p-6 shadow-sm">
          
          {/* STEP 1: Identificación y Registro */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-crema-border">
                <h3 className="text-sm font-heading font-extrabold text-tinta">
                  1. Registro Genealógico y Cabaña
                </h3>
                <span className="text-xs text-tinta-muted font-medium">Datos Sociedad Rural Argentina</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Nombre del Reproductor
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    className="w-full muurket-input bg-crema-canvas border-crema-border text-tinta font-medium"
                    placeholder="Ej. Don Luis — Gran Campeón"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Raza
                  </label>
                  <select
                    value={formData.raza}
                    onChange={(e) => handleChange('raza', e.target.value)}
                    className="w-full muurket-input bg-crema-canvas border-crema-border text-tinta font-medium"
                  >
                    <option value="Braford">Braford (Hereford x Cebú)</option>
                    <option value="Brangus">Brangus (Angus x Cebú)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Registro Genealógico (HBA)
                  </label>
                  <input
                    type="text"
                    value={formData.hba}
                    onChange={(e) => handleChange('hba', e.target.value)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                    placeholder="HBA 184.920"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Caravana Oficial SENASA
                  </label>
                  <input
                    type="text"
                    value={formData.caravana}
                    onChange={(e) => handleChange('caravana', e.target.value)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                    placeholder="ARG-COR-401"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Padre (Genealogía)
                  </label>
                  <input
                    type="text"
                    value={formData.padre}
                    onChange={(e) => handleChange('padre', e.target.value)}
                    className="w-full muurket-input bg-crema-canvas border-crema-border text-tinta"
                    placeholder="Experto TE 142"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Madre (Donante)
                  </label>
                  <input
                    type="text"
                    value={formData.madre}
                    onChange={(e) => handleChange('madre', e.target.value)}
                    className="w-full muurket-input bg-crema-canvas border-crema-border text-tinta"
                    placeholder="Guaraní Payé 410"
                  />
                </div>
              </div>

              {/* Selector de Fotografía Documental */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-tinta mb-2">
                  Fotografía Documental del Animal
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { path: '/assets/braford_palermo.jpg', label: 'Braford Palermo' },
                    { path: '/assets/brangus_champion.jpg', label: 'Brangus Negro' },
                    { path: '/assets/braford_champion.jpg', label: 'Braford Paddock' },
                  ].map((img) => (
                    <div
                      key={img.path}
                      onClick={() => handleChange('foto', img.path)}
                      className={`cursor-pointer rounded-xl overflow-hidden border transition-all shadow-sm ${
                        formData.foto === img.path ? 'border-monte ring-2 ring-monte' : 'border-crema-border opacity-75 hover:opacity-100 hover:border-cuero/50'
                      }`}
                    >
                      <img src={img.path} alt={img.label} className="w-full h-20 object-cover" />
                      <div className="p-1.5 bg-crema-surface text-[11px] text-center text-tinta font-bold truncate border-t border-crema-border">
                        {img.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Datos Biométricos DEP */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-crema-border">
                <h3 className="text-sm font-heading font-extrabold text-tinta">
                  2. Diferencias Esperadas en la Progenie (DEP)
                </h3>
                <span className="text-[11px] text-tinta-muted font-mono font-medium">Escala de 1 kg exacto</span>
              </div>

              <div className="p-3 rounded-lg bg-salvia-light border border-salvia-border text-xs text-tinta-light flex items-start gap-2">
                <Info className="w-4 h-4 text-salvia flex-shrink-0 mt-0.5" />
                <span>
                  Los DEPs evalúan el impacto genético transmitido a la descendencia. Una DEP de PN ≤ 0.0 kg añade una bonificación de <strong>+0.50x</strong> por facilidad de parto.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-tinta">
                      DEP Peso al Nacer (kg)
                    </label>
                    <span className="text-[10px] font-mono text-salvia font-bold">Bono si ≤ 0.0</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.peso_nacer_kg}
                    onChange={(e) => handleChange('peso_nacer_kg', parseFloat(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <p className="text-[11px] text-tinta-muted mt-1">
                    {formData.peso_nacer_kg <= 0 ? '✓ Cumple criterio Top 1% (+0.50x)' : 'Sin bonificación'}
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-tinta">
                      Circunferencia Escrotal (cm)
                    </label>
                    <span className="text-[10px] font-mono text-tinta-muted">Mínimo +1.5 cm</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.circunferencia_escrotal_cm}
                    onChange={(e) => handleChange('circunferencia_escrotal_cm', parseFloat(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <p className="text-[11px] text-tinta-muted mt-1">
                    {formData.circunferencia_escrotal_cm >= 1.5 ? '✓ Aprobado para reproducción' : 'Rechazado: menor a +1.5 cm'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    DEP Peso al Destete (kg)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.peso_destete_kg}
                    onChange={(e) => handleChange('peso_destete_kg', parseFloat(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <span className="text-[10px] text-tinta-muted">Umbral bonificación: &gt; +15 kg</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Edad al Destete (días)
                  </label>
                  <input
                    type="number"
                    value={formData.edad_destete_dias}
                    onChange={(e) => handleChange('edad_destete_dias', parseInt(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <span className="text-[10px] text-tinta-muted">Rango normativo: 100 - 300 días</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    DEP Peso Final 18 Meses (kg)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.peso_final_kg}
                    onChange={(e) => handleChange('peso_final_kg', parseFloat(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <span className="text-[10px] text-tinta-muted">Umbral bonificación: &gt; +30 kg</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Edad a Medición Final (días)
                  </label>
                  <input
                    type="number"
                    value={formData.edad_peso_final_dias}
                    onChange={(e) => handleChange('edad_peso_final_dias', parseInt(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <span className="text-[10px] text-tinta-muted">Rango normativo: 450 - 730 días</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Datos Ecográficos */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-crema-border">
                <h3 className="text-sm font-heading font-extrabold text-tinta">
                  3. Ecografía de Carcasa a 18 Meses
                </h3>
                <span className="text-xs text-tinta-muted">Medición por médico veterinario habilitado</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-tinta">
                      Área de Ojo de Bife — AOB (cm²)
                    </label>
                    <span className="text-[10px] font-mono text-salvia font-bold">
                      {formData.area_ojo_bife_cm2 >= 3.0 ? '+0.50x (Top 1-5%)' : formData.area_ojo_bife_cm2 >= 2.0 ? '+0.20x (Top 20%)' : '0.00x'}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.area_ojo_bife_cm2}
                    onChange={(e) => handleChange('area_ojo_bife_cm2', parseFloat(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <p className="text-[11px] text-tinta-muted mt-1">
                    Rendimiento carnicero en cortes de exportación Hilton.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Espesor de Grasa Dorsal (mm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.espesor_grasa_dorsal_mm}
                    onChange={(e) => handleChange('espesor_grasa_dorsal_mm', parseFloat(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <span className="text-[10px] text-tinta-muted">Terminación y engrasamiento a pasto</span>
                </div>
              </div>

              {/* Marmóreo / Grasa Intramuscular */}
              <div className="p-3.5 rounded-xl bg-crema-surface border border-crema-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-tinta">
                    Grasa Intramuscular (GI) — Pertenencia al Top 5%
                  </p>
                  <p className="text-[11px] text-tinta-muted mt-0.5">
                    Certifica marbling superior para mercados de carne de alta calidad (+0.30x).
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={formData.grasa_intramuscular_pct_top5}
                    onChange={(e) => handleChange('grasa_intramuscular_pct_top5', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-crema-border rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-monte"></div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 4: Laboratorio Seminal */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-crema-border">
                <h3 className="text-sm font-heading font-extrabold text-tinta">
                  4. Laboratorio Seminal y Tokenización HTS
                </h3>
                <span className="text-xs text-tinta-muted font-medium">Suministro Finito Hedera</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-tinta">
                      Motilidad Seminal Progresiva (%)
                    </label>
                    <span className="text-[10px] font-mono text-tinta-muted">Exigencia: ≥ 70%</span>
                  </div>
                  <input
                    type="number"
                    value={formData.motilidad_seminal_pct}
                    onChange={(e) => handleChange('motilidad_seminal_pct', parseInt(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <p className="text-[11px] text-tinta-muted mt-1">
                    {formData.motilidad_seminal_pct >= 70 ? '✓ Calidad apta para congelado' : 'Rechazado: menor a 70%'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Volumen de Eyaculado (ml)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.volumen_eyaculado_ml}
                    onChange={(e) => handleChange('volumen_eyaculado_ml', parseFloat(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <span className="text-[10px] text-tinta-muted">0.5 ml estándar por pajuela</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Pajuelas Producidas en Salto
                  </label>
                  <input
                    type="number"
                    value={formData.pajuelas_producidas}
                    onChange={(e) => handleChange('pajuelas_producidas', parseInt(e.target.value) || 0)}
                    className="w-full muurket-input font-mono bg-crema-canvas border-crema-border text-tinta"
                  />
                  <span className="text-[10px] text-tinta-muted">Dosis físicas generadas en el lote</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-tinta mb-1">
                    Símbolo del Token HTS
                  </label>
                  <input
                    type="text"
                    value={formData.simbolo_token}
                    onChange={(e) => handleChange('simbolo_token', e.target.value.toUpperCase())}
                    className="w-full muurket-input font-mono font-bold text-monte bg-crema-canvas border-crema-border"
                    placeholder="PAJ-BRAF"
                  />
                  <span className="text-[10px] text-tinta-muted">Token fungible común no fraccionable (0 decimales)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-salvia-light border border-salvia-border text-xs text-tinta-light">
                Cada token emitido confiere derechos económicos sobre la venta física de dosis seminales registradas bajo trazabilidad Hedera Consensus.
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-crema-border">
            {currentStep > 1 ? (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-crema-surface hover:bg-crema-border text-tinta text-xs font-semibold transition-colors border border-crema-border"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Paso Anterior</span>
              </button>
            ) : <div />}

            {currentStep < 4 ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-action-primary text-white text-xs font-heading font-semibold transition-all shadow-sm"
              >
                <span>Siguiente Paso</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleMintOnHedera}
                disabled={!valuation.isValid || isMinting}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-heading font-bold transition-all shadow-sm ${
                  valuation.isValid && !isMinting
                    ? 'btn-action-primary'
                    : 'bg-crema-surface text-tinta-muted border border-crema-border cursor-not-allowed'
                }`}
              >
                {isMinting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Emitiendo en Hedera...</span>
                  </>
                ) : (
                  <span>Tasar y Tokenizar Activo</span>
                )}
              </button>
            )}
          </div>

        </div>

        {/* Smart Valuation Calculator (Right 5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-crema-border p-6 shadow-sm">
            
            {/* Header with Title & Status */}
            <div className="flex items-center justify-between pb-3 border-b border-crema-border">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-tinta-muted font-medium">
                  Panel de Tasación Algorítmica
                </h3>
                <p className="text-xs text-tinta font-heading font-bold">Motor PEGBraf Ganadero</p>
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1 border font-bold ${
                valuation.isValid
                  ? 'bg-salvia-light text-salvia border-salvia-border'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {valuation.isValid ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Toro Líder Admitido</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    <span>Inconsistencias</span>
                  </>
                )}
              </span>
            </div>

            {/* Main Valuation Display */}
            <div className="my-5 p-5 rounded-xl bg-gradient-to-br from-monte to-monte-dark text-white text-center shadow-sm">
              <span className="text-[11px] font-mono uppercase tracking-wider text-white/80 font-medium">
                Valor de Mercado Estimado del Toro
              </span>
              <div className="mt-1 text-3xl xl:text-4xl font-heading font-extrabold text-white tracking-tight font-mono">
                ${valuation.bullValuationUSD.toLocaleString()} <span className="text-base font-normal text-white/80">USD</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-4 text-xs text-white/90 pt-2 border-t border-white/20">
                <span>
                  Valor por Dosis: <strong className="text-white font-mono">${valuation.doseValuationUSD.toFixed(2)} USDC</strong>
                </span>
                <span className="text-white/30">|</span>
                <span>
                  Factor: <strong className="text-white font-mono">{valuation.multiplier}x</strong>
                </span>
              </div>
            </div>

            {/* Multiplier Factor Breakdown */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-tinta-muted font-bold mb-1">
                Factores de Bonificación Evaluados
              </p>
              {valuation.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg flex items-center justify-between text-xs border transition-colors ${
                    item.applied
                      ? 'bg-crema-surface border-crema-border hover:border-salvia-border text-tinta'
                      : 'bg-crema-canvas/50 border-crema-border/50 text-tinta-subtle'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className={`font-bold text-xs ${item.applied ? 'text-tinta' : 'text-tinta-muted'}`}>
                      {item.name}
                    </p>
                    <p className="text-[10px] text-tinta-muted truncate">
                      {item.description}
                    </p>
                  </div>
                  <span className={`font-mono text-xs font-bold whitespace-nowrap ${item.applied ? 'text-salvia' : 'text-tinta-subtle'}`}>
                    {item.factor}
                  </span>
                </div>
              ))}
            </div>

            {/* Validation errors */}
            {!valuation.isValid && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Criterios no alcanzados:</span>
                </p>
                <ul className="list-disc list-inside text-[11px] text-rose-700 space-y-0.5">
                  {valuation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tokenization Summary */}
            <div className="mt-5 pt-3.5 border-t border-crema-border space-y-2 text-xs">
              <div className="flex justify-between text-tinta-muted">
                <span>Fracciones a emitir:</span>
                <span className="font-mono text-tinta font-bold">
                  {formData.total_tokens_lote.toLocaleString()} {formData.simbolo_token}
                </span>
              </div>
              <div className="flex justify-between text-tinta-muted">
                <span>Recaudación objetivo:</span>
                <span className="font-mono text-tinta font-bold">
                  ${(formData.total_tokens_lote * valuation.doseValuationUSD).toLocaleString()} USDC
                </span>
              </div>
              <div className="flex justify-between text-tinta-muted">
                <span>Blockchain:</span>
                <span className="font-mono text-cuero font-semibold text-[11px]">Hedera Token Service (HTS)</span>
              </div>
            </div>

            {/* Main Action Button */}
            <div className="mt-5">
              <button
                onClick={handleMintOnHedera}
                disabled={!valuation.isValid || isMinting}
                className={`w-full py-3 px-4 rounded-lg font-heading font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm ${
                  valuation.isValid && !isMinting
                    ? 'btn-action-primary'
                    : 'bg-crema-surface text-tinta-muted border border-crema-border cursor-not-allowed'
                }`}
              >
                {isMinting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Conectando con Hedera Consensus...</span>
                  </>
                ) : (
                  <span>Tasar y Tokenizar Activo</span>
                )}
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Minting Confirmation Modal */}
      {mintSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-tinta/60 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-crema-border shadow-elevated space-y-4">
            
            <div className="text-center space-y-1">
              <span className="px-2.5 py-0.5 rounded-full bg-salvia-light text-salvia font-mono text-[10px] uppercase font-bold border border-salvia-border">
                Transacción Confirmada en Hedera
              </span>
              <h2 className="text-lg font-heading font-extrabold text-tinta mt-2">
                {mintSuccess.name}
              </h2>
              <p className="text-xs text-tinta-muted">
                Token fungible finito creado exitosamente bajo el estándar HTS.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-crema-surface border border-crema-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-tinta-muted">Token ID Hedera:</span>
                <span className="font-mono text-salvia font-bold">{mintSuccess.htsTokenId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-muted">Símbolo:</span>
                <span className="font-mono text-tinta font-bold">{mintSuccess.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-muted">Tasación Oficial:</span>
                <span className="font-mono text-tinta font-bold">${mintSuccess.valuationUSD.toLocaleString()} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-muted">Precio por Fracción:</span>
                <span className="font-mono text-cuero font-bold">${mintSuccess.pricePerTokenUSDC.toFixed(2)} USDC</span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <a
                href={mintSuccess.oracleAudit.hashScanUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 px-3 rounded-lg bg-crema-surface hover:bg-crema-border border border-crema-border text-center text-tinta text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Ver en HashScan</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => {
                  setMintSuccess(null);
                  setActiveView('seller-dashboard');
                }}
                className="flex-1 py-2 px-3 rounded-lg btn-action-primary text-xs font-heading font-bold"
              >
                Ir a Mi Dashboard
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
