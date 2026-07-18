"use client";

import { useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// Shared by every page that calls an authenticated API route with the
// current session's bearer token — Timeline and Guardrails each had their
// own identical copy of this before.
export function useAuthedFetch() {
  return useCallback(async (path: string, init?: RequestInit) => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Not signed in");
    return fetch(path, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
    });
  }, []);
}
