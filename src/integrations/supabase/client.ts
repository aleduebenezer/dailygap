// Supabase client integration
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Extract and normalize Supabase URL
const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://hzfjbevytkwicyioiuqm.supabase.co';

const rawKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_AN ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZmpiZXZ5dGt3aWN5aW9pdXFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTA1ODcsImV4cCI6MjEwMzIyNjU4N30.0q8YHtv5kRNfXdn91g3WOCZvFGbqXwrPARXr2gmCc5k';

// Normalize URL: Remove trailing slashes and /rest/v1 suffix so auth, rest, and edge functions resolve correctly
const cleanUrl = (url: string): string => {
  let u = url.trim();
  if (u.endsWith('/')) {
    u = u.slice(0, -1);
  }
  if (u.endsWith('/rest/v1')) {
    u = u.slice(0, -8);
  }
  return u;
};

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  !rawUrl.includes("placeholder") &&
  !rawKey.includes("placeholder")
);

const SUPABASE_URL = cleanUrl(rawUrl);
const SUPABASE_PUBLISHABLE_KEY = rawKey.trim();

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
