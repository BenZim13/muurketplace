import React from 'react';
import { 
  DollarSign, 
  Layers, 
  TrendingUp, 
  Award, 
  Plus, 
  ExternalLink,
  ShieldCheck,
  BarChart3,
  ChevronRight
} from 'lucide-react';

export default function SellerDashboard({ 
  bulls, 
  sellerData, 
  setActiveView,
  onSelectBull 
}) {
  const totalFundingRaised = bulls.reduce((acc, b) => acc + (b.tokensSold * b.pricePerTokenUSDC), 0);
  const totalBullsCount = bulls.length;
  const totalStrawsSold = bulls.reduce((acc, b) => acc + b.strawsSoldYTD, 0);

  return (
    <div className="space-y-6">
      
      {/* Editorial Hero Banner */}
      <div className="relative rounded-xl overflow-hidden border border-verdeSuave/15 shadow-elevated">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('/assets/estancia_landscape.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-profundo-dark/95 via-profundo/90 to-profundo/70 backdrop-blur-[1px]" />
        
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-monte-dark text-piedra-light font-mono text-[10px] uppercase border border-verdeSuave/10">
                Panel de Cabaña Ganadera
              </span>
              <span className="text-xs text-piedra">· Hedera RWA Hub NEA</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-blanco tracking-tight">
              {sellerData.cabanaName}
            </h1>
            <p className="text-xs md:text-sm text-piedra leading-relaxed">
              Monitoreo del financiamiento de Toros Líderes, colocación de dosis seminales en el mercado físico y liquidación periódica de dividendos en USDC.
            </p>
            <div className="flex items-center gap-3 pt-1 text-xs text-piedra">
              <span className="flex items-center gap-1.5 text-crema">
                <ShieldCheck className="w-4 h-4 text-esmeralda" />
                <span>Socio Activo Braford #412</span>
              </span>
              <span className="text-verdeSuave/20">|</span>
              <span className="font-mono text-[11px] text-piedra">
                Oráculo PEGBraf Sincronizado
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => setActiveView('seller-pricing')}
              className="px-4 py-2.5 rounded-lg btn-action-primary text-xs font-heading font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tokenizar Nuevo Toro</span>
            </button>
            <button
              onClick={() => setActiveView('seller-wallet')}
              className="px-4 py-2.5 rounded-lg bg-monte hover:bg-monte-light border border-verdeSuave/15 text-blanco font-medium text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <span>Ver Wallet y Liquidaciones</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="muurket-card p-5">
          <div className="flex items-center justify-between text-piedra text-xs mb-1">
            <span>Financiamiento Levantado</span>
            <DollarSign className="w-4 h-4 text-esmeralda" />
          </div>
          <div className="text-2xl font-heading font-bold text-blanco">
            ${totalFundingRaised.toLocaleString()} <span className="text-xs text-piedra font-normal">USDC</span>
          </div>
          <div className="mt-2 text-xs text-esmeralda flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+24.8% en el último trimestre</span>
          </div>
        </div>

        <div className="muurket-card p-5">
          <div className="flex items-center justify-between text-piedra text-xs mb-1">
            <span>Toros en Ronda Activa</span>
            <Award className="w-4 h-4 text-crema" />
          </div>
          <div className="text-2xl font-heading font-bold text-blanco">
            {totalBullsCount} <span className="text-xs text-piedra font-normal">Reproductores</span>
          </div>
          <div className="mt-2 text-xs text-piedra">
            Validación oracular PEGBraf aprobada
          </div>
        </div>

        <div className="muurket-card p-5">
          <div className="flex items-center justify-between text-piedra text-xs mb-1">
            <span>Dosis Seminales Colocadas</span>
            <Layers className="w-4 h-4 text-cuero" />
          </div>
          <div className="text-2xl font-heading font-bold text-blanco">
            {totalStrawsSold.toLocaleString()} <span className="text-xs text-piedra font-normal">Pajuelas YTD</span>
          </div>
          <div className="mt-2 text-xs text-cuero font-medium">
            Generando dividendos en USDC
          </div>
        </div>

        <div className="muurket-card p-5">
          <div className="flex items-center justify-between text-piedra text-xs mb-1">
            <span>Rendimiento Anual Promedio</span>
            <span className="status-dot-active"></span>
          </div>
          <div className="text-2xl font-heading font-bold text-blanco font-mono">
            {sellerData.averageYieldPaid}% <span className="text-xs text-piedra font-sans font-normal">APY</span>
          </div>
          <div className="mt-2 text-xs text-piedra">
            Liquidación automática vía HTS
          </div>
        </div>

      </div>

      {/* Bulls in Financing Section */}
      <div className="muurket-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-verdeSuave/10">
          <div>
            <h2 className="text-base font-heading font-bold text-blanco">
              Toros Líderes de la Cabaña en Mercado
            </h2>
            <p className="text-xs text-piedra">
              Contratos inteligentes activos bajo el estándar Hedera Token Service (HTS).
            </p>
          </div>
          <button
            onClick={() => setActiveView('seller-pricing')}
            className="text-xs text-esmeralda hover:underline flex items-center gap-1 font-medium"
          >
            <span>Tasar nuevo reproductor</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {bulls.map((bull) => {
            const fundedPercent = Math.min(100, Math.round((bull.tokensSold / bull.totalTokens) * 100));
            const totalRaised = bull.tokensSold * bull.pricePerTokenUSDC;
            return (
              <div 
                key={bull.id}
                className="muurket-solid overflow-hidden flex flex-col justify-between muurket-card-hover group border border-verdeSuave/15"
              >
                <div>
                  <div className="relative h-44 overflow-hidden">
                    <img 
                      src={bull.image} 
                      alt={bull.name} 
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-profundo-dark via-profundo-dark/30 to-transparent" />
                    
                    <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-profundo/90 text-[10px] font-mono text-crema border border-verdeSuave/15">
                        {bull.breed}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-profundo/90 text-[10px] font-mono text-piedra border border-verdeSuave/10">
                        {bull.symbol}
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5">
                      <span className="px-2 py-0.5 rounded bg-monte text-esmeralda text-[10px] font-mono font-semibold border border-verdeSuave/15">
                        {bull.estimatedAPY}% APY Est.
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-3 right-3">
                      <p className="font-heading font-bold text-blanco text-sm truncate">
                        {bull.name}
                      </p>
                      <p className="text-[10px] text-piedra font-mono">
                        {bull.hbaRegister} · {bull.tagCode}
                      </p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3 text-xs">
                    
                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-piedra">Financiamiento:</span>
                        <span className="font-mono text-blanco font-semibold">{fundedPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-profundo-dark overflow-hidden">
                        <div 
                          className="h-full bg-esmeralda rounded-full transition-all duration-500"
                          style={{ width: `${fundedPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-piedra font-mono pt-0.5">
                        <span>${totalRaised.toLocaleString()} USDC</span>
                        <span>Meta: ${bull.valuationUSD.toLocaleString()} USD</span>
                      </div>
                    </div>

                    {/* Biometrics row */}
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-center pt-1 border-t border-verdeSuave/10">
                      <div className="p-1.5 rounded bg-monte-dark/60">
                        <span className="text-piedra block">DEP PN</span>
                        <span className="font-bold text-crema">{bull.biometrics.peso_nacer_kg} kg</span>
                      </div>
                      <div className="p-1.5 rounded bg-monte-dark/60">
                        <span className="text-piedra block">AOB</span>
                        <span className="font-bold text-crema">+{bull.biometrics.area_ojo_bife_cm2}</span>
                      </div>
                      <div className="p-1.5 rounded bg-monte-dark/60">
                        <span className="text-piedra block">Motilidad</span>
                        <span className="font-bold text-esmeralda">{bull.biometrics.motilidad_seminal_pct}%</span>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="p-4 pt-0 flex gap-2">
                  <a
                    href={bull.oracleAudit.hashScanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded bg-monte hover:bg-monte-light border border-verdeSuave/15 text-piedra hover:text-blanco transition-colors flex items-center justify-center"
                    title="Ver contrato en HashScan"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => onSelectBull(bull)}
                    className="flex-1 py-1.5 px-3 rounded bg-monte hover:bg-monte-light border border-verdeSuave/15 text-xs font-heading font-semibold text-blanco transition-colors text-center"
                  >
                    Ver Ficha Completa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analytics & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Performance Chart */}
        <div className="lg:col-span-8 muurket-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-verdeSuave/10">
            <div>
              <h3 className="text-sm font-heading font-bold text-blanco flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-crema" />
                <span>Colocación Física de Dosis Seminales y Liquidación</span>
              </h3>
              <p className="text-xs text-piedra">
                Pajuelas comercializadas en remates y liquidaciones trimestrales a inversores en USDC.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-monte-dark text-piedra border border-verdeSuave/10">
              Últimos 6 meses
            </span>
          </div>

          <div className="h-52 flex items-end justify-between gap-3 pt-6 px-2">
            {sellerData.monthlyPerformance.map((item, idx) => {
              const maxVal = 32000;
              const heightPct = Math.round((item.usdc / maxVal) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[10px] font-mono text-crema opacity-0 group-hover:opacity-100 transition-opacity">
                    ${item.usdc.toLocaleString()}
                  </div>
                  <div 
                    className="w-full rounded-t bg-monte hover:bg-monte-light transition-colors border-t border-verdeSuave/20"
                    style={{ height: `${heightPct}%` }}
                  />
                  <div className="text-[11px] font-mono text-piedra text-center">
                    <p className="font-semibold">{item.month.split(' ')[0]}</p>
                    <p className="text-[9px] text-piedra-dark">{item.pajuelas} d.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions Feed */}
        <div className="lg:col-span-4 muurket-card p-6 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-verdeSuave/10">
            <h3 className="text-sm font-heading font-bold text-blanco">
              Actividad Reciente
            </h3>
            <span className="status-dot-active"></span>
          </div>

          <div className="space-y-2.5">
            {sellerData.recentSales.map((sale) => (
              <div 
                key={sale.id}
                className="p-2.5 rounded-lg bg-monte-dark/60 border border-verdeSuave/10 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-crema truncate pr-2">
                    {sale.bull}
                  </span>
                  <span className="font-mono font-bold text-blanco">
                    +${sale.amountUSDC.toFixed(2)} USDC
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-piedra">
                  <span>{sale.tokens} Fracciones · {sale.buyer.split(' ')[0]}</span>
                  <span className="text-[10px] text-piedra-dark">{sale.time}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-center">
            <button 
              onClick={() => setActiveView('seller-wallet')}
              className="text-xs text-esmeralda hover:underline font-medium transition-colors"
            >
              Consultar libro de liquidaciones →
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
