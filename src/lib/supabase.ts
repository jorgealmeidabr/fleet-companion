import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient<Database>(
  url ?? "https://placeholder.supabase.co",
  key ?? "placeholder-anon-key",
  { auth: { persistSession: true, autoRefreshToken: true } }
);
