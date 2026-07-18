"use client";

import { useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { BackLink } from "@/components/ui/BackLink";
import { Panel } from "@/components/ui/Panel";
import { WalletRegistrationForm } from "./WalletRegistrationForm";

// Connecting a wallet and signing in happen once, from the ConnectButton in
// the top nav — this panel only ever covers the one thing that's a distinct,
// repeatable action: registering a wallet for Meridian to watch.
export function GetStarted() {
  const { session, loading } = useSupabaseAuth();
  const [registered, setRegistered] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Panel size="lg">
        <h1 className="font-display text-3xl text-paper">Watch a wallet</h1>
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
      </Panel>

      {registered && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-body text-sm text-paper">
            Wallet registered. Horizon starts watching on the next sync window.
          </p>
          <div className="flex gap-3">
            <BackLink href="/timeline" label="View Timeline" showArrow={false} />
            <BackLink href="/guardrails" label="Guardrails" showArrow={false} />
          </div>
        </div>
      )}
    </div>
  );
}
