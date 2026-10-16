// Configuración server-side Supabase — único lector de SUPABASE_URL y claves.
// Patrón espejo de config/oracle.config.js: recibe `env` para ser testeable sin tocar process.env.
// Sin SDK, sin red, sin secretos embebidos: las claves viven solo en `.env` server-side.
// Esta spec solo usa el proyecto de test (envLabel "test", on-chain solo Testnet).

// URL válida Supabase: https obligatoria, nunca http ni texto libre.
function isValidSupabaseUrl(value) {
  return typeof value === "string" && /^https:\/\/[A-Za-z0-9.-]+\.supabase\.co\/?$/.test(value);
}

// Indica si una clave recibida cuenta como presente (no vacía).
function hasKey(value) {
  return typeof value === "string" && value.length > 0;
}

// Carga la configuración Supabase desde variables de entorno recibidas por parámetro.
function loadSupabaseConfig(env) {
  const source = env || {};
  const url = source.SUPABASE_URL;
  const anonKey = source.SUPABASE_ANON_KEY;
  const serviceRoleKey = source.SUPABASE_SERVICE_ROLE_KEY;

  // Sin URL o sin ninguna clave según rol → fallo explícito antes de tocar red.
  if (typeof url !== "string" || url === "" || (!hasKey(anonKey) && !hasKey(serviceRoleKey))) {
    throw new Error("credenciales Supabase ausentes (server-side .env)");
  }

  // URL presente pero sin https válido → fallo explícito antes de tocar red.
  if (!isValidSupabaseUrl(url)) {
    throw new Error("configuración inválida: SUPABASE_URL debe ser https de Supabase");
  }

  return {
    url,
    anonKey: hasKey(anonKey) ? anonKey : null,
    serviceRoleKey: hasKey(serviceRoleKey) ? serviceRoleKey : null,
    envLabel: "test",
  };
}

module.exports = { loadSupabaseConfig };
