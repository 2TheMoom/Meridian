"use client";

import type { EthereumWallet, Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getVerifiedWeb3Address } from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  // The cached `session.user` object from getSession()/onAuthStateChange
  // isn't reliably the full user record — its `identities` array can be
  // stale or absent. getUser() re-validates the token against Supabase and
  // returns exactly what the server sees, which is the only address worth
  // trusting for "did this session actually sign in as this wallet".
  const [verifiedAddress, setVerifiedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createBrowserSupabaseClient());

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

  useEffect(() => {
    if (!session) {
      setVerifiedAddress(null);
      return;
    }
    let cancelled = false;
    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      setVerifiedAddress(!error && data.user ? getVerifiedWeb3Address(data.user) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [session, supabase]);

  async function signInWithEthereum(wallet: EthereumWallet) {
    const { data, error } = await supabase.auth.signInWithWeb3({
      chain: "ethereum",
      wallet,
      statement: "Sign in to Meridian to register your wallet for monitoring.",
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, verifiedAddress, loading, signInWithEthereum, signOut };
}
