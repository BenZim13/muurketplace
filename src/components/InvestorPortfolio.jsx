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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-verdeSuave/10">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-piedra px-2 py-0.5 rounded bg-monte-dark border border-verdeSuave/10">
            Portafolio de Inversión RWA
          </span>
          <h1 className="text-2xl font-heading font-extrabold text-blanco mt-1">
            Mi Portafolio Ganadero y Rendimientos
          </h1>
          <p className="text-xs text-piedra">
            Seguimiento de participaciones en reproductores y cobro de dividendos por comercialización de pajuelas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-piedra block font-mono">Saldo en Billetera</span>
            <span className="text-sm font-heading font-bold text-blanco font-mono">
              ${investorData.walletBalanceUSDC.toLocaleString()} USDC
            </span>
          </div>
        </div>
      </div>

      {/* Main KPI Row with Claim Yield Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Claim Yield Card (5 Cols) */}
        <div className="md:col-span-5 muurket-panel p-6 border-verdeSuave/25 shadow-elevated flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-verdeSuave/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-monte text-esmeralda flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-heading font-bold text-blanco">Dividendos Acumulados</h3>
                  <p className="text-[10px] text-piedra">Ventas físicas en remates de primavera</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-monte text-esmeralda text-[10px] font-mono border border-verdeSuave/15">
                Listos para Reclamar
              </span>
            </div>

            <div className="my-6 text-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-piedra">
                Saldo Acumulado en USDC
              </span>
              <div className="mt-1 text-4xl font-heading font-extrabold text-blanco font-mono tracking-tight">
                ${claimableAmount.toFixed(2)}
              </div>
              <p className="text-xs text-crema mt-1.5 font-medium">
                Generado por 3 reproductores activos en centro genético
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleClaim}
              disabled={isClaiming || claimableAmount <= 0}
              className={`w-full py-2.5 px-4 rounded-lg font-heading font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                claimableAmount > 0 && !isClaiming
                  ? 'btn-action-primary'
                  : 'bg-monte-dark text-piedra border border-verdeSuave/10 cursor-not-allowed'
              }`}
            >
              {isClaiming ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-profundo-dark" />
                  <span>Acreditando en Hedera...</span>
                </>
              ) : claimableAmount > 0 ? (
                <span>Reclamar Rendimiento (Claim Yield)</span>
              ) : (
                <span>Dividendos Reclamados</span>
              )}
            </button>

            {claimSuccess && (
              <p className="text-[11px] text-esmeralda text-center font-mono">
                ✓ USDC transferido exitosamente a tu billetera
              </p>
            )}
          </div>
        </div>

        {/* Portfolio Metrics (7 Cols) */}
        <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div className="muurket-card p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-piedra block mb-1">
                Capital Total Invertido
              </span>
              <div className="text-2xl font-heading font-bold text-blanco font-mono">
                ${investorData.totalInvestedUSDC.toLocaleString()} <span className="text-xs text-piedra font-sans font-normal">USDC</span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-verdeSuave/10 text-xs text-piedra">
              En 3 toros líderes con trazabilidad HTS
            </div>
          </div>

          <div className="muurket-card p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-piedra block mb-1">
                Valor Actual de Cartera
              </span>
              <div className="text-2xl font-heading font-bold text-blanco font-mono">
                ${investorData.portfolioCurrentValueUSDC.toLocaleString()} <span className="text-xs text-piedra font-sans font-normal">USDC</span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-verdeSuave/10 text-xs text-esmeralda font-medium">
              +{investorData.roiPercent}% Revalorización de Genética
            </div>
          </div>

          <div className="muurket-card p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-piedra block mb-1">
                Total Dividendos Cobrados
              </span>
              <div className="text-2xl font-heading font-bold text-blanco font-mono">
                ${investorData.totalYieldEarnedUSDC.toFixed(2)} <span className="text-xs text-piedra font-sans font-normal">USDC</span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-verdeSuave/10 text-xs text-piedra">
              Liquidados en los últimos 4 trimestres
            </div>
          </div>

          <div className="muurket-card p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-piedra block mb-1">
                Total Pajuelas en Propiedad
              </span>
              <div className="text-2xl font-heading font-bold text-blanco font-mono">
                234 <span className="text-xs text-piedra font-sans font-normal">Dosis</span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-verdeSuave/10 text-xs text-piedra">
              Aptas para dividendo o retiro físico
            </div>
          </div>

        </div>

      </div>

      {/* Bull Holdings List */}
      <div className="muurket-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-verdeSuave/10">
          <div>
            <h3 className="text-base font-heading font-bold text-blanco">
              Tus Posiciones en Reproductores
            </h3>
            <p className="text-xs text-piedra">
              Participaciones que devengan regalías por ventas físicas de semen.
            </p>
          </div>
          <span className="text-xs font-mono text-piedra">
            {investorData.holdings.length} Activos en Custodia
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {investorData.holdings.map((item, idx) => {
            const fullBull = allBulls?.find(b => b.id === item.bullId);
            return (
              <div
                key={idx}
                className="muurket-solid overflow-hidden flex flex-col justify-between border border-verdeSuave/15 group"
              >
                <div>
                  <div className="relative h-40 overflow-hidden">
                    <img 
                      src={item.image} 
                      alt={item.bullName}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-profundo-dark via-profundo-dark/30 to-transparent" />
                    
                    <div className="absolute top-2.5 left-2.5">
                      <span className="px-2 py-0.5 rounded bg-profundo/90 text-crema font-mono text-[10px] border border-verdeSuave/15">
                        {item.breed}
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5">
                      <span className="px-2 py-0.5 rounded bg-monte text-esmeralda text-[10px] font-mono">
                        {item.estimatedAPY}% APY
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-3 right-3">
                      <p className="text-blanco font-heading font-bold text-sm truncate">
                        {item.bullName}
                      </p>
                      <p className="text-[10px] text-piedra font-mono">
                        {item.symbol} · {item.cabana}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 space-y-2.5 text-xs">
                    <div className="p-2 rounded bg-monte-dark/70 border border-verdeSuave/10 flex items-center justify-between">
                      <span className="text-piedra">Tu Participación:</span>
                      <span className="font-mono font-bold text-blanco">
                        {item.sharePercent} del Toro
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-piedra">
                      <div className="flex justify-between">
                        <span>Tokens en Cartera:</span>
                        <span className="font-mono text-blanco font-medium">{item.tokensOwned} Fracciones</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valor de Posición:</span>
                        <span className="font-mono text-crema font-bold">${item.currentValueUSDC.toLocaleString()} USDC</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pajuelas Liquidadas:</span>
                        <span className="font-mono text-blanco">{item.strawsSoldInHoldings} dosis vendidas</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dividendos Pagados:</span>
                        <span className="font-mono text-esmeralda font-semibold">+${item.totalYieldDistributedUSDC.toFixed(2)} USDC</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <button
                    onClick={() => fullBull && onSelectBull(fullBull)}
                    className="w-full py-1.5 px-3 rounded bg-monte hover:bg-monte-light border border-verdeSuave/15 text-crema text-xs font-heading font-semibold transition-colors text-center"
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
      <div className="muurket-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-verdeSuave/10">
          <div>
            <h3 className="text-base font-heading font-bold text-blanco">
              Historial de Transacciones de Portafolio
            </h3>
            <p className="text-xs text-piedra">
              Cobros de dividendos y adquisiciones de tokens registrados en Hedera.
            </p>
          </div>
          <span className="text-xs font-mono text-piedra">
            Cuenta: {investorData.hederaAccountId}
          </span>
        </div>

        <div className="divide-y divide-verdeSuave/10">
          {transactions.map((tx) => (
            <div key={tx.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'claim' ? 'bg-monte text-esmeralda' : 'bg-monte-dark text-piedra'
                }`}>
                  {tx.type === 'claim' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <p className="font-medium text-blanco">{tx.title}</p>
                  <p className="text-[10px] text-piedra font-mono">
                    Tx: {tx.txHash} · {tx.date}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className={`font-mono font-bold text-sm ${tx.type === 'claim' ? 'text-blanco' : 'text-piedra'}`}>
                  {tx.amount}
                </p>
                <span className="text-[10px] text-esmeralda font-mono">
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
