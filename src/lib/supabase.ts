import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ SUPABASE CONFIG MISSING: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.\n' +
    '   → For local dev: add them to .env.local\n' +
    '   → For Vercel: add them in Project → Settings → Environment Variables'
  );
}

export const supabase = createClient(
  supabaseUrl!,
  supabaseAnonKey!
);
