import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://vrjjbltyostoujdvonil.supabase.co";

const key =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyampibHR5b3N0b3VqZHZvbmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjk2NzcsImV4cCI6MjA5MjYwNTY3N30.5lmuQtoET-DkZb2tcgpV8wdavsL96S5QS0rHUe4zJB8";

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
