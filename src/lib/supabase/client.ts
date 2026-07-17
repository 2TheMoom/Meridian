import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Every caller must share this one instance. GoTrue keeps its session in
// memory and syncs to localStorage on its own lifecycle — two independent
// clients each think they own the truth, so one can hand out a stale
// access token while the other has already moved on to a freshly signed-in
// session. That's what "Multiple GoTrueClient instances detected" is
// warning about, and it's not benign: it's what caused registration to be
// rejected with a stale/mismatched session even right after signing in.
let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
