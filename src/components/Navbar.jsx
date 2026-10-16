import React, { useState } from 'react';
import { 
  Wallet, 
  ChevronDown, 
  Bell, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  ShieldCheck,
  Cpu
} from 'lucide-react';

export default function Navbar({ 
  currentRole, 
  setCurrentRole, 
  activeView, 
  setActiveView, 
  sellerData, 
  investorData,
}) {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const activeAccount = currentRole === 'seller' ? sellerData.hederaAccountId : investorData.hederaAccountId;
  const activeBalance = currentRole === 'seller' ? sellerData.walletBalanceUSDC : investorData.walletBalanceUSDC;
  const activeHBAR = currentRole === 'seller' ? sellerData.walletBalanceHBAR : investorData.walletBalanceHBAR;

  const copyAddress = () => {
    navigator.clipboard.writeText(activeAccount);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-crema-border px-4 lg:px-8 py-3 shadow-[0_2px_10px_-2px_rgba(23,63,50,0.04)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand Identity: MUURKET */}
        <div 
          className="flex items-center gap-3 cursor-pointer select-none group" 
          onClick={() => setActiveView(currentRole === 'seller' ? 'seller-dashboard' : 'buyer-marketplace')}
        >
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-crema-border shadow-sm bg-monte flex-shrink-0 group-hover:scale-105 transition-transform">
            <img 
              src="/assets/logo_muurket.png" 
              alt="MUURKET Logo" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-heading font-extrabold tracking-tight text-tinta">
                MUURKET
              </span>
              <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-salvia-light text-salvia font-semibold border border-salvia-border">
                RWA Ganadero
              </span>
            </div>
            <p className="text-[11px] text-tinta-muted hidden sm:block font-normal">
              Patrimonio ganadero · Inteligencia financiera
            </p>
          </div>
        </div>

        {/* Hedera Network Telemetry */}
        <div className="hidden xl:flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-crema-surface border border-crema-border text-xs">
          <div className="flex items-center gap-2">
            <span className="status-dot-active"></span>
            <span className="font-mono text-tinta text-[11px] font-semibold">Hedera Testnet</span>
          </div>
          <span className="text-crema-border">|</span>
          <div className="flex items-center gap-1.5 text-tinta-muted text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-esmeralda" />
            <span className="font-mono font-medium text-tinta">2,480 TPS</span>
          </div>
          <span className="text-crema-border">|</span>
          <div className="text-tinta-muted text-[11px]">
            Gas: <span className="text-tinta font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-crema-border/70">&lt;$0.001 USD</span>
          </div>
        </div>

        {/* Right Section: Role Switcher & Wallet */}
        <div className="flex items-center gap-3">
          
          {/* Segmented Control Role Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-crema-surface border border-crema-border shadow-inner">
            <button
              onClick={() => {
                setCurrentRole('seller');
                setActiveView('seller-dashboard');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-all ${
                currentRole === 'seller'
                  ? 'bg-monte text-white shadow-sm'
                  : 'text-tinta-muted hover:text-tinta'
              }`}
            >
              <span>Cabaña</span>
              <span className={`text-[10px] font-normal hidden sm:inline ${currentRole === 'seller' ? 'text-white/80' : 'text-tinta-subtle'}`}>(Vendedor)</span>
            </button>

            <button
              onClick={() => {
                setCurrentRole('buyer');
                setActiveView('buyer-marketplace');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-all ${
                currentRole === 'buyer'
                  ? 'bg-monte text-white shadow-sm'
                  : 'text-tinta-muted hover:text-tinta'
              }`}
            >
              <span>Inversor</span>
              <span className={`text-[10px] font-normal hidden sm:inline ${currentRole === 'buyer' ? 'text-white/80' : 'text-tinta-subtle'}`}>(Cliente)</span>
            </button>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-lg bg-white hover:bg-crema-surface border border-crema-border text-tinta-muted hover:text-tinta transition-colors relative shadow-sm"
              title="Notificaciones"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cuero ring-2 ring-white"></span>
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white p-4 shadow-elevated z-50 text-xs border border-crema-border animate-in fade-in">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-crema-border">
                  <span className="font-heading font-bold text-tinta">Notificaciones Hedera</span>
                  <span className="text-[10px] text-esmeralda font-mono font-bold bg-esmeralda-badge px-1.5 py-0.5 rounded">En vivo</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-crema-canvas border border-crema-border/70 hover:border-cuero/50 transition-colors">
                    <p className="font-semibold text-tinta">Venta de 50 Pajuelas — Don Luis</p>
                    <p className="text-tinta-muted text-[11px] mt-0.5">Liquidación de 1,225 USDC a Cabaña Los Guaraníes</p>
                    <span className="text-[10px] text-tinta-subtle mt-1 block">Hace 12 min</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-crema-canvas border border-crema-border/70 hover:border-cuero/50 transition-colors">
                    <p className="font-semibold text-tinta">Dividendo Trimestral Acreditado</p>
                    <p className="text-tinta-muted text-[11px] mt-0.5">+240.00 USDC disponibles de Pucará 459</p>
                    <span className="text-[10px] text-tinta-subtle mt-1 block">Hace 2 horas</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* HashPack Hedera Wallet Button */}
          <div className="relative">
            <button
              onClick={() => setWalletModalOpen(!walletModalOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white hover:bg-crema-surface border border-crema-border transition-colors text-xs shadow-sm"
            >
              <div className="w-6 h-6 rounded-md bg-salvia-light flex items-center justify-center text-monte">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <div className="text-left hidden md:block">
                <div className="font-mono text-tinta text-[11px] font-semibold flex items-center gap-1.5">
                  <span>{activeAccount}</span>
                  <span className="status-dot-active"></span>
                </div>
                <div className="text-[10px] text-cuero font-mono font-bold">
                  ${activeBalance.toLocaleString()} USDC
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-tinta-muted" />
            </button>

            {/* Wallet Details Popover */}
            {walletModalOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white p-4 shadow-elevated z-50 text-xs border border-crema-border animate-in fade-in">
                <div className="flex items-center justify-between pb-2.5 border-b border-crema-border">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-salvia-light flex items-center justify-center text-monte">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-tinta">HashPack Wallet</p>
                      <p className="text-[10px] text-tinta-muted">Hedera Testnet</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-esmeralda-badge text-esmeralda font-semibold text-[10px] font-mono border border-esmeralda/20">
                    Conectado
                  </span>
                </div>

                <div className="my-3 p-2.5 rounded-lg bg-crema-canvas border border-crema-border">
                  <div className="flex items-center justify-between text-tinta-muted text-[11px] mb-1">
                    <span>ID de Cuenta</span>
                    <button onClick={copyAddress} className="flex items-center gap-1 text-cuero font-medium hover:underline">
                      {copied ? <CheckCircle2 className="w-3 h-3 text-esmeralda" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <p className="font-mono text-tinta font-bold text-sm">
                    {activeAccount}
                  </p>
                </div>

                <div className="space-y-2 py-1.5 text-xs text-tinta-muted">
                  <div className="flex justify-between">
                    <span>Saldo USDC</span>
                    <span className="font-mono font-bold text-tinta">${activeBalance.toLocaleString()} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saldo HBAR</span>
                    <span className="font-mono font-bold text-tinta">{activeHBAR.toLocaleString()} HBAR</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Modo Activo</span>
                    <span className="text-cuero font-semibold">
                      {currentRole === 'seller' ? 'Cabaña (Vendedor)' : 'Inversor (Cliente)'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-crema-border">
                  <a 
                    href={`https://hashscan.io/testnet/account/${activeAccount}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full py-2 px-2.5 rounded-lg btn-action-primary text-center text-white text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>Consultar en HashScan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
}
