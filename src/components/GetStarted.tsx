"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { WalletRegistrationForm } from "./WalletRegistrationForm";

function StepRow({
  n,
  label,
  done,
  children,
}: {
  n: number;
  label: string;
  done: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-technical text-xs ${
            done ? "bg-signal text-ink" : "border border-paper/25 text-dim"
          }`}
        >
          {done ? "✓" : n}
        </span>
        <span className={`font-display text-lg ${done ? "text-dim line-through" : "text-paper"}`}>{label}</span>
      </div>
      {!done && children && <div className="pl-9">{children}</div>}
    </li>
  );
}

export function GetStarted() {
  const { isConnected } = useAccount();
  const { session, loading, signInWithEthereum } = useSupabaseAuth();
  const [registered, setRegistered] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-paper/10 bg-ink-raised p-6">
        <ol className="flex flex-col gap-5">
          <StepRow n={1} label="Connect your wallet" done={isConnected}>
            <ConnectButton />
          </StepRow>

          <StepRow n={2} label="Sign in with Ethereum" done={Boolean(session)}>
            {isConnected && !loading && (
              <button
                onClick={() => signInWithEthereum()}
                className="w-fit border border-brass px-4 py-2 font-display text-sm text-brass"
              >
                Sign in with Ethereum
              </button>
            )}
          </StepRow>

          <StepRow n={3} label="Register a wallet to watch" done={registered}>
            {session && <WalletRegistrationForm onRegistered={() => setRegistered(true)} />}
          </StepRow>
        </ol>
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
