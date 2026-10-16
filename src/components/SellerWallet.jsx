import React, { useState } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ExternalLink, 
  Copy, 
  CheckCircle2, 
  Landmark,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SellerWallet({ sellerData }) {
  const [copied, setCopied] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('5000');
  const [bankAlias, setBankAlias] = useState('CABANA.GUARANIES.CORR');
  const [isProcessing, setIsProcessing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const [transactions, setTransactions] = useState([
    { id: 'tx-1', type: 'in', desc: 'Venta de 50 Fracciones — Don Luis (HTS 0.0.781923)', amount: '+1,225.00 USDC', date: 'Hoy, 14:22', txHash: '0.0.482910@1739371250', status: 'Confirmado' },
    { id: 'tx-2', type: 'in', desc: 'Venta de 200 Fracciones — Don Luis (HTS 0.0.781923)', amount: '+4,900.00 USDC', date: 'Hoy, 11:40', txHash: '0.0.482910@1739364000', status: 'Confirmado' },
    { id: 'tx-3', type: 'in', desc: 'Liquidación Remate Primavera Pajuelas Físicas', amount: '+12,450.00 USDC', date: 'Ayer', txHash: '0.0.482910@1739280000', status: 'Confirmado' },
    { id: 'tx-4', type: 'out', desc: 'Transferencia CBU Banco Galicia (Liquidación ARS)', amount: '-10,000.00 USDC', date: '10 Feb 2026', txHash: '0.0.482910@1739193600', status: 'Acreditado' },
    { id: 'tx-5', type: 'in', desc: 'Venta 75 Fracciones — Colorado Correntino', amount: '+1,275.00 USDC', date: '08 Feb 2026', txHash: '0.0.482910@1739020800', status: 'Confirmado' },
  ]);

  const copyAddress = () => {
    navigator.clipboard.writeText(sellerData.hederaAccountId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdraw = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setWithdrawSuccess(true);
      confetti({ particleCount: 70, spread: 50 });
      setTransactions(prev => [
        {
          id: `tx-${Date.now()}`,
          type: 'out',
          desc: `Liquidación Bancaria CBU (${bankAlias})`,
          amount: `-${parseFloat(withdrawAmount).toLocaleString()}.00 USDC`,
          date: 'Justo ahora',
          txHash: `0.0.482910@${Math.floor(Date.now() / 1000)}`,
          status: 'En acreditación'
        },
        ...prev
      ]);
    }, 1800);
  };

  const usdcToArsRate = 1290; // Tipo de cambio estimado

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-verdeSuave/10">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-piedra px-2 py-0.5 rounded bg-monte-dark border border-verdeSuave/10">
            Tesorería Cabaña Ganadera
          </span>
          <h1 className="text-2xl font-heading font-extrabold text-blanco mt-1">
            Wallet y Liquidaciones Financieras
          </h1>
          <p className="text-xs text-piedra">
            Fondos en custodia por financiamiento de reproductores y liquidación de dosis físicas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setWithdrawModalOpen(true)}
            className="px-4 py-2 rounded-lg btn-action-leather text-xs flex items-center gap-2 shadow-sm"
          >
            <Landmark className="w-4 h-4" />
            <span>Retirar a CBU Bancario (ARS)</span>
          </button>
        </div>
      </div>

      {/* Main Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Available USDC Card */}
        <div className="muurket-panel p-6 border-verdeSuave/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-piedra text-xs mb-1.5">
              <span>Saldo Disponible Recaudado</span>
              <span className="status-dot-active"></span>
            </div>
            <div className="text-3xl font-heading font-bold text-blanco">
              ${sellerData.walletBalanceUSDC.toLocaleString()} <span className="text-sm font-normal text-piedra">USDC</span>
            </div>
            <p className="text-xs text-crema mt-1.5 font-mono">
              ≈ ${(sellerData.walletBalanceUSDC * usdcToArsRate).toLocaleString()} ARS
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-verdeSuave/10 flex justify-between text-[11px] text-piedra">
            <span>Disponibilidad inmediata</span>
            <span className="text-esmeralda">Sin comisiones de custodia</span>
          </div>
        </div>

        {/* Hedera Treasury Account Card */}
        <div className="muurket-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-piedra text-xs mb-1.5">
              <span>Cuenta Tesorería Hedera</span>
              <ShieldCheck className="w-4 h-4 text-esmeralda" />
            </div>
            <div className="flex items-center gap-2 my-1">
              <span className="text-lg font-mono font-bold text-blanco">
                {sellerData.hederaAccountId}
              </span>
              <button 
                onClick={copyAddress}
                className="p-1 rounded hover:bg-monte text-piedra hover:text-blanco transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-esmeralda" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-xs text-piedra font-mono mt-1">
              Reserva de Gas: <strong className="text-crema">{sellerData.walletBalanceHBAR.toLocaleString()} HBAR</strong>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-verdeSuave/10 flex items-center justify-between text-[11px]">
            <span className="text-piedra">Trazabilidad pública</span>
            <a 
              href={`https://hashscan.io/testnet/account/${sellerData.hederaAccountId}`}
              target="_blank"
              rel="noreferrer"
              className="text-esmeralda hover:underline flex items-center gap-1 font-mono"
            >
              <span>HashScan</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Straws Stock */}
        <div className="muurket-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-piedra text-xs mb-1.5">
              <span>Stock Físico en Criocentro</span>
              <span className="px-2 py-0.5 rounded bg-monte-dark text-cuero text-[10px] font-mono border border-verdeSuave/10">
                Nitrógeno Líquido
              </span>
            </div>
            <div className="text-3xl font-heading font-bold text-blanco">
              {sellerData.totalStrawsDistributed.toLocaleString()} <span className="text-sm font-normal text-piedra">Pajuelas</span>
            </div>
            <p className="text-xs text-piedra mt-1">
              Centro Genético Litoral SENASA #BA-912
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-verdeSuave/10 flex justify-between text-[11px] text-piedra">
            <span>Próximo cierre de remate:</span>
            <span className="text-blanco font-medium">30 de Marzo 2026</span>
          </div>
        </div>

      </div>

      {/* Transactions Table Ledger */}
      <div className="muurket-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-verdeSuave/10">
          <div>
            <h3 className="text-base font-heading font-bold text-blanco">
              Libro Contable de Operaciones en Red
            </h3>
            <p className="text-xs text-piedra">
              Registro inmutable de ingresos por colocación de tokens y egresos por liquidación bancaria.
            </p>
          </div>
          <span className="text-xs font-mono text-piedra">
            Auditoría HTS 0.0.482910
          </span>
        </div>

        <div className="divide-y divide-verdeSuave/10 overflow-x-auto">
          {transactions.map((tx) => (
            <div key={tx.id} className="py-3 flex items-center justify-between gap-4 text-xs hover:bg-monte-dark/30 px-2 rounded transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'in' 
                    ? 'bg-monte text-esmeralda' 
                    : 'bg-cuero/20 text-cuero'
                }`}>
                  {tx.type === 'in' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div className="truncate">
                  <p className="font-medium text-blanco truncate">{tx.desc}</p>
                  <p className="text-[10px] text-piedra font-mono">
                    Tx: {tx.txHash} · {tx.date}
                  </p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`font-mono font-bold text-sm ${tx.type === 'in' ? 'text-blanco' : 'text-piedra'}`}>
                  {tx.amount}
                </p>
                <span className="text-[10px] font-mono text-piedra">
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Withdraw Modal */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-profundo-dark/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md muurket-panel p-6 border-verdeSuave/25 shadow-elevated space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-verdeSuave/10">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-cuero" />
                <h3 className="text-sm font-heading font-bold text-blanco">Liquidación a Cuenta Bancaria (ARS)</h3>
              </div>
              <button 
                onClick={() => {
                  setWithdrawModalOpen(false);
                  setWithdrawSuccess(false);
                }}
                className="text-piedra hover:text-blanco text-sm"
              >
                ✕
              </button>
            </div>

            {!withdrawSuccess ? (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-crema font-medium mb-1">
                    Monto en USDC a Retirar
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full muurket-input font-mono text-sm"
                    />
                    <span className="absolute right-3 top-2.5 text-piedra font-mono text-xs">
                      USDC
                    </span>
                  </div>
                  <p className="text-[11px] text-crema mt-1 font-mono">
                    Acreditación estimada: ${(parseFloat(withdrawAmount || 0) * usdcToArsRate).toLocaleString()} ARS
                  </p>
                </div>

                <div>
                  <label className="block text-crema font-medium mb-1">
                    Entidad Bancaria de Destino
                  </label>
                  <select className="w-full muurket-input text-xs">
                    <option>Banco Galicia (Cuenta Especial Agro)</option>
                    <option>Banco de Corrientes (Sucursal Mercedes)</option>
                    <option>BBVA Agro NEA</option>
                    <option>Banco Macro Agro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-crema font-medium mb-1">
                    CBU / Alias
                  </label>
                  <input
                    type="text"
                    value={bankAlias}
                    onChange={(e) => setBankAlias(e.target.value)}
                    className="w-full muurket-input font-mono uppercase"
                  />
                  <span className="text-[10px] text-piedra">Titular: Cabaña Los Guaraníes S.A. (CUIT 30-71289104-9)</span>
                </div>

                <div className="p-3 rounded-lg bg-monte-dark/60 border border-verdeSuave/10 text-[11px] text-piedra">
                  Transferencia inmediata a cuenta verificada según normativa cambiaria vigente.
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={isProcessing || !withdrawAmount}
                  className="w-full py-2.5 rounded-lg btn-action-leather text-xs font-heading font-bold flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-blanco" />
                      <span>Procesando acreditación...</span>
                    </>
                  ) : (
                    <span>Confirmar Liquidación</span>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-monte text-esmeralda flex items-center justify-center text-lg">
                  ✓
                </div>
                <h4 className="text-sm font-heading font-bold text-blanco">Liquidación Registrada</h4>
                <p className="text-xs text-piedra">
                  Se ordenó la acreditación de ${(parseFloat(withdrawAmount) * usdcToArsRate).toLocaleString()} ARS en {bankAlias}.
                </p>
                <button
                  onClick={() => {
                    setWithdrawModalOpen(false);
                    setWithdrawSuccess(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-monte hover:bg-monte-light text-blanco text-xs font-medium"
                >
                  Cerrar
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
