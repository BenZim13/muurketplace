import React, { useState } from 'react';
import { 
  Search, 
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';

export default function Marketplace({ 
  bulls, 
  onSelectBull,
  userRole = 'buyer'
}) {
  const [selectedBreed, setSelectedBreed] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minAPY, setMinAPY] = useState(0);

  const filteredBulls = bulls.filter((bull) => {
    const matchesBreed = selectedBreed === 'all' || bull.breed.toLowerCase() === selectedBreed.toLowerCase();
    const matchesSearch = bull.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          bull.cabana.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          bull.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAPY = bull.estimatedAPY >= minAPY;
    return matchesBreed && matchesSearch && matchesAPY;
  });

  return (
    <div className="space-y-6">
      
      {/* Hero Editorial Header */}
      <div className="relative rounded-xl overflow-hidden border border-crema-border shadow-elevated">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('/assets/estancia_landscape.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-monte-dark/95 via-monte/85 to-monte/65 backdrop-blur-[1px]" />

        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono text-[10px] uppercase font-bold tracking-wider border border-white/20">
                Mercado Primario RWA Ganadero
              </span>
              <span className="text-xs text-white/80 font-medium">· Red Hedera Hashgraph</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-white tracking-tight">
              Inversión en Genética Bovina de Élite
            </h1>
            <p className="text-xs md:text-sm text-white/90 leading-relaxed font-normal">
              Adquiere fracciones tokenizadas de Toros Líderes Braford y Brangus probados en el NEA argentino. Participa de los dividendos periódicos en USDC derivados de la venta física de dosis seminales.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-white/90">
              <span className="flex items-center gap-1.5 text-white font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-esmeralda-light" />
                <span>Rendimientos anuales proyectados según remates</span>
              </span>
              <span className="text-white/30">|</span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-white/80">
                <ShieldCheck className="w-3.5 h-3.5 text-esmeralda-light" />
                <span>Oráculo Biológico Oficial PEGBraf</span>
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/15 border border-white/25 backdrop-blur-md flex flex-col items-center justify-center text-center shadow-sm">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/80 font-medium">
              Volumen Total en Custodia
            </span>
            <span className="text-2xl md:text-3xl font-heading font-extrabold text-white font-mono mt-0.5">
              $189,000 <span className="text-xs text-white/80 font-sans font-normal">USDC</span>
            </span>
            <span className="text-[11px] text-white/90 font-medium mt-1">
              +4,130 Pajuelas físicas colocadas
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="muurket-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-crema-border">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-tinta-muted absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por toro, raza o cabaña..."
            className="w-full pl-9 pr-4 py-2 muurket-input text-xs bg-crema-canvas border-crema-border"
          />
        </div>

        {/* Breed Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-crema-surface rounded-lg border border-crema-border">
          {[
            { id: 'all', label: 'Todos los Reproductores' },
            { id: 'braford', label: 'Braford' },
            { id: 'brangus', label: 'Brangus' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedBreed(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold whitespace-nowrap transition-all ${
                selectedBreed === tab.id
                  ? 'bg-monte text-white shadow-sm'
                  : 'text-tinta-muted hover:text-tinta'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* APY Filter */}
        <div className="flex items-center gap-2 text-xs text-tinta-muted w-full md:w-auto justify-end">
          <SlidersHorizontal className="w-3.5 h-3.5 text-cuero" />
          <span className="text-[11px] font-medium">Rendimiento:</span>
          <select
            value={minAPY}
            onChange={(e) => setMinAPY(Number(e.target.value))}
            className="px-2.5 py-1.5 rounded-lg bg-crema-surface border border-crema-border text-tinta font-semibold text-xs focus:border-monte focus:outline-none"
          >
            <option value={0}>Todos los APY</option>
            <option value={25}>&gt; 25% APY</option>
            <option value={30}>&gt; 30% APY</option>
          </select>
        </div>

      </div>

      {/* Bulls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBulls.map((bull) => {
          const fundedPercent = Math.min(100, Math.round((bull.tokensSold / bull.totalTokens) * 100));
          const totalRaised = bull.tokensSold * bull.pricePerTokenUSDC;
          const tokensRemaining = bull.totalTokens - bull.tokensSold;

          return (
            <div 
              key={bull.id}
              className="muurket-card bg-white border border-crema-border overflow-hidden muurket-card-hover flex flex-col justify-between group shadow-sm"
            >
              <div>
                
                {/* Photo Header */}
                <div className="relative h-52 overflow-hidden">
                  <img 
                    src={bull.image} 
                    alt={bull.name} 
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-tinta/90 via-tinta/30 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-white/95 text-[10px] font-mono text-tinta font-bold shadow-sm">
                      {bull.breed}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/80 text-[10px] font-mono text-tinta-muted font-medium backdrop-blur-sm">
                      {bull.symbol}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3">
                    <div className="px-2.5 py-0.5 rounded-md bg-monte text-white text-[11px] font-mono font-bold shadow-sm">
                      ~{bull.estimatedAPY}% APY Est.
                    </div>
                  </div>

                  <div className="absolute bottom-2.5 left-4 right-4">
                    <div className="text-[11px] text-white/80 font-medium">
                      {bull.cabana}
                    </div>
                    <h3 className="text-base font-heading font-extrabold text-white truncate">
                      {bull.name}
                    </h3>
                  </div>
                </div>

                {/* Card Content & Metrics */}
                <div className="p-4 space-y-3.5 bg-white">
                  
                  {/* Price & Valuation */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-crema-border">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-tinta-muted font-medium block">
                        Precio por Fracción
                      </span>
                      <div className="text-lg font-heading font-extrabold text-tinta font-mono">
                        ${bull.pricePerTokenUSDC.toFixed(2)} <span className="text-xs text-tinta-muted font-sans font-normal">USDC</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono uppercase text-tinta-muted font-medium block">
                        Tasación Oficial
                      </span>
                      <div className="text-xs font-mono font-bold text-cuero">
                        ${bull.valuationUSD.toLocaleString()} USD
                      </div>
                    </div>
                  </div>

                  {/* Funding Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-tinta-muted font-medium">Avance de Financiación</span>
                      <span className="font-mono text-tinta font-bold">{fundedPercent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-crema-surface border border-crema-border/60 overflow-hidden">
                      <div 
                        className="h-full bg-monte rounded-full transition-all duration-500"
                        style={{ width: `${fundedPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-tinta-muted font-mono pt-0.5">
                      <span className="font-semibold text-tinta">${totalRaised.toLocaleString()} USDC colocados</span>
                      <span>{tokensRemaining} disponibles</span>
                    </div>
                  </div>

                  {/* Genetic Highlights */}
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono pt-1">
                    <div className="p-1.5 rounded-lg bg-crema-surface border border-crema-border/70">
                      <span className="text-tinta-muted block">DEP PN</span>
                      <span className="font-bold text-tinta">{bull.biometrics.peso_nacer_kg} kg</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-crema-surface border border-crema-border/70">
                      <span className="text-tinta-muted block">AOB Carcasa</span>
                      <span className="font-bold text-tinta">+{bull.biometrics.area_ojo_bife_cm2} cm²</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-salvia-light border border-salvia-border">
                      <span className="text-salvia block font-medium">Motilidad</span>
                      <span className="font-bold text-salvia">{bull.biometrics.motilidad_seminal_pct}%</span>
                    </div>
                  </div>

                </div>

              </div>

              {/* Action Button */}
              <div className="p-4 pt-0 bg-white">
                <button
                  onClick={() => onSelectBull(bull)}
                  className="w-full py-2.5 px-3 rounded-lg btn-action-primary font-heading font-semibold text-xs tracking-wide flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <span>{userRole === 'seller' ? 'Ver Ficha Biológica y Auditoría' : 'Ver Ficha Biológica e Invertir'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
