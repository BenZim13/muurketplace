-- =============================================================================
-- Muurketplace — Migración espejo off-chain (Supabase) — Spec 004
-- Archivo: supabase/migrations/20261016061300_muurketplace_mirror.sql
-- =============================================================================
--
-- QUÉ ES ESTO
--   Espejo off-chain del ecosistema ganadero tokenizado en Hedera. La cadena
--   (Hedera Testnet: HTS/HCS/HSCS) es la ÚNICA FUENTE DE VERDAD; estas 5 tablas
--   solo "recuerdan" de forma idempotente lo que ya ocurrió on-chain. El espejo
--   nunca inventa datos ni certifica por sí mismo (spec 004, RF-01 a RF-08).
--
-- PROYECTO
--   Solo proyecto de TEST (envLabel: "test", on-chain solo Testnet). Un futuro
--   proyecto de producción sería un proyecto aparte con estas mismas 5 tablas.
--   Nunca se mezclan claves entre entornos. Sin Mainnet.
--
-- SEGURIDAD (constitution §4 + plan T-03/T-04)
--   - RLS activado en las 5 tablas.
--   - LECTURA pública (SELECT) permitida al rol `anon` (RF-07): consultas
--     verificables sin credenciales de operador.
--   - ESCRITURA cerrada (RF-08): se REVOCAN INSERT/UPDATE/DELETE a `anon` y a
--     `authenticated`. Solo el rol `service_role` server-side escribe (bypassa
--     RLS). NO existe ninguna política de escritura a propósito.
--   - Las claves (anon/service_role) viven solo server-side en `.env`, nunca en
--     cliente/frontend/logs/tests.
--
-- CÓMO APLICAR
--   1) Supabase Dashboard → SQL Editor → pegar este archivo completo y Run.
--   2) O bien: `supabase db push` (la migración es compatible con la CLI).
--   La migración es IDEMPOTENTE: puede re-ejecutarse sin errores.
-- =============================================================================

begin;

-- =============================================================================
-- 1) TABLAS (public, 5 tablas). Columnas en snake_case, alineadas 1:1 con lo
--    que envían los repos de `src/db/*.js`.
-- =============================================================================

-- 1.1 bulls — toros espejo (RF-01). Un registro por bull_id.
create table if not exists public.bulls (
  bull_id          text primary key,
  inputs           jsonb not null,
  apto             boolean not null,
  motivos          jsonb not null default '[]'::jsonb,
  m_total          numeric not null,
  price_bull_usd   numeric(12,2) not null,
  price_dose_usd   numeric(12,2) not null,
  created_at       timestamptz not null default now()
);

-- 1.2 valuations — valuaciones espejo idempotentes por valuation_key (RF-02).
create table if not exists public.valuations (
  valuation_key    text primary key,
  bull_id          text not null references public.bulls(bull_id),
  spec_version     text not null default '001',
  m_total          numeric not null,
  price_bull_usd   numeric(12,2) not null,
  price_dose_usd   numeric(12,2) not null,
  canonical_json   jsonb not null,
  created_at       timestamptz not null default now()
);

-- 1.3 proofs — proofs HCS espejo por valuation_key (RF-03/RF-04). El estado
--     solo lo promueve el verificador (PENDING → VERIFIED|MISMATCH).
create table if not exists public.proofs (
  valuation_key       text primary key references public.valuations(valuation_key),
  topic_id            text not null,
  sequence_number     bigint,
  consensus_timestamp text,
  transaction_id      text not null,
  status              text not null check (status in ('VERIFIED','MISMATCH','PENDING')),
  verified_ref        text,
  updated_at          timestamptz not null default now()
);

-- 1.4 listings — listados de marketplace espejo por listing_id (RF-05/RF-06).
create table if not exists public.listings (
  listing_id       text primary key,
  valuation_key    text not null references public.valuations(valuation_key),
  asset_type       text,
  unit_price_usd   numeric(12,2) not null,
  quantity         numeric(14,4) not null,
  royalty_pct      numeric(5,2),
  tx_id            text,
  hashscan_url     text,
  created_at       timestamptz not null default now()
);

-- 1.5 purchases — compras/liquidaciones espejo por purchase_id (RF-05/RF-06/RF-08).
create table if not exists public.purchases (
  purchase_id      text primary key,
  listing_id       text not null references public.listings(listing_id),
  valuation_key    text not null references public.valuations(valuation_key),
  asset_type       text,
  unit_price_usd   numeric(12,2) not null,
  quantity         numeric(14,4) not null,
  royalty_pct      numeric(5,2) not null,
  royalty_usd      numeric(12,2) not null,
  seller_usd       numeric(12,2) not null,
  total_usd        numeric(12,2) not null,
  purchase_tx_id   text,
  settlement_tx_id text,
  settled          boolean not null default false,
  hashscan_url     text,
  created_at       timestamptz not null default now()
);

-- =============================================================================
-- 2) ÍNDICES — aceleran las lecturas públicas (RF-07).
-- =============================================================================
create index if not exists valuations_bull_id_idx
  on public.valuations (bull_id);

create index if not exists proofs_status_idx
  on public.proofs (status);

create index if not exists listings_valuation_key_idx
  on public.listings (valuation_key);

create index if not exists purchases_listing_id_settled_idx
  on public.purchases (listing_id, settled);

-- =============================================================================
-- 3) TRIGGER — refresca proofs.updated_at en cada UPDATE, de modo que el upsert
--    que promueve PENDING → VERIFIED|MISMATCH deje la marca de tiempo al día.
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists proofs_set_updated_at on public.proofs;

create trigger proofs_set_updated_at
  before update on public.proofs
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- 4) RLS — lectura pública (anon) y escritura cerrada (solo service_role).
--    Activa RLS en las 5 tablas.
-- =============================================================================
alter table public.bulls      enable row level security;
alter table public.valuations enable row level security;
alter table public.proofs     enable row level security;
alter table public.listings   enable row level security;
alter table public.purchases  enable row level security;

-- 4.1 bulls: SELECT público anon; sin escritura para anon/authenticated.
drop policy if exists bulls_anon_select on public.bulls;
create policy bulls_anon_select on public.bulls
  for select to anon using (true);
revoke insert, update, delete on public.bulls from anon, authenticated;
grant select on public.bulls to anon;

-- 4.2 valuations: SELECT público anon; sin escritura para anon/authenticated.
drop policy if exists valuations_anon_select on public.valuations;
create policy valuations_anon_select on public.valuations
  for select to anon using (true);
revoke insert, update, delete on public.valuations from anon, authenticated;
grant select on public.valuations to anon;

-- 4.3 proofs: SELECT público anon; sin escritura para anon/authenticated.
drop policy if exists proofs_anon_select on public.proofs;
create policy proofs_anon_select on public.proofs
  for select to anon using (true);
revoke insert, update, delete on public.proofs from anon, authenticated;
grant select on public.proofs to anon;

-- 4.4 listings: SELECT público anon; sin escritura para anon/authenticated.
drop policy if exists listings_anon_select on public.listings;
create policy listings_anon_select on public.listings
  for select to anon using (true);
revoke insert, update, delete on public.listings from anon, authenticated;
grant select on public.listings to anon;

-- 4.5 purchases: SELECT público anon; sin escritura para anon/authenticated.
drop policy if exists purchases_anon_select on public.purchases;
create policy purchases_anon_select on public.purchases
  for select to anon using (true);
revoke insert, update, delete on public.purchases from anon, authenticated;
grant select on public.purchases to anon;

commit;
