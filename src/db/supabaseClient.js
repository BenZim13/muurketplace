// Cliente Supabase server-side — único punto con @supabase/supabase-js (T5 spec 004).
// Factory testeable: recibe { url, key } y acepta SDK inyectado (deps.supabaseJs)
// para tests con mock sin red. Valida credenciales antes de tocar red.
// La clave service_role solo vive server-side en `.env`, nunca en cliente/frontend.
"use strict";

const { loadSupabaseConfig } = require("../../config/supabase.config.js");

// Crea el cliente Supabase server-side con la clave del rol que corresponda
// (service_role para escritura, anon para lectura pública). Lanza sin
// URL/clave antes de tocar red. Nunca lee secretos del repo por sí mismo.
function createSupabaseClient({ url, key } = {}, deps = {}) {
  const cfg = loadSupabaseConfig({
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: key,
    SUPABASE_SERVICE_ROLE_KEY: key,
  });
  // Lazy require: el SDK solo se carga con credenciales válidas y nunca en logic.
  const sdk = deps.supabaseJs || require("@supabase/supabase-js");
  return sdk.createClient(cfg.url, key);
}

module.exports = { createSupabaseClient };
