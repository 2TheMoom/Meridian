"use client";

import { ChainSwitcher } from "@/components/ChainSwitcher";
import { ConnectButton } from "@/components/ConnectButton";
import { GetStarted } from "@/components/GetStarted";
import { Guard } from "@/components/Guard";
import { LogoMark } from "@/components/LogoMark";

// The one place on the whole site that connects a wallet or signs in.
// Returning to the landing view is a client-side switch (see app/page.tsx),
// not a route change.
export function Dashboard({ onGoLanding }: { onGoLanding: () => void }) {
  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-paper/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
          <button onClick={onGoLanding} className="flex items-center gap-2" aria-label="Meridian home">
            <LogoMark size={24} />
            <span className="font-display text-lg italic text-paper">Meridian</span>
          </button>
          <div className="flex items-center gap-3">
            <ChainSwitcher />
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6">
        <Guard />
        <GetStarted />
      </main>
    </div>
  );
}
