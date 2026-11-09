import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigurationError =
  !supabaseUrl || !supabaseAnonKey
    ? "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file to enable Google sign-in."
    : null;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          persistSession: true,
        },
      })
    : null;
