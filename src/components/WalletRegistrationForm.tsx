"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function WalletRegistrationForm({ onRegistered }: { onRegistered: () => void }) {
  const { address, chainId } = useAccount();
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setSubmitting(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setError("You need to sign in with Ethereum first.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/wallets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ address, chainId, label: label || null }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to register wallet.");
      return;
    }

    setLabel("");
    onRegistered();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
      <label className="font-body text-sm text-dim">
        Label (optional)
        <input
          className="mt-1 w-full border border-paper/15 bg-ink px-3 py-2 font-technical text-sm text-paper outline-none"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="main wallet"
        />
      </label>
      {error && <p className="font-body text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={!address || submitting} className="w-fit">
        {submitting ? "Registering..." : "Register this wallet"}
      </Button>
    </form>
  );
}
