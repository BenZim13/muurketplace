import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Bell, 
  CheckCircle2, 
  Sparkles
} from 'lucide-react';

export default function InvestorProfile({ investorData }) {
  const [notifySemenSales, setNotifySemenSales] = useState(true);
  const [notifyDividends, setNotifyDividends] = useState(true);
  const [notifyNewBulls, setNotifyNewBulls] = useState(true);
  const [autoReinvest, setAutoReinvest] = useState(false);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="pb-3 border-b border-verdeSuave/10">
        <span className="text-[10px] uppercase font-mono tracking-widest text-piedra px-2 py-0.5 rounded bg-monte-dark border border-verdeSuave/10">
          Cuenta de Inversor
        </span>
        <h1 className="text-2xl font-heading font-extrabold text-blanco mt-1">
          Perfil de Inversor y Verificación KYC
        </h1>
        <p className="text-xs text-piedra">
          Identidad digital descentralizada Hedera DID y preferencias de cobro de dividendos.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: User Card & KYC (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          <div className="muurket-card p-6 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl bg-monte border border-verdeSuave/20 flex items-center justify-center text-xl text-crema font-heading font-bold shadow-sm">
                IZ
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-heading font-bold text-blanco">{investorData.userName}</h3>
                  <CheckCircle2 className="w-4 h-4 text-esmeralda" />
                </div>
                <p className="text-xs text-piedra">{investorData.userRole}</p>
                <p className="text-[11px] text-crema font-mono mt-0.5">{investorData.location}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg muurket-solid space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-crema font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-esmeralda" />
                  <span>Validación de Identidad</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-monte text-esmeralda font-mono text-[10px] border border-verdeSuave/15">
                  KYC Nivel 2 Aprobado
                </span>
              </div>
              <p className="text-[11px] text-piedra leading-relaxed">
                Biometría validada contra RENAPER y credencial descentralizada anclada a Hedera Consensus Service.
              </p>
              <div className="pt-2 text-[10px] font-mono text-piedra flex justify-between border-t border-verdeSuave/10">
                <span>did:hedera:testnet:0.0.651928</span>
                <span className="text-crema">Válido 2026-2028</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-verdeSuave/10 text-piedra">
                <span>Cuenta HashPack:</span>
                <span className="font-mono text-blanco font-medium">{investorData.hederaAccountId}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-verdeSuave/10 text-piedra">
                <span>Límite de Suscripción:</span>
                <span className="font-mono text-blanco font-medium">Sin límite (Productor Verificado)</span>
              </div>
              <div className="flex justify-between py-2 text-piedra">
                <span>Red de Liquidación:</span>
                <span className="font-mono text-crema text-[11px]">Hedera Hashgraph</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right: Preferences and Reinvestment (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Notifications Card */}
          <div className="muurket-card p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-verdeSuave/10">
              <Bell className="w-4 h-4 text-crema" />
              <h3 className="text-sm font-heading font-bold text-blanco">Preferencias de Alertas y Dividendos</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              
              <div className="p-3 rounded-lg bg-monte-dark/60 border border-verdeSuave/10 flex items-center justify-between">
                <div>
                  <p className="font-medium text-blanco">Avisos de Liquidación de Pajuelas</p>
                  <p className="text-[11px] text-piedra">Aviso cada vez que una cabaña liquide ventas de dosis físicas.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifySemenSales}
                  onChange={(e) => setNotifySemenSales(e.target.checked)}
                  className="accent-esmeralda w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-lg bg-monte-dark/60 border border-verdeSuave/10 flex items-center justify-between">
                <div>
                  <p className="font-medium text-blanco">Alertas de Dividendos Trimestrales</p>
                  <p className="text-[11px] text-piedra">Notificación al acreditarse USDC en el pool de Claim Yield.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyDividends}
                  onChange={(e) => setNotifyDividends(e.target.checked)}
                  className="accent-esmeralda w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-lg bg-monte-dark/60 border border-verdeSuave/10 flex items-center justify-between">
                <div>
                  <p className="font-medium text-blanco">Nuevos Toros Líderes en Ronda</p>
                  <p className="text-[11px] text-piedra">Aviso prioritario al publicarse un Gran Campeón de exposición.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyNewBulls}
                  onChange={(e) => setNotifyNewBulls(e.target.checked)}
                  className="accent-esmeralda w-4 h-4 cursor-pointer"
                />
              </div>

            </div>
          </div>

          {/* Autocompound Strategy */}
          <div className="muurket-card p-6 space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-verdeSuave/10">
              <Sparkles className="w-4 h-4 text-esmeralda" />
              <h3 className="text-sm font-heading font-bold text-blanco">Estrategia de Interés Compuesto</h3>
            </div>

            <div className="p-3.5 rounded-lg muurket-solid flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blanco">Re-inversión Automática de Dividendos</p>
                <p className="text-[11px] text-piedra mt-0.5">
                  Los rendimientos en USDC generados se re-invierten automáticamente en fracciones de nuevos toros líderes calificados con APY &gt; 25%.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={autoReinvest}
                  onChange={(e) => setAutoReinvest(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-profundo rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-blanco after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-esmeralda"></div>
              </label>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
