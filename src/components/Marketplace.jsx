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
  onSelectBull 
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
      <div className="relative rounded-xl overflow-hidden border border-verdeSuave/15 shadow-elevated">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('/assets/estancia_landscape.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-profundo-dark/95 via-profundo/90 to-profundo/75" />

        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-monte-dark text-piedra-light font-mono text-[10px] uppercase border border-verdeSuave/10">
                Mercado Primario RWA Ganadero
              </span>
              <span className="text-xs text-piedra">· Red Hedera Hashgraph</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-blanco tracking-tight">
              Inversión en Genética Bovina de Élite
            </h1>
            <p className="text-xs md:text-sm text-piedra leading-relaxed">
              Adquiere fracciones tokenizadas de Toros Líderes Braford y Brangus probados en el NEA argentino. Participa de los dividendos periódicos en USDC derivados de la venta física de dosis seminales.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-piedra">
              <span className="flex items-center gap-1.5 text-crema">
                <CheckCircle2 className="w-3.5 h-3.5 text-esmeralda" />
                <span>Rendimientos anuales proyectados según remates</span>
              </span>
              <span className="text-verdeSuave/20">|</span>
              <span className="flex items-center gap-1.5 text-piedra font-mono text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-esmeralda" />
                <span>Oráculo Biológico Oficial PEGBraf</span>
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl muurket-solid border border-verdeSuave/15 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-mono uppercase tracking-wider text-piedra">
              Volumen Total en Custodia
            </span>
            <span className="text-2xl md:text-3xl font-heading font-bold text-blanco font-mono mt-0.5">
              $189,000 <span className="text-xs text-piedra font-sans font-normal">USDC</span>
            </span>
            <span className="text-[11px] text-crema mt-1">
              +4,130 Pajuelas físicas colocadas
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="muurket-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-piedra absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por toro, raza o cabaña..."
            className="w-full pl-9 pr-4 py-1.5 muurket-input text-xs"
          />
        </div>

        {/* Breed Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'all', label: 'Todos los Reproductores' },
            { id: 'braford', label: 'Braford' },
            { id: 'brangus', label: 'Brangus' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedBreed(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-heading font-medium whitespace-nowrap transition-colors ${
                selectedBreed === tab.id
                  ? 'bg-monte text-blanco border border-verdeSuave/20'
                  : 'bg-monte-dark/50 text-piedra hover:text-blanco'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* APY Filter */}
        <div className="flex items-center gap-2 text-xs text-piedra w-full md:w-auto justify-end">
          <SlidersHorizontal className="w-3.5 h-3.5 text-crema" />
          <span className="text-[11px]">Rendimiento:</span>
          <select
            value={minAPY}
            onChange={(e) => setMinAPY(Number(e.target.value))}
            className="px-2.5 py-1 rounded bg-monte-dark border border-verdeSuave/15 text-crema text-xs focus:border-esmeralda focus:outline-none"
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
              className="muurket-card overflow-hidden muurket-card-hover flex flex-col justify-between group"
            >
              <div>
                
                {/* Photo Header */}
                <div className="relative h-52 overflow-hidden">
                  <img 
                    src={bull.image} 
                    alt={bull.name} 
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-profundo-dark via-profundo-dark/30 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-profundo/90 backdrop-blur-sm text-[10px] font-mono text-crema border border-verdeSuave/15">
                      {bull.breed}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-profundo/90 backdrop-blur-sm text-[10px] font-mono text-piedra border border-verdeSuave/10">
                      {bull.symbol}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3">
                    <div className="px-2.5 py-0.5 rounded bg-monte text-esmeralda text-[11px] font-mono font-bold border border-verdeSuave/20">
                      ~{bull.estimatedAPY}% APY Est.
                    </div>
                  </div>

                  <div className="absolute bottom-2.5 left-4 right-4">
                    <div className="text-[11px] text-crema font-medium">
                      {bull.cabana}
                    </div>
                    <h3 className="text-base font-heading font-extrabold text-blanco truncate">
                      {bull.name}
                    </h3>
                  </div>
                </div>

                {/* Card Content & Metrics */}
                <div className="p-4 space-y-3.5">
                  
                  {/* Price & Valuation */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-verdeSuave/10">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-piedra block">
                        Precio por Fracción
                      </span>
                      <div className="text-lg font-heading font-bold text-blanco font-mono">
                        ${bull.pricePerTokenUSDC.toFixed(2)} <span className="text-xs text-piedra font-sans font-normal">USDC</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono uppercase text-piedra block">
                        Tasación Oficial
                      </span>
                      <div className="text-xs font-mono font-medium text-crema">
                        ${bull.valuationUSD.toLocaleString()} USD
                      </div>
                    </div>
                  </div>

                  {/* Funding Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-piedra">Avance de Financiación</span>
                      <span className="font-mono text-blanco font-semibold">{fundedPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-profundo-dark overflow-hidden">
                      <div 
                        className="h-full bg-esmeralda rounded-full transition-all duration-500"
                        style={{ width: `${fundedPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-piedra font-mono pt-0.5">
                      <span>${totalRaised.toLocaleString()} USDC colocados</span>
                      <span>{tokensRemaining} disponibles</span>
                    </div>
                  </div>

                  {/* Genetic Highlights */}
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono pt-1">
                    <div className="p-1.5 rounded bg-monte-dark/60">
                      <span className="text-piedra block">DEP PN</span>
                      <span className="font-bold text-crema">{bull.biometrics.peso_nacer_kg} kg</span>
                    </div>
                    <div className="p-1.5 rounded bg-monte-dark/60">
                      <span className="text-piedra block">AOB Carcasa</span>
                      <span className="font-bold text-crema">+{bull.biometrics.area_ojo_bife_cm2} cm²</span>
                    </div>
                    <div className="p-1.5 rounded bg-monte-dark/60">
                      <span className="text-piedra block">Motilidad</span>
                      <span className="font-bold text-esmeralda">{bull.biometrics.motilidad_seminal_pct}%</span>
                    </div>
                  </div>

                </div>

              </div>

              {/* Action Button */}
              <div className="p-4 pt-0">
                <button
                  onClick={() => onSelectBull(bull)}
                  className="w-full py-2.5 px-3 rounded-lg bg-monte hover:bg-monte-light text-blanco font-heading font-semibold text-xs tracking-wide flex items-center justify-center gap-1.5 border border-verdeSuave/15 transition-colors"
                >
                  <span>Ver Ficha Biológica e Invertir</span>
                  <ChevronRight className="w-3.5 h-3.5 text-esmeralda" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
