import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://sqaazuqkagskafptaion.supabase.co';
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_updB4Vik6V9NUUqZdVw2Iw_qR1dw_Cc';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
});

export function emailRedirectTo(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
