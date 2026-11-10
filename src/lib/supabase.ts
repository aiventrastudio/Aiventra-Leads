import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
// Keep the public landing page available before local Supabase setup. Auth is
// gated by supabaseConfigured, so this placeholder is never used for requests.
export const supabase = createClient(
  supabaseUrl || 'https://missing-project.supabase.co',
  supabaseKey || 'missing-publishable-key',
);
