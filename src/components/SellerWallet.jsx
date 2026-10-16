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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-crema-border">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-tinta-muted px-2 py-0.5 rounded bg-crema-surface border border-crema-border">
            Tesorería Cabaña Ganadera
          </span>
          <h1 className="text-2xl font-heading font-extrabold text-tinta mt-1">
            Wallet y Liquidaciones Financieras
          </h1>
          <p className="text-xs text-tinta-muted">
            Fondos en custodia por financiamiento de reproductores y liquidación de dosis físicas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setWithdrawModalOpen(true)}
            className="px-4 py-2 rounded-lg btn-action-leather text-xs flex items-center gap-2 shadow-sm font-semibold"
          >
            <Landmark className="w-4 h-4" />
            <span>Retirar a CBU Bancario (ARS)</span>
          </button>
        </div>
      </div>

      {/* Main Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Available USDC Card */}
        <div className="bg-white rounded-xl border border-crema-border p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-tinta-muted text-xs mb-1.5">
              <span>Saldo Disponible Recaudado</span>
              <span className="status-dot-active"></span>
            </div>
            <div className="text-3xl font-heading font-bold text-tinta">
              ${sellerData.walletBalanceUSDC.toLocaleString()} <span className="text-sm font-normal text-tinta-muted">USDC</span>
            </div>
            <p className="text-xs text-cuero mt-1.5 font-mono font-medium">
              ≈ ${(sellerData.walletBalanceUSDC * usdcToArsRate).toLocaleString()} ARS
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-crema-border flex justify-between text-[11px] text-tinta-muted">
            <span>Disponibilidad inmediata</span>
            <span className="text-esmeralda font-semibold">Sin comisiones de custodia</span>
          </div>
        </div>

        {/* Hedera Treasury Account Card */}
        <div className="bg-white rounded-xl border border-crema-border p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-tinta-muted text-xs mb-1.5">
              <span>Cuenta Tesorería Hedera</span>
              <ShieldCheck className="w-4 h-4 text-esmeralda" />
            </div>
            <div className="flex items-center gap-2 my-1">
              <span className="text-lg font-mono font-bold text-tinta">
                {sellerData.hederaAccountId}
              </span>
              <button 
                onClick={copyAddress}
                className="p-1 rounded hover:bg-crema-surface text-tinta-muted hover:text-tinta transition-colors"
                title="Copiar ID"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-esmeralda" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-xs text-tinta-muted font-mono mt-1">
              Reserva de Gas: <strong className="text-monte font-semibold">{sellerData.walletBalanceHBAR.toLocaleString()} HBAR</strong>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-crema-border flex items-center justify-between text-[11px]">
            <span className="text-tinta-muted">Trazabilidad pública</span>
            <a 
              href={`https://hashscan.io/testnet/account/${sellerData.hederaAccountId}`}
              target="_blank"
              rel="noreferrer"
              className="text-esmeralda hover:underline flex items-center gap-1 font-mono font-medium"
            >
              <span>HashScan</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Straws Stock */}
        <div className="bg-white rounded-xl border border-crema-border p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-tinta-muted text-xs mb-1.5">
              <span>Stock Físico en Criocentro</span>
              <span className="px-2 py-0.5 rounded bg-salvia-light text-salvia text-[10px] font-mono border border-salvia/20 font-semibold">
                Nitrógeno Líquido
              </span>
            </div>
            <div className="text-3xl font-heading font-bold text-tinta">
              {sellerData.totalStrawsDistributed.toLocaleString()} <span className="text-sm font-normal text-tinta-muted">Pajuelas</span>
            </div>
            <p className="text-xs text-tinta-muted mt-1">
              Centro Genético Litoral SENASA #BA-912
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-crema-border flex justify-between text-[11px] text-tinta-muted">
            <span>Próximo cierre de remate:</span>
            <span className="text-tinta font-semibold">30 de Marzo 2026</span>
          </div>
        </div>

      </div>

      {/* Transactions Table Ledger */}
      <div className="bg-white rounded-xl border border-crema-border p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-crema-border">
          <div>
            <h3 className="text-base font-heading font-bold text-tinta">
              Libro Contable de Operaciones en Red
            </h3>
            <p className="text-xs text-tinta-muted">
              Registro inmutable de ingresos por colocación de tokens y egresos por liquidación bancaria.
            </p>
          </div>
          <span className="text-xs font-mono text-tinta-muted px-2 py-1 rounded bg-crema-surface border border-crema-border">
            Auditoría HTS 0.0.482910
          </span>
        </div>

        <div className="divide-y divide-crema-border overflow-x-auto">
          {transactions.map((tx) => (
            <div key={tx.id} className="py-3 flex items-center justify-between gap-4 text-xs hover:bg-crema-surface/60 px-2 rounded transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'in' 
                    ? 'bg-salvia-light text-esmeralda border border-salvia/20' 
                    : 'bg-cuero/10 text-cuero border border-cuero/20'
                }`}>
                  {tx.type === 'in' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div className="truncate">
                  <p className="font-semibold text-tinta truncate">{tx.desc}</p>
                  <p className="text-[10px] text-tinta-muted font-mono">
                    Tx: {tx.txHash} · {tx.date}
                  </p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className={`font-mono font-bold text-sm ${tx.type === 'in' ? 'text-esmeralda' : 'text-cuero'}`}>
                  {tx.amount}
                </p>
                <span className="text-[10px] font-mono text-tinta-muted">
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Withdraw Modal */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-tinta/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-crema-border shadow-elevated space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-crema-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cuero/10 text-cuero flex items-center justify-center">
                  <Landmark className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-heading font-bold text-tinta">Liquidación a Cuenta Bancaria (ARS)</h3>
              </div>
              <button 
                onClick={() => {
                  setWithdrawModalOpen(false);
                  setWithdrawSuccess(false);
                }}
                className="text-tinta-muted hover:text-tinta text-sm p-1 rounded hover:bg-crema-surface"
              >
                ✕
              </button>
            </div>

            {!withdrawSuccess ? (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-tinta font-semibold mb-1">
                    Monto en USDC a Retirar
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full muurket-input font-mono text-sm pr-16"
                    />
                    <span className="absolute right-3 top-2.5 text-tinta-muted font-mono text-xs font-semibold">
                      USDC
                    </span>
                  </div>
                  <p className="text-[11px] text-cuero mt-1 font-mono font-medium">
                    Acreditación estimada: ${(parseFloat(withdrawAmount || 0) * usdcToArsRate).toLocaleString()} ARS
                  </p>
                </div>

                <div>
                  <label className="block text-tinta font-semibold mb-1">
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
                  <label className="block text-tinta font-semibold mb-1">
                    CBU / Alias
                  </label>
                  <input
                    type="text"
                    value={bankAlias}
                    onChange={(e) => setBankAlias(e.target.value)}
                    className="w-full muurket-input font-mono uppercase"
                  />
                  <span className="text-[10px] text-tinta-muted">Titular: Cabaña Los Guaraníes S.A. (CUIT 30-71289104-9)</span>
                </div>

                <div className="p-3 rounded-lg bg-crema-surface border border-crema-border text-[11px] text-tinta-muted">
                  Transferencia inmediata a cuenta verificada según normativa cambiaria vigente.
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={isProcessing || !withdrawAmount}
                  className="w-full py-2.5 rounded-lg btn-action-leather text-xs font-heading font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Procesando acreditación...</span>
                    </>
                  ) : (
                    <span>Confirmar Liquidación</span>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-salvia-light text-esmeralda border border-esmeralda/20 flex items-center justify-center text-xl font-bold">
                  ✓
                </div>
                <h4 className="text-sm font-heading font-bold text-tinta">Liquidación Registrada</h4>
                <p className="text-xs text-tinta-muted">
                  Se ordenó la acreditación de ${(parseFloat(withdrawAmount) * usdcToArsRate).toLocaleString()} ARS en <strong className="text-tinta">{bankAlias}</strong>.
                </p>
                <button
                  onClick={() => {
                    setWithdrawModalOpen(false);
                    setWithdrawSuccess(false);
                  }}
                  className="px-5 py-2 rounded-lg bg-monte hover:bg-monte-light text-white text-xs font-semibold shadow-sm transition-colors"
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
