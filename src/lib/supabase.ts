/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// A checkout without explicit configuration is an isolated local demo.
// Never silently connect a developer's browser or tests to a shared database.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validates whether the Supabase project credentials have been configured
export const isSupabaseConfigured = (() => {
  try {
    const url = new URL(supabaseUrl);
    return Boolean(supabaseAnonKey && url.protocol === 'https:' && url.hostname && !url.hostname.includes('tu-proyecto'));
  } catch {
    return false;
  }
})();

// Singleton Supabase Client
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;
