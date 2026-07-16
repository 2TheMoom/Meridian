import { createClient } from "@supabase/supabase-js";

/**
 * Scoped to the calling user's JWT so Postgres RLS policies apply.
 * Use in API routes that act on behalf of a signed-in user.
 */
export function createUserScopedSupabaseClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  );
}

/**
 * Bypasses RLS. Only for the Horizon worker and secret-header cron routes
 * (POST /api/horizon/sweep) — never expose this client to user-facing code paths.
 */
export function createServiceRoleSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
