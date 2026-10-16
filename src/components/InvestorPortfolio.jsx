import React, { useState } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCw,
  Coins
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function InvestorPortfolio({ 
  investorData, 
  onClaimYield, 
  onSelectBull,
  allBulls 
}) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimableAmount, setClaimableAmount] = useState(investorData.claimableYieldUSDC);
  
  const [transactions, setTransactions] = useState(investorData.transactions);

  const handleClaim = () => {
    if (claimableAmount <= 0) return;
    setIsClaiming(true);

    setTimeout(() => {
      const claimed = claimableAmount;
      setIsClaiming(false);
      setClaimSuccess(true);
      setClaimableAmount(0);

      const newTx = {
        id: `tx-claim-${Date.now()}`,
        type: 'claim',
        title: 'Reclamo de Dividendos Trimestrales (USDC)',
        amount: `+${claimed.toFixed(2)} USDC`,
        date: 'Justo ahora',
        txHash: `0.0.651928@${Math.floor(Date.now() / 1000)}`,
        status: 'Acreditado en Cartera'
      };
      setTransactions(prev => [newTx, ...prev]);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      if (onClaimYield) {
        onClaimYield(claimed);
      }
    }, 1800);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-crema-border">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-salvia px-2.5 py-0.5 rounded-full bg-salvia-light border border-salvia-border font-bold">
            Portafolio de Inversión RWA
          </span>
          <h1 className="text-2xl font-heading font-extrabold text-tinta mt-1">
            Mi Portafolio Ganadero y Rendimientos
          </h1>
          <p className="text-xs text-tinta-muted">
            Seguimiento de participaciones en reproductores y cobro de dividendos por comercialización de pajuelas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right bg-white px-3.5 py-2 rounded-xl border border-crema-border shadow-sm">
            <span className="text-[10px] text-tinta-muted block font-mono font-medium">Saldo en Billetera</span>
            <span className="text-sm font-heading font-extrabold text-cuero font-mono">
              ${investorData.walletBalanceUSDC.toLocaleString()} USDC
            </span>
          </div>
        </div>
      </div>

      {/* Main KPI Row with Claim Yield Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Claim Yield Card (5 Cols) */}
        <div className="md:col-span-5 bg-gradient-to-br from-monte to-monte-dark text-white rounded-xl p-6 border border-monte shadow-elevated flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-heading font-bold text-white">Dividendos Acumulados</h3>
                  <p className="text-[10px] text-white/75">Ventas físicas en remates de primavera</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-mono font-bold border border-white/25">
                Listos para Reclamar
              </span>
            </div>

            <div className="my-6 text-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/80 font-medium">
                Saldo Acumulado en USDC
              </span>
              <div className="mt-1 text-4xl font-heading font-extrabold text-white font-mono tracking-tight">
                ${claimableAmount.toFixed(2)}
              </div>
              <p className="text-xs text-white/90 mt-1.5 font-medium">
                Generado por 3 reproductores activos en centro genético
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleClaim}
              disabled={isClaiming || claimableAmount <= 0}
              className={`w-full py-2.5 px-4 rounded-lg font-heading font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm ${
                claimableAmount > 0 && !isClaiming
                  ? 'btn-action-leather'
                  : 'bg-white/15 text-white/60 border border-white/20 cursor-not-allowed'
              }`}
            >
              {isClaiming ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Acreditando en Hedera...</span>
                </>
              ) : claimableAmount > 0 ? (
                <span>Reclamar Rendimiento (Claim Yield)</span>
              ) : (
                <span>Dividendos Reclamados</span>
              )}
            </button>

            {claimSuccess && (
              <p className="text-[11px] text-esmeralda-light text-center font-mono font-bold">
                ✓ USDC transferido exitosamente a tu billetera
              </p>
            )}
          </div>
        </div>

        {/* Portfolio Metrics (7 Cols) */}
        <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div className="muurket-card bg-white border border-crema-border p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-tinta-muted font-medium block mb-1">
                Capital Total Invertido
              </span>
              <div className="text-2xl font-heading font-extrabold text-tinta font-mono">
                ${investorData.totalInvestedUSDC.toLocaleString()} <span className="text-xs text-tinta-muted font-sans font-normal">USDC</span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-crema-border text-xs text-tinta-muted">
              En 3 toros líderes con trazabilidad HTS
            </div>
          </div>

          <div className="muurket-card bg-white border border-crema-border p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-tinta-muted font-medium block mb-1">
                Valor Actual de Cartera
              </span>
              <div className="text-2xl font-heading font-extrabold text-tinta font-mono">
                ${investorData.portfolioCurrentValueUSDC.toLocaleString()} <span className="text-xs text-tinta-muted font-sans font-normal">USDC</span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-crema-border text-xs text-esmeralda font-bold">
              +{investorData.roiPercent}% Revalorización de Genética
            </div>
          </div>

          <div className="muurket-card bg-white border border-crema-border p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-tinta-muted font-medium block mb-1">
                Total Dividendos Cobrados
              </span>
              <div className="text-2xl font-heading font-extrabold text-tinta font-mono">
                ${investorData.totalYieldEarnedUSDC.toFixed(2)} <span className="text-xs text-tinta-muted font-sans font-normal">USDC</span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-crema-border text-xs text-tinta-muted">
              Liquidados en los últimos 4 trimestres
            </div>
          </div>

          <div className="muurket-card bg-white border border-crema-border p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-tinta-muted font-medium block mb-1">
                Total Pajuelas en Propiedad
              </span>
              <div className="text-2xl font-heading font-extrabold text-cuero font-mono">
                234 <span className="text-xs text-tinta-muted font-sans font-normal">Dosis</span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-crema-border text-xs text-tinta-muted">
              Aptas para dividendo o retiro físico
            </div>
          </div>

        </div>

      </div>

      {/* Bull Holdings List */}
      <div className="muurket-card bg-white border border-crema-border p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-crema-border">
          <div>
            <h3 className="text-base font-heading font-extrabold text-tinta">
              Tus Posiciones en Reproductores
            </h3>
            <p className="text-xs text-tinta-muted">
              Participaciones que devengan regalías por ventas físicas de semen.
            </p>
          </div>
          <span className="text-xs font-mono text-tinta-muted font-semibold bg-crema-surface px-2.5 py-1 rounded-md border border-crema-border">
            {investorData.holdings.length} Activos en Custodia
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {investorData.holdings.map((item, idx) => {
            const fullBull = allBulls?.find(b => b.id === item.bullId);
            return (
              <div
                key={idx}
                className="bg-crema-canvas rounded-xl overflow-hidden flex flex-col justify-between border border-crema-border shadow-sm hover:border-cuero/50 hover:shadow-md transition-all group"
              >
                <div>
                  <div className="relative h-40 overflow-hidden">
                    <img 
                      src={item.image} 
                      alt={item.bullName}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-tinta/90 via-tinta/30 to-transparent" />
                    
                    <div className="absolute top-2.5 left-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/95 text-tinta font-mono font-bold text-[10px] shadow-sm">
                        {item.breed}
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-monte text-white text-[10px] font-mono font-bold shadow-sm">
                        {item.estimatedAPY}% APY
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-3 right-3">
                      <p className="text-white font-heading font-extrabold text-sm truncate">
                        {item.bullName}
                      </p>
                      <p className="text-[10px] text-white/80 font-mono">
                        {item.symbol} · {item.cabana}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 space-y-2.5 text-xs bg-white">
                    <div className="p-2 rounded-lg bg-crema-surface border border-crema-border flex items-center justify-between">
                      <span className="text-tinta-muted font-medium">Tu Participación:</span>
                      <span className="font-mono font-bold text-tinta">
                        {item.sharePercent} del Toro
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-tinta-muted">
                      <div className="flex justify-between">
                        <span>Tokens en Cartera:</span>
                        <span className="font-mono text-tinta font-semibold">{item.tokensOwned} Fracciones</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valor de Posición:</span>
                        <span className="font-mono text-tinta font-bold">${item.currentValueUSDC.toLocaleString()} USDC</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pajuelas Liquidadas:</span>
                        <span className="font-mono text-tinta font-medium">{item.strawsSoldInHoldings} dosis vendidas</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dividendos Pagados:</span>
                        <span className="font-mono text-esmeralda font-bold">+${item.totalYieldDistributedUSDC.toFixed(2)} USDC</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-2 bg-white border-t border-crema-border/50">
                  <button
                    onClick={() => fullBull && onSelectBull(fullBull)}
                    className="w-full py-2 px-3 rounded-lg btn-action-primary text-white text-xs font-heading font-semibold transition-all text-center shadow-sm"
                  >
                    Ver Ficha o Adquirir Más
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction History Table */}
      <div className="muurket-card bg-white border border-crema-border p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-crema-border">
          <div>
            <h3 className="text-base font-heading font-extrabold text-tinta">
              Historial de Transacciones de Portafolio
            </h3>
            <p className="text-xs text-tinta-muted">
              Cobros de dividendos y adquisiciones de tokens registrados en Hedera.
            </p>
          </div>
          <span className="text-xs font-mono text-tinta-muted font-semibold bg-crema-surface px-2.5 py-1 rounded-md border border-crema-border">
            Cuenta: {investorData.hederaAccountId}
          </span>
        </div>

        <div className="divide-y divide-crema-border">
          {transactions.map((tx) => (
            <div key={tx.id} className="py-3 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'claim' ? 'bg-esmeralda-badge text-esmeralda' : 'bg-cuero-light text-cuero'
                }`}>
                  {tx.type === 'claim' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-bold text-tinta">{tx.title}</p>
                  <p className="text-[10px] text-tinta-muted font-mono">
                    Tx: {tx.txHash} · {tx.date}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className={`font-mono font-bold text-sm ${tx.type === 'claim' ? 'text-monte' : 'text-tinta'}`}>
                  {tx.amount}
                </p>
                <span className="text-[10px] text-esmeralda font-mono font-semibold">
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
