"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useAuthedFetch } from "@/hooks/useAuthedFetch";
import { BackLink } from "@/components/ui/BackLink";
import { Panel } from "@/components/ui/Panel";
import { WalletRegistrationForm } from "./WalletRegistrationForm";

type Wallet = { id: string; address: string };

// Connecting a wallet and signing in happen once, from the ConnectButton in
// the top nav — this panel only ever covers the one thing that's a distinct,
// repeatable action: registering a wallet for Meridian to watch.
export function GetStarted() {
  const { session, loading } = useSupabaseAuth();
  const { address } = useAccount();
  const authedFetch = useAuthedFetch();
  const [registered, setRegistered] = useState(false);
  // Without this, the panel always defaults to showing the registration
  // form on load/reconnect, even for a wallet that's already registered —
  // submitting it again then hits a real, correct 409 from the server with
  // no explanation, because the client never checked first.
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (!session || !address) {
      setCheckingExisting(false);
      return;
    }

    let cancelled = false;
    setCheckingExisting(true);
    authedFetch("/api/wallets")
      .then((res) => res.json())
      .then((body: { wallets?: Wallet[] }) => {
        if (cancelled) return;
        const alreadyRegistered = (body.wallets ?? []).some(
          (w) => w.address.toLowerCase() === address.toLowerCase(),
        );
        setRegistered(alreadyRegistered);
      })
      .catch(() => {
        // Fails open to the registration form — a failed check shouldn't
        // block someone who genuinely hasn't registered yet, and a real
        // duplicate would still be caught server-side on submit.
      })
      .finally(() => {
        if (!cancelled) setCheckingExisting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, address, authedFetch]);

  return (
    <div className="flex flex-col gap-6">
      <Panel size="lg">
        <h1 className="font-display text-3xl text-paper">Watch a wallet</h1>
        <p className="mt-2 font-body text-sm text-dim">
          Meridian scores every transaction your registered wallet is about to make, in real time.
        </p>
        <div className="mt-6">
          {loading || checkingExisting ? (
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
