import React from 'react';
import { 
  Award, 
  ShieldCheck, 
  MapPin, 
  Calendar, 
  ExternalLink, 
  Building2,
  Trophy
} from 'lucide-react';

export default function SellerProfile({ sellerData, setActiveView }) {
  return (
    <div className="space-y-6">
      
      {/* Estancia Ranch Header Profile Card */}
      <div className="relative rounded-xl overflow-hidden border border-verdeSuave/15 shadow-elevated">
        <div 
          className="h-44 md:h-56 bg-cover bg-center"
          style={{ backgroundImage: `url('/assets/estancia_landscape.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-profundo-dark via-profundo-dark/80 to-transparent" />

        <div className="relative z-10 px-6 pb-6 pt-0 -mt-14 md:-mt-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-4">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-profundo border-2 border-verdeSuave/20 overflow-hidden shadow-card flex-shrink-0 relative">
              <img 
                src="/assets/braford_palermo.jpg" 
                alt="Logo Cabaña" 
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h1 className="text-2xl font-heading font-extrabold text-blanco">
                  {sellerData.cabanaName}
                </h1>
                <span className="px-2 py-0.5 rounded bg-monte-dark text-crema font-mono text-[10px] border border-verdeSuave/15">
                  Cabaña Certificada
                </span>
              </div>
              <p className="text-xs text-piedra flex items-center justify-center md:justify-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-crema" />
                <span>{sellerData.location}</span>
                <span className="text-verdeSuave/20">·</span>
                <Calendar className="w-3.5 h-3.5 text-crema" />
                <span>Fundada en {sellerData.established}</span>
              </p>
              <p className="text-xs text-piedra">
                Director Técnico: <strong className="text-blanco font-medium">{sellerData.director}</strong>
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setActiveView('seller-pricing')}
              className="px-3.5 py-2 rounded-lg btn-action-primary text-xs font-heading font-bold"
            >
              Tasar Reproductor
            </button>
            <a
              href="https://braford.org.ar"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-lg bg-monte hover:bg-monte-light border border-verdeSuave/15 text-crema text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <span>Asociación Braford</span>
              <ExternalLink className="w-3.5 h-3.5 text-piedra" />
            </a>
          </div>
        </div>
      </div>

      {/* Verification Badges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sellerData.verificationBadges.map((badge, idx) => (
          <div key={idx} className="muurket-card p-4 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-monte text-esmeralda flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="font-heading font-bold text-blanco text-xs">
              {badge.title}
            </p>
            <p className="text-[11px] text-piedra leading-relaxed">
              {badge.subtitle}
            </p>
          </div>
        ))}
      </div>

      {/* Overview & Trophies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 muurket-card p-6 space-y-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-verdeSuave/10">
            <Building2 className="w-4 h-4 text-crema" />
            <h3 className="text-sm font-heading font-bold text-blanco">Trayectoria y Selección Genética</h3>
          </div>

          <p className="text-xs text-piedra leading-relaxed">
            Con base en Mercedes (Corrientes), <strong>Cabaña Los Guaraníes</strong> lidera la cría selectiva de reproductores Braford con rigurosa adaptación fenotípica a las condiciones de calor, garrapata y pastizales subtropicales del NEA.
          </p>

          <p className="text-xs text-piedra leading-relaxed">
            Cada espécimen incorporado al ecosistema <strong>MUURKET</strong> cuenta con sumarios oficiales PEGBraf, registro en la Sociedad Rural Argentina y tokenización auditable en Hedera Hashgraph.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-monte-dark/60 border border-verdeSuave/10">
              <p className="text-piedra text-[11px]">Centro de Inseminación Habilitado</p>
              <p className="font-semibold text-blanco text-xs mt-0.5">Criobiología Litoral NEA</p>
              <p className="text-[10px] text-piedra font-mono">SENASA #BA-912</p>
            </div>
            <div className="p-3 rounded-lg bg-monte-dark/60 border border-verdeSuave/10">
              <p className="text-piedra text-[11px]">Banco de Germoplasma</p>
              <p className="font-semibold text-blanco text-xs mt-0.5">+45,000 Dosis Históricas</p>
              <p className="text-[10px] text-esmeralda font-mono">99.2% Fertilidad Evaluada</p>
            </div>
          </div>
        </div>

        {/* Right Column: Palmarés (5 cols) */}
        <div className="lg:col-span-5 muurket-card p-6 space-y-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-verdeSuave/10">
            <Trophy className="w-4 h-4 text-cuero" />
            <h3 className="text-sm font-heading font-bold text-blanco">Palmarés en Exposiciones</h3>
          </div>

          <div className="space-y-2.5">
            <div className="p-2.5 rounded-lg bg-monte-dark/60 border border-verdeSuave/10 flex items-start gap-2.5">
              <span className="text-base">🥇</span>
              <div className="text-xs">
                <p className="font-bold text-blanco">Gran Campeón Macho Palermo 2024</p>
                <p className="text-piedra text-[11px]">Exposición Rural de Palermo (Don Luis)</p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-monte-dark/60 border border-verdeSuave/10 flex items-start gap-2.5">
              <span className="text-base">🏆</span>
              <div className="text-xs">
                <p className="font-bold text-blanco">Campeón Nacional Ternero 2023</p>
                <p className="text-piedra text-[11px]">Exposición Nacional de Corrientes</p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-monte-dark/60 border border-verdeSuave/10 flex items-start gap-2.5">
              <span className="text-base">🏅</span>
              <div className="text-xs">
                <p className="font-bold text-blanco">Mérito Genético PEGBraf 2025</p>
                <p className="text-piedra text-[11px]">Top 1% Área de Ojo de Bife</p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
