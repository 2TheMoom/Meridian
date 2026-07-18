"use client";

import type { EthereumWallet } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { injected, walletConnect } from "@wagmi/connectors";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { monad } from "@/lib/chain";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// The one control that owns "connect a wallet" end to end: pick a wallet,
// connect it, and immediately sign the SIWE message with it — one action
// from the user's point of view, not three separate steps. Wallet
// registration (a distinct, repeatable action) lives in its own panel.
export function ConnectButton() {
  const { address, isConnected, connector } = useAccount();
  const { connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { session, verifiedAddress, loading: sessionLoading, signInWithEthereum, signOut } = useSupabaseAuth();

  const [showPicker, setShowPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // connect() is a fire-and-forget mutation — without an onError handler a
  // rejected connection (wallet quirk, rejected permission prompt, etc.)
  // silently reverts the UI to "Connect Wallet" with no explanation at all.
  const [connectError, setConnectError] = useState<string | null>(null);
  // Mirrors the same guard Salvage's ConnectButton uses: wagmi's isConnected
  // can lag a beat behind disconnect() depending on the connector, and
  // auto-triggering a fresh sign-in in that window re-opens a stuck-UI race.
  const [disconnecting, setDisconnecting] = useState(false);

  // Supabase's session persists in localStorage across reloads and account
  // switches — if the wallet the user is now connected with isn't the one
  // that session was signed in with (switched accounts in MetaMask, or a
  // stale session from a previous wallet), silently trusting the old session
  // means the address this component reports up doesn't match what's
  // actually connected. Re-sign whenever they diverge, not just when there's
  // no session at all. verifiedAddress is null until useSupabaseAuth's
  // getUser() call resolves, so this only flags a real mismatch once we
  // actually have something to compare against.
  const addressMismatch = Boolean(address && verifiedAddress && verifiedAddress !== address.toLowerCase());

  useEffect(() => {
    setError(null);
    if (disconnecting) return;
    if (isConnected && address && connector && !sessionLoading && !signingIn && (!session || addressMismatch)) {
      void handleSignIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, connector, session, addressMismatch, sessionLoading, disconnecting]);

  async function handleSignIn() {
    if (!connector) return;
    setSigningIn(true);
    setError(null);
    try {
      const provider = (await connector.getProvider()) as EthereumWallet;
      await signInWithEthereum(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  }

  function handleDisconnect() {
    setShowMenu(false);
    setDisconnecting(true);
    void signOut();
    disconnect();
  }

  const truncated = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  // ── Connected + signed in
  if (!disconnecting && isConnected && address && session && !addressMismatch) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu((m) => !m)}
          className="flex items-center gap-2 border border-paper/15 bg-ink-raised px-3 py-1.5 font-technical text-xs text-paper"
        >
          <span className="h-2 w-2 rounded-full bg-signal" />
          {truncated}
        </button>
        {showMenu && (
          <>
            <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[180px] border border-paper/15 bg-ink-raised p-1 shadow-lg">
              <button
                onClick={handleDisconnect}
                className="w-full px-3 py-2 text-left font-technical text-xs text-danger hover:bg-paper/5"
              >
                Disconnect
              </button>
            </div>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          </>
        )}
      </div>
    );
  }

  // ── Connected, signing in (or failed)
  if (!disconnecting && isConnected && address && (!session || addressMismatch)) {
    if (error) {
      return (
        <div className="flex flex-col items-end gap-2">
          <p className="max-w-[220px] text-right font-body text-xs text-danger">{error}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSignIn()}
              disabled={signingIn}
              className="border border-brass px-4 py-2 font-display text-sm text-brass disabled:opacity-50"
            >
              Try again
            </button>
            <button onClick={handleDisconnect} className="font-technical text-xs text-dim hover:text-paper">
              Cancel
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 font-technical text-xs text-dim">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brass border-t-transparent" />
        Check your wallet…
      </div>
    );
  }

  // ── Disconnected, picker open
  if (showPicker) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowPicker(false)}
          className="border border-brass px-4 py-2 font-display text-sm text-brass"
        >
          Connect Wallet
        </button>
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[220px] border border-paper/15 bg-ink-raised p-1 shadow-lg">
          <button
            onClick={() => {
              setDisconnecting(false);
              setShowPicker(false);
              setConnectError(null);
              connect(
                { connector: injected(), chainId: monad.id },
                { onError: (err) => setConnectError(err.message) },
              );
            }}
            disabled={connecting}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left font-body text-sm text-paper hover:bg-paper/5 disabled:opacity-50"
          >
            <img src="/wallet-icons/metamask.svg" alt="" width={18} height={18} />
            MetaMask
          </button>
          {WALLETCONNECT_PROJECT_ID && (
            <button
              onClick={() => {
                setDisconnecting(false);
                setShowPicker(false);
                setConnectError(null);
                connect(
                  {
                    connector: walletConnect({
                      projectId: WALLETCONNECT_PROJECT_ID,
                      metadata: {
                        name: "Meridian",
                        description:
                          "The chain is too fast for a second thought. Meridian is that thought, running before you sign.",
                        // WalletConnect verifies this against the page's actual
                        // origin — a mismatched hardcoded domain trips its
                        // "unverified" warning in the wallet's connect prompt.
                        url: window.location.origin,
                        icons: [`${window.location.origin}/icon-512.png`],
                      },
                      showQrModal: true,
                    }),
                    chainId: monad.id,
                  },
                  { onError: (err) => setConnectError(err.message) },
                );
              }}
              disabled={connecting}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left font-body text-sm text-paper hover:bg-paper/5 disabled:opacity-50"
            >
              <img src="/wallet-icons/walletconnect.svg" alt="" width={18} height={18} />
              WalletConnect
            </button>
          )}
        </div>
        <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
      </div>
    );
  }

  // ── Disconnected, idle
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={() => setShowPicker(true)}
        disabled={connecting}
        className="border border-brass px-4 py-2 font-display text-sm text-brass disabled:opacity-50"
      >
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
      {connectError && <p className="max-w-[220px] text-right font-body text-xs text-danger">{connectError}</p>}
    </div>
  );
}
