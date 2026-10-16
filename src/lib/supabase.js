import { createClient } from "@supabase/supabase-js";

// Cliente Supabase compartido para el frontend.
// Lee credenciales de .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
