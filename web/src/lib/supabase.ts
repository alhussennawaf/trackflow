import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});

// Turns a Supabase / PostgREST error into a sentence for the person using the app.
export function errorText(e: unknown): string {
  if (!e) return 'Something went wrong.';
  const m = typeof e === 'string' ? e : (e as { message?: string }).message ?? String(e);
  if (/row-level security|permission denied|not allowed/i.test(m)) return 'You don’t have permission to do that.';
  if (/JWT expired|invalid JWT/i.test(m)) return 'Your session has expired. Please sign in again.';
  if (/duplicate key/i.test(m)) return 'That code or name is already in use.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Can’t reach the server. Check your connection and try again.';
  return m;
}

// Throws the error from a Supabase response, otherwise returns its data.
export function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}
