"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function signInWithEthereum() {
    const { data, error } = await supabase.auth.signInWithWeb3({
      chain: "ethereum",
      statement: "Sign in to Meridian to register your wallet for monitoring.",
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, loading, signInWithEthereum, signOut };
}
