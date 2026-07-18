"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Panel } from "@/components/ui/Panel";

// Shared by Timeline and Guardrails, which previously only checked
// `session` (Supabase) — if the wallet disconnected but the session
// persisted, both pages kept rendering stale data with zero indication
// anything was wrong. This adds the missing isConnected check as its own
// distinct state, not lumped in with "not signed in".
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useSupabaseAuth();
  const { isConnected } = useAccount();

  if (authLoading) {
    return <p className="font-body text-dim">Loading...</p>;
  }

  if (!session) {
    return (
      <p className="font-body text-dim">
        Sign in and register a wallet first.{" "}
        <Link href="/dashboard" className="text-brass underline underline-offset-4">
          Go to dashboard
        </Link>
        .
      </p>
    );
  }

  if (!isConnected) {
    return (
      <Panel accent="left-danger">
        <p className="font-body text-sm text-paper">Wallet disconnected.</p>
        <p className="mt-1 font-body text-sm text-dim">
          Reconnect from the button above to keep managing this wallet&apos;s settings.
        </p>
      </Panel>
    );
  }

  return <>{children}</>;
}
