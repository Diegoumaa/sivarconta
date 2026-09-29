/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const meta = import.meta as any;
const supabaseUrl = (meta.env?.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (meta.env?.VITE_SUPABASE_ANON_KEY as string) || '';

// Validates whether the Supabase project credentials have been configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('tu-proyecto')
);

// Singleton Supabase Client
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;
