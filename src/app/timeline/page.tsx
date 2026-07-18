"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";
import { BackLink } from "@/components/ui/BackLink";
import { Panel } from "@/components/ui/Panel";
import { MomentCard } from "@/components/MomentCard";
import { WalletSelect } from "@/components/WalletSelect";
import { useAuthedFetch } from "@/hooks/useAuthedFetch";
import type { Moment } from "@/lib/oracle/types";

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

function TimelineContent() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const authedFetch = useAuthedFetch();

  useEffect(() => {
    authedFetch("/api/wallets")
      .then((res) => res.json())
      .then((body: { wallets?: Wallet[] }) => {
        const list = body.wallets ?? [];
        setWallets(list);
        setSelectedWalletId((current) => current ?? list[0]?.id ?? null);
      })
      .catch(() => setError("Failed to load wallets."));
  }, [authedFetch]);

  useEffect(() => {
    if (!selectedWalletId) return;
    setMoments(null);
    authedFetch(`/api/timeline?wallet=${selectedWalletId}`)
      .then((res) => res.json())
      .then((body: { moments?: Moment[] }) => setMoments(body.moments ?? []))
      .catch(() => setError("Failed to load timeline."));
  }, [selectedWalletId, authedFetch]);

  const updateStatus = useCallback(
    async (id: string, status: "acked" | "dismissed") => {
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
    },
    [authedFetch],
  );

  const openCount = useMemo(() => moments?.filter((m) => m.status === "open").length ?? 0, [moments]);
  const grouped = useMemo(() => groupByDay(moments ?? []), [moments]);
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);

  return (
    <div className="flex flex-col gap-6">
      <WalletSelect wallets={wallets} selectedWalletId={selectedWalletId} onChange={setSelectedWalletId} />

      {error && <p className="font-body text-sm text-danger">{error}</p>}

      {wallets.length === 0 && moments === null ? (
        <p className="font-body text-dim">
          No wallet registered yet.{" "}
          <BackLink href="/dashboard" label="Register one" />
        </p>
      ) : moments === null ? (
        <p className="font-body text-dim">Loading...</p>
      ) : openCount === 0 ? (
        <Panel className="text-center">
          <p className="font-display text-xl text-brass">All clear</p>
          <p className="mt-1 font-body text-sm text-dim">Meridian is watching. Nothing needs your attention right now.</p>
        </Panel>
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
                    walletAddress={selectedWallet?.address ?? null}
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
    </div>
  );
}

export default function TimelinePage() {
  return (
    <div className="min-h-screen bg-ink">
      <AppHeader />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl text-paper">Timeline</h1>
          <BackLink href="/dashboard" label="Dashboard" />
        </div>
        <AuthGate>
          <TimelineContent />
        </AuthGate>
      </main>
    </div>
  );
}
