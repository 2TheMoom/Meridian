"use client";

import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";

const NETWORKS = [
  { chainId: 143, name: "Monad" },
  { chainId: 10143, name: "Monad Testnet" },
] as const;

// Lets a connected wallet switch between Monad mainnet and testnet from the
// dashboard, instead of only discovering it's on the wrong one mid-action.
export function ChainSwitcher() {
  const { isConnected, chain } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const [showMenu, setShowMenu] = useState(false);

  if (!isConnected) return null;

  const current = NETWORKS.find((n) => n.chainId === chain?.id);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu((m) => !m)}
        disabled={isPending}
        className={`flex items-center gap-1.5 border px-2.5 py-1 font-technical text-[11px] uppercase tracking-widest ${
          current ? "border-paper/15 text-dim" : "border-danger/40 text-danger"
        }`}
      >
        {current ? (
          <img src="/chain-icons/monad.svg" alt="" width={12} height={12} />
        ) : (
          <span className="h-2 w-2 rounded-full bg-danger" />
        )}
        {isPending ? "Switching…" : current ? current.name : "Wrong network"}
        <span className="text-dim">▾</span>
      </button>

      {showMenu && (
        <>
          <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[180px] border border-paper/15 bg-ink-raised p-1 shadow-lg">
            {NETWORKS.map((n) => (
              <button
                key={n.chainId}
                onClick={() => {
                  switchChain({ chainId: n.chainId });
                  setShowMenu(false);
                }}
                disabled={n.chainId === chain?.id}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left font-body text-sm ${
                  n.chainId === chain?.id ? "text-brass" : "text-paper hover:bg-paper/5"
                }`}
              >
                <img src="/chain-icons/monad.svg" alt="" width={16} height={16} />
                {n.name}
                {n.chainId === chain?.id && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
          </div>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
        </>
      )}
    </div>
  );
}
