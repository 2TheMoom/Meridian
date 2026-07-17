"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MomentCard } from "@/components/MomentCard";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Moment } from "@/lib/oracle/types";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

type Wallet = { id: string; address: string; label: string | null; chain_id: number };

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function groupByDay(moments: Moment[]): [string, Moment[]][] {
  const groups = new Map<string, Moment[]>();
  for (const moment of moments) {
    const key = dayKey(moment.created_at);
    const existing = groups.get(key);
    if (existing) existing.push(moment);
    else groups.set(key, [moment]);
  }
  return [...groups.entries()];
}

export default function TimelinePage() {
  const { session, loading: authLoading } = useSupabaseAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const supabase = createBrowserSupabaseClient();

  const authedFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Not signed in");
      return fetch(path, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
      });
    },
    [supabase],
  );

  useEffect(() => {
    if (!session) return;
    authedFetch("/api/wallets")
      .then((res) => res.json())
      .then((body: { wallets?: Wallet[] }) => {
        const list = body.wallets ?? [];
        setWallets(list);
        setSelectedWalletId((current) => current ?? list[0]?.id ?? null);
      })
      .catch(() => setError("Failed to load wallets."));
  }, [session, authedFetch]);

  useEffect(() => {
    if (!selectedWalletId) return;
    setMoments(null);
    authedFetch(`/api/timeline?wallet=${selectedWalletId}`)
      .then((res) => res.json())
      .then((body: { moments?: Moment[] }) => setMoments(body.moments ?? []))
      .catch(() => setError("Failed to load timeline."));
  }, [selectedWalletId, authedFetch]);

  async function updateStatus(id: string, status: "acked" | "dismissed") {
    setPendingIds((prev) => new Set(prev).add(id));
    try {
      const res = await authedFetch(`/api/moments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("update failed");
      setMoments((prev) => prev?.map((m) => (m.id === id ? { ...m, status } : m)) ?? null);
    } catch {
      setError("Couldn't update that moment. Try again.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const openCount = useMemo(() => moments?.filter((m) => m.status === "open").length ?? 0, [moments]);
  const grouped = useMemo(() => groupByDay(moments ?? []), [moments]);
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);

  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl text-paper">Timeline</h1>
        <p className="font-body text-dim">Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl text-paper">Timeline</h1>
        <p className="font-body text-dim">
          Sign in and register a wallet first.{" "}
          <Link href="/" className="text-brass underline underline-offset-4">
            Go back
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-paper">Timeline</h1>
        <nav className="flex gap-4 font-technical text-xs uppercase tracking-widest text-dim">
          <Link href="/guardrails" className="underline underline-offset-4 hover:text-paper">
            Guardrails
          </Link>
          <Link href="/" className="underline underline-offset-4 hover:text-paper">
            Manage wallets
          </Link>
        </nav>
      </header>

      {wallets.length > 1 && (
        <select
          value={selectedWalletId ?? ""}
          onChange={(e) => setSelectedWalletId(e.target.value)}
          className="w-fit border border-paper/15 bg-ink-raised px-3 py-2 font-technical text-sm text-paper"
        >
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label ?? w.address}
            </option>
          ))}
        </select>
      )}

      {error && <p className="font-body text-sm text-danger">{error}</p>}

      {wallets.length === 0 && moments === null ? (
        <p className="font-body text-dim">
          No wallet registered yet.{" "}
          <Link href="/" className="text-brass underline underline-offset-4">
            Register one
          </Link>
          .
        </p>
      ) : moments === null ? (
        <p className="font-body text-dim">Loading...</p>
      ) : openCount === 0 ? (
        <div className="border border-paper/10 bg-ink-raised p-6 text-center">
          <p className="font-display text-xl text-brass">All clear</p>
          <p className="mt-1 font-body text-sm text-dim">Meridian is watching. Nothing needs your attention right now.</p>
        </div>
      ) : null}

      {grouped.length > 0 && (
        <div className="flex flex-col gap-6">
          {grouped.map(([day, dayMoments]) => (
            <section key={day} className="flex flex-col gap-3">
              <h2 className="font-technical text-[11px] uppercase tracking-widest text-dim">{day}</h2>
              <div className="flex flex-col gap-3">
                {dayMoments.map((moment) => (
                  <MomentCard
                    key={moment.id}
                    moment={moment}
                    chainId={selectedWallet?.chain_id ?? 143}
                    onAcknowledge={(id) => updateStatus(id, "acked")}
                    onDismiss={(id) => updateStatus(id, "dismissed")}
                    onRevoked={(id) =>
                      setMoments((prev) => prev?.map((m) => (m.id === id ? { ...m, status: "acted" } : m)) ?? null)
                    }
                    isUpdating={pendingIds.has(moment.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
