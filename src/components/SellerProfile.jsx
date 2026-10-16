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
      <div className="relative rounded-2xl overflow-hidden border border-crema-border shadow-elevated bg-white">
        <div 
          className="h-44 md:h-56 bg-cover bg-center"
          style={{ backgroundImage: `url('/assets/estancia_landscape.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tinta/80 via-tinta/30 to-transparent" />

        <div className="relative z-10 px-6 pb-6 pt-0 -mt-14 md:-mt-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-4">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-white border-2 border-white overflow-hidden shadow-elevated flex-shrink-0 relative">
              <img 
                src="/assets/braford_palermo.jpg" 
                alt="Logo Cabaña" 
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h1 className="text-2xl font-heading font-extrabold text-white drop-shadow">
                  {sellerData.cabanaName}
                </h1>
                <span className="px-2 py-0.5 rounded bg-monte text-white font-mono text-[10px] border border-white/20 font-semibold">
                  Cabaña Certificada
                </span>
              </div>
              <p className="text-xs text-white/90 flex items-center justify-center md:justify-start gap-1.5 drop-shadow">
                <MapPin className="w-3.5 h-3.5 text-crema" />
                <span>{sellerData.location}</span>
                <span className="text-white/40">·</span>
                <Calendar className="w-3.5 h-3.5 text-crema" />
                <span>Fundada en {sellerData.established}</span>
              </p>
              <p className="text-xs text-white/90 drop-shadow">
                Director Técnico: <strong className="text-white font-semibold">{sellerData.director}</strong>
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setActiveView('seller-pricing')}
              className="px-4 py-2 rounded-lg btn-action-leather text-xs font-heading font-bold shadow-sm"
            >
              Tasar Reproductor
            </button>
            <a
              href="https://braford.org.ar"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-lg bg-white/95 hover:bg-white border border-white/30 text-tinta text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span>Asociación Braford</span>
              <ExternalLink className="w-3.5 h-3.5 text-tinta-muted" />
            </a>
          </div>
        </div>
      </div>

      {/* Verification Badges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sellerData.verificationBadges.map((badge, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-crema-border p-4 shadow-card space-y-2">
            <div className="w-8 h-8 rounded-lg bg-salvia-light text-esmeralda border border-salvia/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="font-heading font-bold text-tinta text-xs">
              {badge.title}
            </p>
            <p className="text-[11px] text-tinta-muted leading-relaxed">
              {badge.subtitle}
            </p>
          </div>
        ))}
      </div>

      {/* Overview & Trophies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-crema-border p-6 shadow-card space-y-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-crema-border">
            <Building2 className="w-4 h-4 text-monte" />
            <h3 className="text-sm font-heading font-bold text-tinta">Trayectoria y Selección Genética</h3>
          </div>

          <p className="text-xs text-tinta-muted leading-relaxed">
            Con base en Mercedes (Corrientes), <strong className="text-tinta">Cabaña Los Guaraníes</strong> lidera la cría selectiva de reproductores Braford con rigurosa adaptación fenotípica a las condiciones de calor, garrapata y pastizales subtropicales del NEA.
          </p>

          <p className="text-xs text-tinta-muted leading-relaxed">
            Cada espécimen incorporado al ecosistema <strong className="text-monte">MUURKET</strong> cuenta con sumarios oficiales PEGBraf, registro en la Sociedad Rural Argentina y tokenización auditable en Hedera Hashgraph.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-crema-surface border border-crema-border">
              <p className="text-tinta-muted text-[11px]">Centro de Inseminación Habilitado</p>
              <p className="font-semibold text-tinta text-xs mt-0.5">Criobiología Litoral NEA</p>
              <p className="text-[10px] text-tinta-muted font-mono">SENASA #BA-912</p>
            </div>
            <div className="p-3 rounded-lg bg-crema-surface border border-crema-border">
              <p className="text-tinta-muted text-[11px]">Banco de Germoplasma</p>
              <p className="font-semibold text-tinta text-xs mt-0.5">+45,000 Dosis Históricas</p>
              <p className="text-[10px] text-esmeralda font-mono font-semibold">99.2% Fertilidad Evaluada</p>
            </div>
          </div>
        </div>

        {/* Right Column: Palmarés (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-crema-border p-6 shadow-card space-y-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-crema-border">
            <Trophy className="w-4 h-4 text-cuero" />
            <h3 className="text-sm font-heading font-bold text-tinta">Palmarés en Exposiciones</h3>
          </div>

          <div className="space-y-2.5">
            <div className="p-2.5 rounded-lg bg-crema-surface border border-crema-border flex items-start gap-2.5">
              <span className="text-base">🥇</span>
              <div className="text-xs">
                <p className="font-bold text-tinta">Gran Campeón Macho Palermo 2024</p>
                <p className="text-tinta-muted text-[11px]">Exposición Rural de Palermo (Don Luis)</p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-crema-surface border border-crema-border flex items-start gap-2.5">
              <span className="text-base">🏆</span>
              <div className="text-xs">
                <p className="font-bold text-tinta">Campeón Nacional Ternero 2023</p>
                <p className="text-tinta-muted text-[11px]">Exposición Nacional de Corrientes</p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-crema-surface border border-crema-border flex items-start gap-2.5">
              <span className="text-base">🏅</span>
              <div className="text-xs">
                <p className="font-bold text-tinta">Mérito Genético PEGBraf 2025</p>
                <p className="text-tinta-muted text-[11px]">Top 1% Área de Ojo de Bife</p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
