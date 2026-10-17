import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  ExternalLink, 
  CheckCircle2, 
  RefreshCw,
  Info,
  Landmark
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function BullDetailModal({ 
  bull, 
  onClose, 
  onInvestSuccess,
  investorBalance = 0,
  userRole = 'buyer',
  setActiveView
}) {
  const [assetType, setAssetType] = useState('pajuela'); // 'pajuela' (PAJ-BRAF) | 'bull_equity' (BULL)
  const [tokenAmount, setTokenAmount] = useState(10);
  const [equityAmount, setEquityAmount] = useState(1); // 1 cuota parte = 10% del reproductor vivo
  const [activeTab, setActiveTab] = useState('biometrics');
  const [isInvesting, setIsInvesting] = useState(false);
  const [investSuccess, setInvestSuccess] = useState(null);

  if (!bull) return null;

  // Cálculos para Pajuela (PAJ-BRAF)
  const remainingTokens = bull.totalTokens - bull.tokensSold;
  const pajuelaCostUSDC = Number((tokenAmount * bull.pricePerTokenUSDC).toFixed(2));
  const pajuelaAnnualYieldUSDC = Number(((pajuelaCostUSDC * bull.estimatedAPY) / 100).toFixed(2));
  const shareOfBullPct = ((tokenAmount / bull.totalTokens) * 100).toFixed(2);

  // Cálculos para Copropiedad del Animal Vivo (BULL)
  // Cada toro se divide en 10 cuotas partes patrimoniales (1 cuota = 10% del valor total)
  const pricePerEquityShareUSDC = Number((bull.valuationUSD * 0.1).toFixed(2));
  const equityCostUSDC = Number((equityAmount * pricePerEquityShareUSDC).toFixed(2));
  const equityPercentOwned = Number((equityAmount * 10).toFixed(2));
  const equityAnnualYieldUSDC = Number(((equityCostUSDC * (bull.estimatedAPY + 3.5)) / 100).toFixed(2));

  // Totales según tipo de activo seleccionado
  const isPajuela = assetType === 'pajuela';
  const totalCostUSDC = isPajuela ? pajuelaCostUSDC : equityCostUSDC;
  const estimatedAnnualYieldUSDC = isPajuela ? pajuelaAnnualYieldUSDC : equityAnnualYieldUSDC;

  const handleQuickAdd = (amount) => {
    setTokenAmount(prev => Math.min(remainingTokens, Math.max(1, prev + amount)));
  };

  const handleQuickAddEquity = (amount) => {
    setEquityAmount(prev => Number(Math.min(4, Math.max(0.1, Number((prev + amount).toFixed(1))))));
  };

  const handleInvest = () => {
    setIsInvesting(true);

    setTimeout(() => {
      const txHash = `0.0.651928@${Math.floor(Date.now() / 1000)}.000000001`;
      setIsInvesting(false);
      const activeTokenId = isPajuela ? bull.htsTokenId : '0.0.11054880';
      const activeSymbol = isPajuela ? (bull.symbol || 'PAJ-BRAF') : 'BULL';
      const assetLabel = isPajuela 
        ? `${tokenAmount} Pajuelas Seminales (${activeSymbol})`
        : `${equityAmount} Cuota Parte (${equityPercentOwned}% Copropiedad del Toro en Pie)`;

      setInvestSuccess({
        bullName: bull.name,
        tokensPurchased: isPajuela ? tokenAmount : equityAmount,
        assetLabel,
        isPajuela,
        totalCost: totalCostUSDC,
        txHash,
        tokenUrl: `https://hashscan.io/testnet/token/${activeTokenId}`,
        txUrl: `https://hashscan.io/testnet/transaction/${txHash}`,
        tokenId: activeTokenId,
        symbol: activeSymbol
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
          assetType,
          tokens: isPajuela ? tokenAmount : equityAmount,
          costUSDC: totalCostUSDC,
          bull
        });
      }
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-tinta/50 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-5xl bg-white rounded-2xl border border-crema-border shadow-elevated overflow-hidden my-auto relative max-h-[92vh] flex flex-col">
        
        {/* Modal Topbar */}
        <div className="px-5 py-3.5 bg-crema-surface border-b border-crema-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="status-dot-active"></span>
            <span className="font-mono text-xs uppercase text-tinta-muted font-medium">
              Ficha Técnica de Reproductor Bovino RWA
            </span>
            <span className="text-crema-border">|</span>
            <span className="text-xs text-cuero font-mono font-bold">
              Token HTS: {bull.htsTokenId}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-crema-border text-tinta-muted hover:text-tinta transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-5 md:p-7 grid grid-cols-1 lg:grid-cols-12 gap-7 bg-white">
          
          {/* Left Column: Biological Details (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Bull Header Photo Banner */}
            <div className="relative rounded-xl overflow-hidden h-60 border border-crema-border shadow-sm">
              <img
                src={bull.image}
                alt={bull.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-tinta/90 via-tinta/30 to-transparent" />
              
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-white/95 text-xs font-mono text-tinta font-bold shadow-sm">
                  {bull.breed}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white/80 text-xs font-mono text-tinta-muted font-medium backdrop-blur-sm">
                  {bull.symbol}
                </span>
              </div>

              <div className="absolute bottom-3 left-4 right-4">
                <span className="text-xs text-white/80 font-medium">{bull.cabana}</span>
                <h2 className="text-xl md:text-2xl font-heading font-extrabold text-white">
                  {bull.name}
                </h2>
                <p className="text-xs text-white/80 font-mono mt-0.5">
                  {bull.hbaRegister} · Caravana: {bull.tagCode} · {bull.location}
                </p>
              </div>
            </div>

            {/* Technical Tabs Selector */}
            <div className="flex border-b border-crema-border gap-5 text-xs font-heading font-semibold">
              <button
                onClick={() => setActiveTab('biometrics')}
                className={`pb-2.5 transition-colors ${
                  activeTab === 'biometrics'
                    ? 'text-monte border-b-2 border-monte font-bold'
                    : 'text-tinta-muted hover:text-tinta'
                }`}
              >
                DEPs & Biometría
              </button>

              <button
                onClick={() => setActiveTab('carcass')}
                className={`pb-2.5 transition-colors ${
                  activeTab === 'carcass'
                    ? 'text-monte border-b-2 border-monte font-bold'
                    : 'text-tinta-muted hover:text-tinta'
                }`}
              >
                Ecografía Carcasa
              </button>

              <button
                onClick={() => setActiveTab('semen')}
                className={`pb-2.5 transition-colors ${
                  activeTab === 'semen'
                    ? 'text-monte border-b-2 border-monte font-bold'
                    : 'text-tinta-muted hover:text-tinta'
                }`}
              >
                Laboratorio Seminal
              </button>

              <button
                onClick={() => setActiveTab('pedigree')}
                className={`pb-2.5 transition-colors ${
                  activeTab === 'pedigree'
                    ? 'text-monte border-b-2 border-monte font-bold'
                    : 'text-tinta-muted hover:text-tinta'
                }`}
              >
                Pedigree & Oráculo
              </button>
            </div>

            {/* Tab 1: DEPs & Biometrics */}
            {activeTab === 'biometrics' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                <div className="flex items-center justify-between text-tinta-muted pb-1">
                  <span>Diferencias Esperadas en la Progenie (Sumario Oficial)</span>
                  <span className="text-[10px] text-salvia font-mono font-bold bg-salvia-light px-2 py-0.5 rounded border border-salvia-border">Verificado Asociación</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-crema-surface border border-crema-border space-y-1">
                    <span className="text-tinta-muted text-[11px] block">DEP Peso al Nacer</span>
                    <span className="font-mono font-bold text-base text-tinta">
                      {bull.biometrics.peso_nacer_kg} kg
                    </span>
                    <span className="text-[10px] text-cuero font-medium block">
                      {bull.biometrics.peso_nacer_percentile} (Facilidad de parto)
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-crema-surface border border-crema-border space-y-1">
                    <span className="text-tinta-muted text-[11px] block">DEP Peso al Destete</span>
                    <span className="font-mono font-bold text-base text-tinta">
                      +{bull.biometrics.peso_destete_kg} kg
                    </span>
                    <span className="text-[10px] text-tinta-muted block">
                      Medición: {bull.biometrics.edad_destete_dias} días
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-crema-surface border border-crema-border space-y-1">
                    <span className="text-tinta-muted text-[11px] block">DEP Peso Final 18m</span>
                    <span className="font-mono font-bold text-base text-tinta">
                      +{bull.biometrics.peso_final_kg} kg
                    </span>
                    <span className="text-[10px] text-tinta-muted block">
                      Medición: {bull.biometrics.edad_peso_final_dias} días
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-crema-surface border border-crema-border space-y-1">
                    <span className="text-tinta-muted text-[11px] block">Circunferencia Escrotal</span>
                    <span className="font-mono font-bold text-base text-tinta">
                      +{bull.biometrics.circunferencia_escrotal_cm} cm
                    </span>
                    <span className="text-[10px] text-salvia font-medium block">
                      Fertilidad comprobada
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-crema-surface border border-crema-border space-y-1">
                    <span className="text-tinta-muted text-[11px] block">Conformación Carnicera</span>
                    <span className="font-mono font-bold text-base text-tinta">Sobresaliente</span>
                    <span className="text-[10px] text-tinta-muted block">Evaluación fenotípica</span>
                  </div>

                  <div className="p-3 rounded-lg bg-salvia-light border border-salvia-border space-y-1">
                    <span className="text-salvia text-[11px] block font-medium">Adaptación Subtropical</span>
                    <span className="font-mono font-bold text-base text-salvia">100% Inmune</span>
                    <span className="text-[10px] text-salvia/80 block">Garrapata y calor NEA</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Carcass Ultrasound */}
            {activeTab === 'carcass' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-crema-surface border border-crema-border space-y-1">
                    <span className="text-tinta-muted text-[11px] block">Área de Ojo de Bife (AOB)</span>
                    <span className="font-mono font-bold text-2xl text-tinta">
                      +{bull.biometrics.area_ojo_bife_cm2} cm²
                    </span>
                    <p className="text-xs text-monte font-semibold">
                      {bull.biometrics.area_ojo_bife_percentile}
                    </p>
                    <p className="text-[11px] text-tinta-muted pt-1">
                      Medición ecográfica oficial a los 18 meses. Alto rendimiento de cortes valiosos en gancho.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-cuero-light border border-cuero-border space-y-1">
                    <span className="text-cuero text-[11px] block font-medium">Grasa Intramuscular (GI)</span>
                    <span className="font-mono font-bold text-2xl text-cuero-dark">
                      Top 5%
                    </span>
                    <p className="text-xs text-cuero-dark font-bold">
                      Marmóreo Hilton Certificado
                    </p>
                    <p className="text-[11px] text-cuero/80 pt-1">
                      Infiltración grasa que transmite terneza comprobada a la descendencia en faena.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Semen Laboratory */}
            {activeTab === 'semen' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                <div className="p-3 rounded-lg bg-crema-surface border border-crema-border flex items-center justify-between">
                  <div>
                    <span className="text-tinta-muted text-[11px] block">Centro de Inseminación Habilitado</span>
                    <span className="font-bold text-tinta text-xs">Laboratorio de Biotecnología Seminal Litoral</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-white text-cuero font-mono text-[10px] font-bold border border-crema-border shadow-sm">
                    SENASA #BA-912
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-salvia-light border border-salvia-border text-center">
                    <span className="text-salvia text-[11px] block font-medium">Motilidad Progresiva</span>
                    <span className="font-mono font-bold text-lg text-salvia">{bull.biometrics.motilidad_seminal_pct}%</span>
                    <span className="text-[10px] text-salvia/80 block mt-0.5">Norma SENASA: &gt;70%</span>
                  </div>
                  <div className="p-3 rounded-lg bg-crema-surface border border-crema-border text-center">
                    <span className="text-tinta-muted text-[11px] block">Volumen por Salto</span>
                    <span className="font-mono font-bold text-lg text-tinta">{bull.biometrics.volumen_eyaculado_ml} ml</span>
                    <span className="text-[10px] text-tinta-muted block mt-0.5">Dosis: 0.5 ml</span>
                  </div>
                  <div className="p-3 rounded-lg bg-crema-surface border border-crema-border text-center">
                    <span className="text-tinta-muted text-[11px] block">Concentración</span>
                    <span className="font-mono font-bold text-lg text-cuero">{bull.biometrics.concentracion_millones_ml} M/ml</span>
                    <span className="text-[10px] text-tinta-muted block mt-0.5">Viabilidad probada</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Pedigree & Oracle */}
            {activeTab === 'pedigree' && (
              <div className="space-y-3.5 animate-in fade-in text-xs">
                <div className="p-3.5 rounded-lg bg-crema-surface border border-crema-border space-y-2">
                  <h4 className="font-heading font-bold text-tinta">Genealogía Registrada</h4>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-tinta-muted">Padre:</span>
                      <p className="font-bold text-tinta">{bull.pedigree.padre}</p>
                    </div>
                    <div>
                      <span className="text-tinta-muted">Madre:</span>
                      <p className="font-bold text-tinta">{bull.pedigree.madre}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-salvia-light border border-salvia-border space-y-1.5">
                  <div className="flex items-center gap-1.5 text-salvia font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Auditoría de Oráculo Oficial</span>
                  </div>
                  <p className="text-tinta-light text-[11px]">
                    Médico Veterinario Certificador: <strong className="text-tinta">{bull.oracleAudit.inspector}</strong>
                  </p>
                  <p className="text-tinta-light text-[11px]">
                    Fecha de Consenso Hedera: <strong className="text-tinta">{bull.oracleAudit.certificationDate}</strong>
                  </p>
                  <a
                    href={bull.oracleAudit.hashScanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-cuero hover:text-cuero-dark font-bold font-mono text-[11px] pt-1"
                  >
                    <span>Consultar registro en HashScan Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Dynamic according to userRole */}
          <div className="lg:col-span-5 space-y-4">
            
            {userRole === 'seller' ? (
              /* SELLER / CABAÑA VIEW: Management & Round Supervision */
              <div className="bg-white rounded-xl border border-crema-border p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-crema-border">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-tinta-muted block">
                      Panel de Cabaña Titular
                    </span>
                    <h3 className="text-sm font-heading font-bold text-tinta">
                      Supervisión de Ronda & Activo
                    </h3>
                  </div>
                  <div className="px-2.5 py-0.5 rounded-md bg-salvia-light text-salvia font-mono text-xs font-bold border border-salvia-border">
                    Emisión HTS Activa
                  </div>
                </div>

                {/* Round Progress Card */}
                <div className="p-4 rounded-xl bg-crema-surface border border-crema-border space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-tinta-muted font-medium">Recaudación de Ronda:</span>
                    <span className="font-mono font-bold text-monte text-sm">
                      ${(bull.tokensSold * bull.pricePerTokenUSDC).toLocaleString()} USDC
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-tinta-muted font-medium">
                      <span>Avance de colocación</span>
                      <span className="font-mono font-bold text-tinta">
                        {Math.min(100, Math.round((bull.tokensSold / bull.totalTokens) * 100))}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white border border-crema-border/70 overflow-hidden">
                      <div 
                        className="h-full bg-monte rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round((bull.tokensSold / bull.totalTokens) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-tinta-muted font-mono pt-0.5">
                      <span>Meta: ${bull.valuationUSD.toLocaleString()} USD</span>
                      <span className="text-esmeralda font-semibold">
                        {bull.tokensSold.toLocaleString()} de {bull.totalTokens.toLocaleString()} fracciones
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stock & Criocentro Details */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-crema-border text-tinta-muted">
                    <span>Fracciones en Criocentro:</span>
                    <span className="font-mono font-bold text-tinta">
                      {remainingTokens.toLocaleString()} dosis
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-crema-border text-tinta-muted">
                    <span>Precio Oficial por Dosis:</span>
                    <span className="font-mono font-bold text-tinta">
                      ${bull.pricePerTokenUSDC.toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-crema-border text-tinta-muted">
                    <span>Rendimiento Proyectado Anual:</span>
                    <span className="font-mono font-bold text-salvia">
                      ~{bull.estimatedAPY}% APY
                    </span>
                  </div>
                  <div className="flex justify-between py-2 text-tinta-muted">
                    <span>Identificador HTS:</span>
                    <span className="font-mono font-bold text-monte text-[11px]">
                      {bull.htsTokenId}
                    </span>
                  </div>
                </div>

                {/* Role Notice */}
                <div className="p-3 rounded-lg bg-arena-light border border-arena-border text-[11px] text-tinta-light flex items-start gap-2">
                  <Info className="w-4 h-4 text-cuero flex-shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    <strong>Modo Cabaña:</strong> Como propietario del reproductor, supervisas aquí la suscripción del lote. El panel de compra está inhabilitado para tu cuenta de vendedor.
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  {setActiveView && (
                    <button
                      onClick={() => {
                        onClose();
                        setActiveView('seller-wallet');
                      }}
                      className="w-full py-2.5 px-4 rounded-lg btn-action-leather text-xs font-heading font-bold flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Landmark className="w-4 h-4" />
                      <span>Ver Tesorería y Fondos Recaudados</span>
                    </button>
                  )}

                  <a
                    href={bull.oracleAudit.hashScanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 px-4 rounded-lg bg-crema-surface hover:bg-crema-border border border-crema-border text-xs font-heading font-semibold text-tinta flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Auditoría en HashScan Explorer</span>
                    <ExternalLink className="w-3.5 h-3.5 text-tinta-muted" />
                  </a>
                </div>
              </div>
            ) : (
              /* INVESTOR / CLIENT VIEW: Token Purchase & Investment */
              <div className="bg-white rounded-xl border border-crema-border p-5 shadow-sm space-y-3.5">
                
                <div className="flex items-center justify-between pb-2.5 border-b border-crema-border">
                  <div>
                    <h3 className="text-sm font-heading font-bold text-tinta">Panel de Inversión RWA</h3>
                    <p className="text-[10px] text-tinta-muted">Selecciona la modalidad de activo ganadero</p>
                  </div>
                  <div className="px-2 py-0.5 rounded-md bg-salvia-light text-salvia font-mono text-[11px] font-bold border border-salvia-border">
                    ~{isPajuela ? bull.estimatedAPY : (bull.estimatedAPY + 3.5).toFixed(1)}% APY Est.
                  </div>
                </div>

                {/* DUAL ASSET SELECTOR: Pajuela vs Propio Animal */}
                <div className="grid grid-cols-2 p-1 bg-crema-surface rounded-lg border border-crema-border">
                  <button
                    type="button"
                    onClick={() => setAssetType('pajuela')}
                    className={`py-2 px-2.5 rounded-md text-xs font-heading font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isPajuela
                        ? 'bg-monte text-white shadow-sm'
                        : 'text-tinta-muted hover:text-tinta'
                    }`}
                  >
                    <span>🧪 Pajuela Seminal</span>
                    <span className="text-[9px] font-mono px-1 py-0.2 bg-white/20 rounded">PAJ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetType('bull_equity')}
                    className={`py-2 px-2.5 rounded-md text-xs font-heading font-bold transition-all flex items-center justify-center gap-1.5 ${
                      !isPajuela
                        ? 'bg-cuero text-white shadow-sm'
                        : 'text-tinta-muted hover:text-tinta'
                    }`}
                  >
                    <span>🐂 Propio Animal</span>
                    <span className="text-[9px] font-mono px-1 py-0.2 bg-white/20 rounded">BULL</span>
                  </button>
                </div>

                {/* Asset Description Badge */}
                <div className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${
                  isPajuela 
                    ? 'bg-salvia-light/60 border-salvia-border text-salvia-dark'
                    : 'bg-arena-light border-arena-border text-tinta-light'
                }`}>
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-cuero" />
                  <p className="leading-snug">
                    {isPajuela ? (
                      <>
                        <strong>Activo de Producción Seminal (PAJ-BRAF):</strong> 1 token = 1 pajuela física (0.5 ml) criopreservada en criocentro SENASA. Otorga derecho a retiro físico para inseminar o cobro de dividendos comerciales.
                      </>
                    ) : (
                      <>
                        <strong>Activo sobre el Animal Vivo (BULL):</strong> Copropiedad patrimonial sobre el reproductor en pie. Otorga derecho a plusvalía de mercado, premios en Palermo y regalías vitalicias de semen.
                      </>
                    )}
                  </p>
                </div>

                {/* Price Details */}
                <div className="p-3 rounded-lg bg-crema-surface border border-crema-border flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-tinta-muted font-medium block">
                      {isPajuela ? 'Precio por Pajuela' : 'Precio Cuota 10% del Toro'}
                    </span>
                    <span className="text-xl font-heading font-extrabold text-tinta font-mono">
                      ${isPajuela ? bull.pricePerTokenUSDC.toFixed(2) : pricePerEquityShareUSDC.toLocaleString()} <span className="text-xs text-tinta-muted font-sans font-normal">USDC</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-tinta-muted font-medium block">Disponibilidad</span>
                    <span className="font-mono text-tinta text-xs font-bold">
                      {isPajuela ? `${remainingTokens} / ${bull.totalTokens} dosis` : '4 de 10 cuotas partes'}
                    </span>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="text-tinta font-semibold">
                      {isPajuela ? 'Cantidad de Pajuelas' : 'Cuotas Partes de Copropiedad'}
                    </label>
                    <span className="font-mono font-bold text-monte">
                      {isPajuela 
                        ? `${tokenAmount} Dosis (${shareOfBullPct}% ronda)` 
                        : `${equityAmount} Cuota (${equityPercentOwned}% del Animal)`}
                    </span>
                  </div>

                  {/* Preset Chips */}
                  {isPajuela ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 5, 10, 50, 100].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleQuickAdd(num)}
                          className="py-1 rounded-md bg-crema-surface hover:bg-salvia-light text-xs font-mono font-bold text-tinta border border-crema-border transition-colors"
                        >
                          +{num}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0.1, 0.5, 1, 2].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setEquityAmount(num)}
                          className={`py-1 rounded-md text-xs font-mono font-bold border transition-colors ${
                            equityAmount === num 
                              ? 'bg-cuero text-white border-cuero' 
                              : 'bg-crema-surface text-tinta hover:bg-arena-light border-crema-border'
                          }`}
                        >
                          {num} cuota ({num * 10}%)
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Slider */}
                  <div className="pt-0.5">
                    {isPajuela ? (
                      <>
                        <input
                          type="range"
                          min="1"
                          max={Math.min(300, remainingTokens)}
                          value={tokenAmount}
                          onChange={(e) => setTokenAmount(parseInt(e.target.value) || 1)}
                          className="w-full accent-monte cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-tinta-muted font-mono font-medium">
                          <span>1 dosis</span>
                          <span>150 dosis</span>
                          <span>300 dosis</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <input
                          type="range"
                          min="0.1"
                          max="4"
                          step="0.1"
                          value={equityAmount}
                          onChange={(e) => setEquityAmount(parseFloat(e.target.value) || 0.1)}
                          className="w-full accent-cuero cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-tinta-muted font-mono font-medium">
                          <span>0.1 (1% toro)</span>
                          <span>2.0 (20% toro)</span>
                          <span>4.0 (40% toro)</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Clear Financial Breakdown */}
                <div className="p-3 rounded-lg bg-crema-surface border border-crema-border space-y-1.5 text-xs">
                  <div className="flex justify-between text-tinta-muted">
                    <span>{isPajuela ? 'Subtotal Dosis Seminales:' : 'Subtotal Participación Animal:'}</span>
                    <span className="font-mono text-tinta font-semibold">${totalCostUSDC.toLocaleString()} USDC</span>
                  </div>

                  <div className="flex justify-between text-tinta-muted">
                    <span>Costo Red Hedera HTS:</span>
                    <span className="font-mono text-tinta font-medium">&lt;$0.001 USD</span>
                  </div>

                  <div className="flex justify-between text-tinta-muted">
                    <span>Comisión de Plataforma:</span>
                    <span className="font-mono text-salvia font-bold">0.00 USDC (Ronda Primaria)</span>
                  </div>

                  <div className="pt-2 border-t border-crema-border flex justify-between items-center">
                    <span className="font-heading font-extrabold text-tinta text-sm">Total a Pagar:</span>
                    <span className="text-base font-heading font-extrabold text-monte font-mono">
                      ${totalCostUSDC.toLocaleString()} USDC
                    </span>
                  </div>
                </div>

                {/* Yield Projection Disclaimer */}
                <div className="p-2.5 rounded-lg bg-arena-light border border-arena-border text-[11px] text-tinta-light space-y-0.5">
                  <div className="flex justify-between text-tinta font-semibold">
                    <span>Proyección Anual Estimada:</span>
                    <span className="font-mono font-bold text-salvia">+${estimatedAnnualYieldUSDC.toLocaleString()} USDC/año</span>
                  </div>
                  <p className="text-[10px] text-tinta-muted leading-tight">
                    {isPajuela 
                      ? '* Rendimiento estimado por colocación física de pajuelas en remates ganaderos.'
                      : '* Rendimiento estimado por plusvalía zootécnica de mercado + regalías vitalicias de semen.'}
                  </p>
                </div>

                {/* Balance */}
                <div className="text-[11px] text-tinta-muted flex justify-between pt-0.5">
                  <span>Saldo en HashPack:</span>
                  <span className="font-mono text-tinta font-bold">
                    ${investorBalance.toLocaleString()} USDC
                  </span>
                </div>

                {/* Main Action Button */}
                <div className="pt-1">
                  <button
                    onClick={handleInvest}
                    disabled={isInvesting || (isPajuela ? tokenAmount <= 0 : equityAmount <= 0)}
                    className="w-full py-3 px-4 rounded-lg btn-action-primary text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm font-bold"
                  >
                    {isInvesting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Firmando en HashPack...</span>
                      </>
                    ) : (
                      <span>
                        {isPajuela ? 'Adquirir Pajuelas con HashPack' : 'Adquirir Participación en el Toro'}
                      </span>
                    )}
                  </button>
                </div>

              </div>
            )}

          </div>

        </div>

      </div>

      {/* Confirmation Modal */}
      {investSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-tinta/60 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-crema-border shadow-elevated text-center space-y-4">
            
            <div className="w-12 h-12 mx-auto rounded-full bg-salvia-light text-salvia flex items-center justify-center text-xl font-bold">
              ✓
            </div>

            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-salvia-light text-salvia font-mono text-xs font-bold border border-salvia-border">
                Transacción Confirmada
              </span>
              <h3 className="text-lg font-heading font-extrabold text-tinta mt-2">
                Inversión confirmada en {investSuccess.bullName}
              </h3>
              <p className="text-xs text-tinta-muted mt-0.5">
                Se han acreditado exitosamente <strong>{investSuccess.assetLabel}</strong> en tu billetera HashPack.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-crema-surface border border-crema-border text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-tinta-muted">Monto Invertido:</span>
                <span className="font-mono font-bold text-tinta">${investSuccess.totalCost.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-muted">Token HTS Adquirido:</span>
                <a 
                  href={investSuccess.tokenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-monte font-bold hover:underline flex items-center gap-1"
                >
                  <span>{investSuccess.tokenId}</span>
                  <ExternalLink className="w-3 h-3 text-esmeralda" />
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-tinta-muted">Transacción Hedera:</span>
                <a
                  href={investSuccess.txUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-cuero text-[11px] font-semibold truncate max-w-[200px] hover:underline flex items-center gap-1"
                >
                  <span>{investSuccess.txHash}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <a
                href={investSuccess.tokenUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 px-3 rounded-lg bg-crema-surface hover:bg-crema-border border border-crema-border text-tinta text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Auditar en HashScan</span>
                <ExternalLink className="w-3.5 h-3.5 text-esmeralda" />
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
