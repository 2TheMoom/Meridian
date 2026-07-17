"use client";

import Link from "next/link";
import { useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { WalletRegistrationForm } from "./WalletRegistrationForm";

// Connecting a wallet and signing in happen once, from the ConnectButton in
// the top nav — this panel only ever covers the one thing that's a distinct,
// repeatable action: registering a wallet for Meridian to watch.
export function GetStarted() {
  const { session, loading } = useSupabaseAuth();
  const [registered, setRegistered] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-paper/10 bg-ink-raised p-8">
        <h1 className="font-display text-2xl text-paper">Watch a wallet</h1>
        <p className="mt-2 font-body text-sm text-dim">
          Meridian scores every transaction your registered wallet is about to make, in real time.
        </p>
        <div className="mt-6">
          {loading ? (
            <p className="font-body text-sm text-dim">Loading...</p>
          ) : !session ? (
            <p className="font-body text-sm text-dim">
              Connect your wallet and sign in using the button at the top right to get started.
            </p>
          ) : registered ? (
            <p className="font-body text-sm text-signal">Wallet registered.</p>
          ) : (
            <WalletRegistrationForm onRegistered={() => setRegistered(true)} />
          )}
        </div>
      </div>

      {registered && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-body text-sm text-paper">
            Wallet registered. Horizon starts watching on the next sync window.
          </p>
          <div className="flex gap-4">
            <Link href="/timeline" className="font-technical text-xs text-brass underline underline-offset-4">
              View Timeline
            </Link>
            <Link href="/guardrails" className="font-technical text-xs text-brass underline underline-offset-4">
              Guardrails
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
