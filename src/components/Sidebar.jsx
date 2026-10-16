import React from 'react';
import { 
  LayoutDashboard, 
  Calculator, 
  Wallet, 
  Award, 
  Store, 
  PieChart, 
  UserCheck, 
  ArrowUpRight,
  ShieldCheck,
  Dna
} from 'lucide-react';

export default function Sidebar({ 
  currentRole, 
  activeView, 
  setActiveView,
  sellerData,
  investorData
}) {
  const sellerNav = [
    {
      id: 'seller-dashboard',
      label: 'Mi Dashboard',
      description: 'Métricas y toros activos',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'seller-pricing',
      label: 'Publicación & Tasación',
      description: 'Motor biológico y emisión HTS',
      icon: Calculator,
      badge: 'Tasador IA',
    },
    {
      id: 'seller-wallet',
      label: 'Mi Wallet & Liquidación',
      description: 'USDC recaudado y retiros',
      icon: Wallet,
      badge: `$${(sellerData.walletBalanceUSDC / 1000).toFixed(1)}k`
    },
    {
      id: 'seller-profile',
      label: 'Perfil de Cabaña',
      description: 'Validaciones Braford/Brangus',
      icon: Award,
      badge: 'Verificado'
    }
  ];

  const buyerNav = [
    {
      id: 'buyer-marketplace',
      label: 'Explorar Marketplace',
      description: 'Toros líderes en ronda',
      icon: Store,
      badge: '3 Activos'
    },
    {
      id: 'buyer-portfolio',
      label: 'Mi Portfolio & Yield',
      description: 'Mis fracciones y dividendos',
      icon: PieChart,
      badge: `Claim: $${investorData.claimableYieldUSDC.toFixed(0)}`,
    },
    {
      id: 'buyer-profile',
      label: 'Mi Perfil & KYC',
      description: 'Identidad y preferencias',
      icon: UserCheck,
      badge: 'Nivel 2'
    }
  ];

  const currentNav = currentRole === 'seller' ? sellerNav : buyerNav;

  return (
    <aside className="w-64 xl:w-72 flex-shrink-0 flex flex-col justify-between p-4 lg:p-6 bg-profundo/70 backdrop-blur-md border-r border-verdeSuave/10 min-h-[calc(100vh-65px)]">
      
      {/* Top Workspace Context */}
      <div className="space-y-6">
        
        {/* Workspace Profile Card */}
        <div className="p-3.5 rounded-xl bg-monte-dark/70 border border-verdeSuave/12 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-verdeSuave/20 flex-shrink-0 bg-monte">
            <img 
              src="/assets/logo_muurket.png" 
              alt="MUURKET" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-piedra">
                Entidad
              </span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-monte text-crema border border-verdeSuave/10">
                {currentRole === 'seller' ? 'Cabaña' : 'Inversor'}
              </span>
            </div>
            <p className="font-heading font-bold text-blanco text-xs truncate">
              {currentRole === 'seller' ? sellerData.cabanaName : investorData.userName}
            </p>
            <p className="text-[11px] text-piedra truncate">
              {currentRole === 'seller' ? sellerData.location : investorData.userRole}
            </p>
          </div>
        </div>

        {/* Navigation List */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-mono uppercase tracking-widest text-piedra font-semibold">
            {currentRole === 'seller' ? 'Gestión de Cabaña' : 'Inversión & RWA'}
          </p>
          {currentNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full group flex items-center justify-between p-2.5 rounded-lg transition-colors text-left ${
                  isActive
                    ? 'bg-monte text-blanco border border-verdeSuave/20 shadow-sm'
                    : 'text-piedra hover:bg-monte-dark/50 hover:text-blanco border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                    isActive 
                      ? 'bg-monte-dark text-esmeralda' 
                      : 'bg-monte-dark/40 text-piedra group-hover:text-blanco'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className={`text-xs font-heading font-semibold ${isActive ? 'text-blanco' : 'text-blanco/80'}`}>
                      {item.label}
                    </p>
                    <p className="text-[10px] text-piedra truncate">
                      {item.description}
                    </p>
                  </div>
                </div>

                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ml-1 whitespace-nowrap ${
                    isActive 
                      ? 'bg-esmeralda/20 text-esmeralda border border-esmeralda/30' 
                      : 'bg-monte-dark text-piedra border border-verdeSuave/5'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* Footer Info Box: Hedera HTS Standard */}
      <div className="mt-6 pt-4 border-t border-verdeSuave/10 space-y-3">
        <div className="p-3 rounded-xl bg-monte-dark/50 border border-verdeSuave/10">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-esmeralda" />
            <span className="text-xs font-heading font-bold text-blanco">Protocolo Hedera HTS</span>
          </div>
          <p className="text-[11px] text-piedra leading-relaxed">
            Activos fraccionados bajo estándar de tokens fungibles finitos con custodia genética certificada.
          </p>
          <a
            href="https://hashscan.io/testnet"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-esmeralda hover:underline font-mono"
          >
            <span>Explorador HashScan</span>
            <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>

        <div className="text-[10px] text-center text-piedra font-mono">
          MUURKET v1.0 · NEA Argentina
        </div>
      </div>

    </aside>
  );
}
