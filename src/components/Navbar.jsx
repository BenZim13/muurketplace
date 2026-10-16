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
    <header className="sticky top-0 z-40 bg-profundo/90 backdrop-blur-md border-b border-verdeSuave/10 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand Identity: MUURKET */}
        <div 
          className="flex items-center gap-3 cursor-pointer select-none group" 
          onClick={() => setActiveView(currentRole === 'seller' ? 'seller-dashboard' : 'buyer-marketplace')}
        >
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-verdeSuave/20 shadow-sm bg-monte flex-shrink-0 group-hover:scale-105 transition-transform">
            <img 
              src="/assets/logo_muurket.png" 
              alt="MUURKET Logo" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-heading font-extrabold tracking-tight text-blanco">
                MUURKET
              </span>
              <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-monte-dark text-piedra-light border border-verdeSuave/10">
                RWA Ganadero
              </span>
            </div>
            <p className="text-[11px] text-piedra hidden sm:block font-normal">
              Patrimonio ganadero · Inteligencia financiera
            </p>
          </div>
        </div>

        {/* Hedera Network Telemetry — Sobrio y Profesional */}
        <div className="hidden xl:flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-monte-dark/60 border border-verdeSuave/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="status-dot-active"></span>
            <span className="font-mono text-crema text-[11px]">Hedera Testnet</span>
          </div>
          <span className="text-verdeSuave/20">|</span>
          <div className="flex items-center gap-1.5 text-piedra text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-esmeralda" />
            <span>2,480 TPS</span>
          </div>
          <span className="text-verdeSuave/20">|</span>
          <div className="text-piedra text-[11px]">
            Gas: <span className="text-blanco font-mono">&lt;$0.001 USD</span>
          </div>
        </div>

        {/* Right Section: Role Switcher & Wallet */}
        <div className="flex items-center gap-3">
          
          {/* Segmented Control Role Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-monte-dark/90 border border-verdeSuave/15">
            <button
              onClick={() => {
                setCurrentRole('seller');
                setActiveView('seller-dashboard');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-colors ${
                currentRole === 'seller'
                  ? 'bg-monte text-blanco shadow-sm border border-verdeSuave/20'
                  : 'text-piedra hover:text-blanco'
              }`}
            >
              <span>Cabaña</span>
              <span className="text-[10px] text-piedra font-normal hidden sm:inline">(Vendedor)</span>
            </button>

            <button
              onClick={() => {
                setCurrentRole('buyer');
                setActiveView('buyer-marketplace');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-colors ${
                currentRole === 'buyer'
                  ? 'bg-monte text-blanco shadow-sm border border-verdeSuave/20'
                  : 'text-piedra hover:text-blanco'
              }`}
            >
              <span>Inversor</span>
              <span className="text-[10px] text-piedra font-normal hidden sm:inline">(Cliente)</span>
            </button>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-lg bg-monte-dark/60 hover:bg-monte border border-verdeSuave/15 text-piedra hover:text-blanco transition-colors relative"
              title="Notificaciones"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-esmeralda"></span>
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl muurket-panel p-4 shadow-elevated z-50 text-xs border border-verdeSuave/20 animate-in fade-in">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-verdeSuave/10">
                  <span className="font-heading font-bold text-blanco">Notificaciones Hedera</span>
                  <span className="text-[10px] text-piedra font-mono">En tiempo real</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-monte-dark/80 border border-verdeSuave/10">
                    <p className="font-semibold text-blanco">Venta de 50 Pajuelas — Don Luis</p>
                    <p className="text-piedra text-[11px] mt-0.5">Liquidación de 1,225 USDC a Cabaña Los Guaraníes</p>
                    <span className="text-[10px] text-piedra-dark mt-1 block">Hace 12 min</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-monte-dark/80 border border-verdeSuave/10">
                    <p className="font-semibold text-blanco">Dividendo Trimestral Acreditado</p>
                    <p className="text-piedra text-[11px] mt-0.5">+240.00 USDC disponibles de Pucará 459</p>
                    <span className="text-[10px] text-piedra-dark mt-1 block">Hace 2 horas</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* HashPack Hedera Wallet Button */}
          <div className="relative">
            <button
              onClick={() => setWalletModalOpen(!walletModalOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-monte-dark/80 hover:bg-monte border border-verdeSuave/15 transition-colors text-xs"
            >
              <div className="w-6 h-6 rounded-md bg-monte flex items-center justify-center text-esmeralda">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <div className="text-left hidden md:block">
                <div className="font-mono text-blanco text-[11px] font-medium flex items-center gap-1.5">
                  <span>{activeAccount}</span>
                  <span className="status-dot-active"></span>
                </div>
                <div className="text-[10px] text-piedra font-mono">
                  ${activeBalance.toLocaleString()} USDC
                </div>
              </div>
              <ChevronDown className="w-3 h-3 text-piedra" />
            </button>

            {/* Wallet Details Popover */}
            {walletModalOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl muurket-panel p-4 shadow-elevated z-50 text-xs border border-verdeSuave/20 animate-in fade-in">
                <div className="flex items-center justify-between pb-2.5 border-b border-verdeSuave/10">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-monte flex items-center justify-center text-esmeralda">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-blanco">HashPack Wallet</p>
                      <p className="text-[10px] text-piedra">Hedera Testnet</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-monte text-esmeralda text-[10px] font-mono border border-verdeSuave/10">
                    Conectado
                  </span>
                </div>

                <div className="my-3 p-2.5 rounded-lg bg-monte-dark/90 border border-verdeSuave/10">
                  <div className="flex items-center justify-between text-piedra text-[11px] mb-1">
                    <span>ID de Cuenta</span>
                    <button onClick={copyAddress} className="flex items-center gap-1 text-esmeralda hover:underline">
                      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <p className="font-mono text-blanco font-semibold text-sm">
                    {activeAccount}
                  </p>
                </div>

                <div className="space-y-2 py-1.5 text-piedra text-xs">
                  <div className="flex justify-between">
                    <span>Saldo USDC</span>
                    <span className="font-mono font-bold text-blanco">${activeBalance.toLocaleString()} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saldo HBAR</span>
                    <span className="font-mono text-blanco">{activeHBAR.toLocaleString()} HBAR</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Modo Activo</span>
                    <span className="text-crema font-medium">
                      {currentRole === 'seller' ? 'Cabaña (Vendedor)' : 'Inversor (Cliente)'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-verdeSuave/10">
                  <a 
                    href={`https://hashscan.io/testnet/account/${activeAccount}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full py-1.5 px-2 rounded bg-monte hover:bg-monte-light text-center text-blanco text-[11px] flex items-center justify-center gap-1.5 transition-colors border border-verdeSuave/15"
                  >
                    <span>Consultar en HashScan</span>
                    <ExternalLink className="w-3 h-3 text-piedra" />
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
