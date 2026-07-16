"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { WalletRegistrationForm } from "@/components/WalletRegistrationForm";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

export default function Home() {
  const { isConnected } = useAccount();
  const { session, loading, signInWithEthereum } = useSupabaseAuth();
  const [registered, setRegistered] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-4xl tracking-wide">Meridian</h1>
        <p className="text-slate-400">
          The chain is too fast for second thoughts. Meridian is your second
          thought, running before you sign.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <ConnectButton />

        {isConnected && !loading && !session && (
          <button
            onClick={() => signInWithEthereum()}
            className="w-fit rounded bg-amber px-4 py-2 font-heading text-navy"
          >
            Sign in with Ethereum
          </button>
        )}

        {session && !registered && (
          <WalletRegistrationForm onRegistered={() => setRegistered(true)} />
        )}

        {registered && (
          <p className="text-sm text-slate-300">
            Wallet registered. Horizon will start watching it on the next
            sync window.
          </p>
        )}

        {session && (
          <Link href="/timeline" className="w-fit text-sm text-amber underline">
            View Timeline
          </Link>
        )}
      </section>
    </main>
  );
}
