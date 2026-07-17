"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import { RULE_LABELS } from "@/lib/oracle/labels";
import type { RuleId } from "@/lib/oracle/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

type Wallet = { id: string; address: string; label: string | null; notification_email: string | null };
type Tier = "off" | "notify" | "confirm";
type PolicyRow = { rule_id: RuleId; tier: Tier; threshold: Record<string, unknown> };

const RULE_ORDER: RuleId[] = ["R1", "R2", "R3", "R4", "R5", "R6"];
const TIERS: Tier[] = ["off", "notify", "confirm"];

export default function GuardrailsPage() {
  const { session, loading: authLoading } = useSupabaseAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[] | null>(null);
  const [floorMon, setFloorMon] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

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
    const wallet = wallets.find((w) => w.id === selectedWalletId);
    setNotificationEmail(wallet?.notification_email ?? "");
  }, [selectedWalletId, wallets]);

  useEffect(() => {
    if (!selectedWalletId) return;
    setPolicies(null);
    authedFetch(`/api/policies?wallet=${selectedWalletId}`)
      .then((res) => res.json())
      .then((body: { policies?: PolicyRow[] }) => {
        const rows = body.policies ?? [];
        setPolicies(rows);
        const r5 = rows.find((p) => p.rule_id === "R5");
        const floorNative = r5?.threshold?.floorNative;
        setFloorMon(typeof floorNative === "string" ? formatEther(BigInt(floorNative)) : "");
      })
      .catch(() => setError("Failed to load guardrails."));
  }, [selectedWalletId, authedFetch]);

  function setTier(ruleId: RuleId, tier: Tier) {
    setPolicies((prev) => prev?.map((p) => (p.rule_id === ruleId ? { ...p, tier } : p)) ?? null);
  }

  async function save() {
    if (!policies || !selectedWalletId) return;
    setStatus("saving");
    setError(null);

    let floorNative: string | undefined;
    if (floorMon.trim()) {
      try {
        floorNative = parseEther(floorMon.trim()).toString();
      } catch {
        setError("Floor must be a valid MON amount, e.g. 0.5");
        setStatus("idle");
        return;
      }
    }

    const trimmedEmail = notificationEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Notification email doesn't look valid.");
      setStatus("idle");
      return;
    }

    const payload = policies.map((p) => ({
      ruleId: p.rule_id,
      tier: p.tier,
      threshold: p.rule_id === "R5" ? { ...p.threshold, ...(floorNative ? { floorNative } : {}) } : p.threshold,
    }));

    try {
      const [policiesRes, walletRes] = await Promise.all([
        authedFetch(`/api/policies?wallet=${selectedWalletId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policies: payload }),
        }),
        authedFetch(`/api/wallets/${selectedWalletId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationEmail: trimmedEmail || null }),
        }),
      ]);
      if (!policiesRes.ok || !walletRes.ok) throw new Error("save failed");
      setWallets((prev) =>
        prev.map((w) => (w.id === selectedWalletId ? { ...w, notification_email: trimmedEmail || null } : w)),
      );
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setError("Couldn't save guardrails. Try again.");
      setStatus("idle");
    }
  }

  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl text-paper">Guardrails</h1>
        <p className="font-body text-dim">Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl text-paper">Guardrails</h1>
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
        <h1 className="font-display text-3xl text-paper">Guardrails</h1>
        <Link href="/timeline" className="font-technical text-xs uppercase tracking-widest text-dim underline underline-offset-4 hover:text-paper">
          Timeline
        </Link>
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

      {policies === null ? (
        <p className="font-body text-dim">Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 border border-paper/10 bg-ink-raised p-4 font-body text-sm text-dim">
            Notification email — Notify/Confirm-tier Moments email here. Leave blank to get in-app only.
            <input
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full max-w-sm border border-paper/15 bg-ink px-2 py-1 font-technical text-sm text-paper"
            />
          </label>

          {RULE_ORDER.map((ruleId) => {
            const policy = policies.find((p) => p.rule_id === ruleId);
            if (!policy) return null;
            return (
              <div key={ruleId} className="flex flex-col gap-2 border border-paper/10 bg-ink-raised p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg text-paper">{RULE_LABELS[ruleId]}</span>
                  <div className="flex gap-1">
                    {TIERS.map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setTier(ruleId, tier)}
                        className={`px-2 py-1 font-technical text-xs uppercase tracking-wide ${
                          policy.tier === tier ? "bg-brass text-ink" : "border border-paper/20 text-dim"
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                {ruleId === "R5" && (
                  <label className="font-body text-sm text-dim">
                    Floor (MON) — flag when native balance drops below this
                    <input
                      value={floorMon}
                      onChange={(e) => setFloorMon(e.target.value)}
                      placeholder="e.g. 0.5"
                      className="mt-1 block w-40 border border-paper/15 bg-ink px-2 py-1 font-technical text-sm text-paper"
                    />
                  </label>
                )}
              </div>
            );
          })}

          <p className="font-body text-xs text-dim">
            Marking a recurring payment (R3) as intentional isn&apos;t configurable here yet — detection is live, but
            there&apos;s no UI action to acknowledge a specific pattern, so it keeps surfacing until it stops
            recurring. Per-rule tier and the R5 floor above are live.
          </p>

          <button
            onClick={save}
            disabled={status === "saving"}
            className="w-fit border border-brass px-4 py-2 font-display text-sm text-brass hover:bg-brass hover:text-ink disabled:opacity-50"
          >
            {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save guardrails"}
          </button>
        </div>
      )}
    </main>
  );
}
