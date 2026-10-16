import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  ExternalLink, 
  CheckCircle2, 
  RefreshCw,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function BullDetailModal({ 
  bull, 
  onClose, 
  onInvestSuccess,
  investorBalance 
}) {
  const [tokenAmount, setTokenAmount] = useState(10);
  const [activeTab, setActiveTab] = useState('biometrics');
  const [isInvesting, setIsInvesting] = useState(false);
  const [investSuccess, setInvestSuccess] = useState(null);

  if (!bull) return null;

  const totalCostUSDC = Number((tokenAmount * bull.pricePerTokenUSDC).toFixed(2));
  const estimatedAnnualYieldUSDC = Number(((totalCostUSDC * bull.estimatedAPY) / 100).toFixed(2));
  const shareOfBullPct = ((tokenAmount / bull.totalTokens) * 100).toFixed(2);
  const remainingTokens = bull.totalTokens - bull.tokensSold;

  const handleQuickAdd = (amount) => {
    setTokenAmount(prev => Math.min(remainingTokens, Math.max(1, prev + amount)));
  };

  const handleInvest = () => {
    setIsInvesting(true);

    setTimeout(() => {
      const txHash = `0.0.651928@${Math.floor(Date.now() / 1000)}.000000001`;
      setIsInvesting(false);
      setInvestSuccess({
        bullName: bull.name,
        tokensPurchased: tokenAmount,
        totalCost: totalCostUSDC,
        txHash,
        hashScanUrl: `https://hashscan.io/testnet/transaction/${txHash}`
      });

      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.5 }
      });

      if (onInvestSuccess) {
        onInvestSuccess({
          bullId: bull.id,
          bullName: bull.name,
          tokens: tokenAmount,
          costUSDC: totalCostUSDC,
          bull
        });
      }
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-profundo-dark/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-5xl muurket-panel border-verdeSuave/20 shadow-elevated overflow-hidden my-auto relative max-h-[92vh] flex flex-col">
        
        {/* Modal Topbar */}
        <div className="px-5 py-3.5 bg-monte-dark/90 border-b border-verdeSuave/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="status-dot-active"></span>
            <span className="font-mono text-xs uppercase text-piedra">
              Ficha Técnica de Reproductor Bovino RWA
            </span>
            <span className="text-verdeSuave/20">|</span>
            <span className="text-xs text-crema font-mono font-medium">
              Token HTS: {bull.htsTokenId}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-monte text-piedra hover:text-blanco transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-5 md:p-7 grid grid-cols-1 lg:grid-cols-12 gap-7">
          
          {/* Left Column: Biological Details (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Bull Header Photo Banner */}
            <div className="relative rounded-xl overflow-hidden h-60 border border-verdeSuave/15 shadow-sm">
              <img
                src={bull.image}
                alt={bull.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-profundo-dark via-profundo-dark/30 to-transparent" />
              
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="px-2.5 py-0.5 rounded bg-profundo/90 text-xs font-mono text-crema border border-verdeSuave/15">
                  {bull.breed}
                </span>
                <span className="px-2.5 py-0.5 rounded bg-profundo/90 text-xs font-mono text-piedra border border-verdeSuave/10">
                  {bull.symbol}
                </span>
              </div>

              <div className="absolute bottom-3 left-4 right-4">
                <span className="text-xs text-crema font-medium">{bull.cabana}</span>
                <h2 className="text-xl md:text-2xl font-heading font-extrabold text-blanco">
                  {bull.name}
                </h2>
                <p className="text-xs text-piedra font-mono mt-0.5">
                  {bull.hbaRegister} · Caravana: {bull.tagCode} · {bull.location}
                </p>
              </div>
            </div>

            {/* Technical Tabs Selector */}
            <div className="flex border-b border-verdeSuave/10 gap-5 text-xs font-heading font-semibold">
              <button
                onClick={() => setActiveTab('biometrics')}
                className={`pb-2.5 transition-colors ${
                  activeTab === 'biometrics'
                    ? 'text-blanco border-b-2 border-esmeralda font-bold'
                    : 'text-piedra hover:text-blanco'
                }`}
              >
                DEPs & Biometría
              </button>

              <button
                onClick={() => setActiveTab('carcass')}
                className={`pb-2.5 transition-colors ${
                  activeTab === 'carcass'
                    ? 'text-blanco border-b-2 border-esmeralda font-bold'
                    : 'text-piedra hover:text-blanco'
                }`}
              >
                Ecografía Carcasa
              </button>

              <button
                onClick={() => setActiveTab('semen')}
                className={`pb-2.5 transition-colors ${
                  activeTab === 'semen'
                    ? 'text-blanco border-b-2 border-esmeralda font-bold'
                    : 'text-piedra hover:text-blanco'
                }`}
              >
                Laboratorio Seminal
              </button>

              <button
                onClick={() => setActiveTab('pedigree')}
                className={`pb-2.5 transition-colors ${
                  activeTab === 'pedigree'
                    ? 'text-blanco border-b-2 border-esmeralda font-bold'
                    : 'text-piedra hover:text-blanco'
                }`}
              >
                Pedigree & Oráculo
              </button>
            </div>

            {/* Tab 1: DEPs & Biometrics */}
            {activeTab === 'biometrics' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                <div className="flex items-center justify-between text-piedra pb-1">
                  <span>Diferencias Esperadas en la Progenie (Sumario Oficial)</span>
                  <span className="text-[10px] text-esmeralda font-mono">Verificado Asociación</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg muurket-solid space-y-1">
                    <span className="text-piedra text-[11px] block">DEP Peso al Nacer</span>
                    <span className="font-mono font-bold text-base text-blanco">
                      {bull.biometrics.peso_nacer_kg} kg
                    </span>
                    <span className="text-[10px] text-crema block">
                      {bull.biometrics.peso_nacer_percentile} (Facilidad de parto)
                    </span>
                  </div>

                  <div className="p-3 rounded-lg muurket-solid space-y-1">
                    <span className="text-piedra text-[11px] block">DEP Peso al Destete</span>
                    <span className="font-mono font-bold text-base text-blanco">
                      +{bull.biometrics.peso_destete_kg} kg
                    </span>
                    <span className="text-[10px] text-piedra block">
                      Medición: {bull.biometrics.edad_destete_dias} días
                    </span>
                  </div>

                  <div className="p-3 rounded-lg muurket-solid space-y-1">
                    <span className="text-piedra text-[11px] block">DEP Peso Final 18m</span>
                    <span className="font-mono font-bold text-base text-blanco">
                      +{bull.biometrics.peso_final_kg} kg
                    </span>
                    <span className="text-[10px] text-piedra block">
                      Medición: {bull.biometrics.edad_peso_final_dias} días
                    </span>
                  </div>

                  <div className="p-3 rounded-lg muurket-solid space-y-1">
                    <span className="text-piedra text-[11px] block">Circunferencia Escrotal</span>
                    <span className="font-mono font-bold text-base text-blanco">
                      +{bull.biometrics.circunferencia_escrotal_cm} cm
                    </span>
                    <span className="text-[10px] text-crema block">
                      Fertilidad comprobada
                    </span>
                  </div>

                  <div className="p-3 rounded-lg muurket-solid space-y-1">
                    <span className="text-piedra text-[11px] block">Conformación Carnicera</span>
                    <span className="font-mono font-bold text-base text-blanco">Sobresaliente</span>
                    <span className="text-[10px] text-piedra block">Evaluación fenotípica</span>
                  </div>

                  <div className="p-3 rounded-lg muurket-solid space-y-1">
                    <span className="text-piedra text-[11px] block">Adaptación Subtropical</span>
                    <span className="font-mono font-bold text-base text-esmeralda">100% Inmune</span>
                    <span className="text-[10px] text-piedra block">Garrapata y calor NEA</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Carcass Ultrasound */}
            {activeTab === 'carcass' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg muurket-solid space-y-1">
                    <span className="text-piedra text-[11px] block">Área de Ojo de Bife (AOB)</span>
                    <span className="font-mono font-bold text-2xl text-blanco">
                      +{bull.biometrics.area_ojo_bife_cm2} cm²
                    </span>
                    <p className="text-xs text-crema font-medium">
                      {bull.biometrics.area_ojo_bife_percentile}
                    </p>
                    <p className="text-[11px] text-piedra pt-1">
                      Medición ecográfica oficial a los 18 meses. Alto rendimiento de cortes valiosos en gancho.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg muurket-solid space-y-1">
                    <span className="text-piedra text-[11px] block">Grasa Intramuscular (GI)</span>
                    <span className="font-mono font-bold text-2xl text-cuero">
                      Top 5%
                    </span>
                    <p className="text-xs text-cuero font-medium">
                      Marmóreo Hilton Certificado
                    </p>
                    <p className="text-[11px] text-piedra pt-1">
                      Infiltración grasa que transmite terneza comprobada a la descendencia en faena.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Semen Laboratory */}
            {activeTab === 'semen' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                <div className="p-3 rounded-lg bg-monte-dark/60 border border-verdeSuave/10 flex items-center justify-between">
                  <div>
                    <span className="text-piedra text-[11px] block">Centro de Inseminación Habilitado</span>
                    <span className="font-medium text-blanco text-xs">Laboratorio de Biotecnología Seminal Litoral</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-profundo text-crema font-mono text-[10px] border border-verdeSuave/10">
                    SENASA #BA-912
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg muurket-solid text-center">
                    <span className="text-piedra text-[11px] block">Motilidad Progresiva</span>
                    <span className="font-mono font-bold text-lg text-esmeralda">{bull.biometrics.motilidad_seminal_pct}%</span>
                    <span className="text-[10px] text-piedra block mt-0.5">Norma SENASA: &gt;70%</span>
                  </div>
                  <div className="p-3 rounded-lg muurket-solid text-center">
                    <span className="text-piedra text-[11px] block">Volumen por Salto</span>
                    <span className="font-mono font-bold text-lg text-blanco">{bull.biometrics.volumen_eyaculado_ml} ml</span>
                    <span className="text-[10px] text-piedra block mt-0.5">Dosis: 0.5 ml</span>
                  </div>
                  <div className="p-3 rounded-lg muurket-solid text-center">
                    <span className="text-piedra text-[11px] block">Concentración</span>
                    <span className="font-mono font-bold text-lg text-crema">{bull.biometrics.concentracion_millones_ml} M/ml</span>
                    <span className="text-[10px] text-piedra block mt-0.5">Viabilidad probada</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Pedigree & Oracle */}
            {activeTab === 'pedigree' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                <div className="p-3.5 rounded-lg muurket-solid space-y-2">
                  <h4 className="font-heading font-bold text-blanco">Genealogía Registrada</h4>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-piedra">Padre:</span>
                      <p className="font-medium text-blanco">{bull.pedigree.padre}</p>
                    </div>
                    <div>
                      <span className="text-piedra">Madre:</span>
                      <p className="font-medium text-blanco">{bull.pedigree.madre}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-monte-dark/70 border border-verdeSuave/15 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-esmeralda font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Auditoría de Oráculo Oficial</span>
                  </div>
                  <p className="text-piedra text-[11px]">
                    Médico Veterinario Certificador: <strong className="text-blanco">{bull.oracleAudit.inspector}</strong>
                  </p>
                  <p className="text-piedra text-[11px]">
                    Fecha de Consenso Hedera: <strong className="text-blanco">{bull.oracleAudit.certificationDate}</strong>
                  </p>
                  <a
                    href={bull.oracleAudit.hashScanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-esmeralda hover:underline font-mono text-[11px] pt-1"
                  >
                    <span>Consultar registro en HashScan Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Fast Purchase & Investment Panel (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            <div className="muurket-panel p-6 border-verdeSuave/20 shadow-elevated">
              
              <div className="flex items-center justify-between pb-3 border-b border-verdeSuave/10">
                <div>
                  <h3 className="text-sm font-heading font-bold text-blanco">Panel de Compra de Tokens</h3>
                  <p className="text-[10px] text-piedra">Inversión Directa en Fracciones HTS</p>
                </div>
                <div className="px-2 py-0.5 rounded bg-monte text-esmeralda font-mono text-xs font-semibold border border-verdeSuave/15">
                  ~{bull.estimatedAPY}% APY Est.
                </div>
              </div>

              {/* Price Details */}
              <div className="my-4 p-3.5 rounded-lg muurket-solid flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-piedra block">
                    Precio por Fracción
                  </span>
                  <span className="text-xl font-heading font-bold text-blanco font-mono">
                    ${bull.pricePerTokenUSDC.toFixed(2)} <span className="text-xs text-piedra font-sans font-normal">USDC</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-piedra block">Disponibles</span>
                  <span className="font-mono text-blanco text-xs font-medium">
                    {remainingTokens} / {bull.totalTokens}
                  </span>
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-crema font-medium">
                    Cantidad a Comprar
                  </label>
                  <span className="font-mono font-medium text-blanco">
                    {tokenAmount} Fracciones ({shareOfBullPct}% del Toro)
                  </span>
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 5, 10, 50, 100].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleQuickAdd(num)}
                      className="py-1 rounded bg-monte hover:bg-monte-light text-xs font-mono font-medium text-crema border border-verdeSuave/15 transition-colors"
                    >
                      +{num}
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <div className="pt-1">
                  <input
                    type="range"
                    min="1"
                    max={Math.min(300, remainingTokens)}
                    value={tokenAmount}
                    onChange={(e) => setTokenAmount(parseInt(e.target.value) || 1)}
                    className="w-full accent-esmeralda cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-piedra font-mono">
                    <span>1 token</span>
                    <span>150 tokens</span>
                    <span>300 tokens</span>
                  </div>
                </div>
              </div>

              {/* Clear Financial Breakdown */}
              <div className="mt-4 p-3.5 rounded-lg muurket-solid space-y-2 text-xs">
                
                <div className="flex justify-between text-piedra">
                  <span>Subtotal Fracciones:</span>
                  <span className="font-mono text-blanco font-medium">${totalCostUSDC.toLocaleString()} USDC</span>
                </div>

                <div className="flex justify-between text-piedra">
                  <span>Costo de Red Hedera:</span>
                  <span className="font-mono text-crema">&lt;$0.001 USD</span>
                </div>

                <div className="flex justify-between text-piedra">
                  <span>Comisión de Plataforma:</span>
                  <span className="font-mono text-crema">0.00 USDC (Ronda Primaria)</span>
                </div>

                <div className="pt-2 border-t border-verdeSuave/10 flex justify-between items-center">
                  <span className="font-heading font-bold text-blanco text-sm">Total a Pagar:</span>
                  <span className="text-lg font-heading font-bold text-blanco font-mono">
                    ${totalCostUSDC.toLocaleString()} USDC
                  </span>
                </div>

              </div>

              {/* Yield Projection Disclaimer */}
              <div className="mt-3 p-2.5 rounded bg-monte-dark/60 border border-verdeSuave/10 text-[11px] text-piedra space-y-1">
                <div className="flex justify-between text-crema">
                  <span>Proyección Anual Estimada:</span>
                  <span className="font-mono font-medium text-esmeralda">+${estimatedAnnualYieldUSDC.toLocaleString()} USDC/año</span>
                </div>
                <p className="text-[10px] text-piedra leading-tight">
                  * Estimación basada en volumen histórico de colocación de pajuelas y tasa de remate. Los rendimientos no están garantizados y dependen de las ventas físicas efectivas.
                </p>
              </div>

              {/* Balance */}
              <div className="mt-3 text-[11px] text-piedra flex justify-between">
                <span>Saldo disponible en HashPack:</span>
                <span className="font-mono text-blanco font-medium">
                  ${investorBalance.toLocaleString()} USDC
                </span>
              </div>

              {/* Main Action Button */}
              <div className="mt-4">
                <button
                  onClick={handleInvest}
                  disabled={isInvesting || tokenAmount <= 0}
                  className="w-full py-3 px-4 rounded-lg btn-action-primary text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm"
                >
                  {isInvesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-profundo-dark" />
                      <span>Firmando en HashPack...</span>
                    </>
                  ) : (
                    <span>Invertir con HashPack Wallet</span>
                  )}
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Confirmation Modal */}
      {investSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-profundo-dark/90 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md muurket-panel p-6 border-verdeSuave/25 shadow-elevated text-center space-y-4">
            
            <div className="w-12 h-12 mx-auto rounded-full bg-monte text-esmeralda flex items-center justify-center text-xl">
              ✓
            </div>

            <div>
              <span className="px-2.5 py-0.5 rounded bg-monte text-esmeralda font-mono text-xs border border-verdeSuave/15">
                Transacción Confirmada
              </span>
              <h3 className="text-lg font-heading font-extrabold text-blanco mt-2">
                Inversión realizada en {investSuccess.bullName}
              </h3>
              <p className="text-xs text-piedra mt-0.5">
                Se han transferido {investSuccess.tokensPurchased} tokens ({investSuccess.bullName}) a tu billetera.
              </p>
            </div>

            <div className="p-3.5 rounded-lg muurket-solid text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-piedra">Monto Invertido:</span>
                <span className="font-mono font-bold text-blanco">${investSuccess.totalCost.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-piedra">Transacción Hedera:</span>
                <span className="font-mono text-crema text-[11px] truncate max-w-[200px]">
                  {investSuccess.txHash}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <a
                href={investSuccess.hashScanUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 px-3 rounded-lg bg-monte hover:bg-monte-light border border-verdeSuave/15 text-piedra hover:text-blanco text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <span>Ver en HashScan</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => {
                  setInvestSuccess(null);
                  onClose();
                }}
                className="flex-1 py-2 px-3 rounded-lg btn-action-primary text-xs font-heading font-bold"
              >
                Ver Mi Portfolio
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
