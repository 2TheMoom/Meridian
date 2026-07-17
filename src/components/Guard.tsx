"use client";

import { useState } from "react";
import { isAddress } from "viem";

type GuardVerdict = "safe" | "caution" | "danger";

type GuardResult = {
  address: string;
  chainId: number;
  contractAgeDays: number | null;
  verifiedOnExplorer: boolean | null;
  allowlisted: boolean;
  verdict: GuardVerdict;
  score: number;
  explanation: { why: string; saferAlternative: string } | null;
};

const VERDICT_STYLES: Record<GuardVerdict, { label: string; color: string; border: string }> = {
  safe: { label: "Safe to approve", color: "text-signal", border: "border-signal/40" },
  caution: { label: "Proceed with caution", color: "text-brass", border: "border-brass/40" },
  danger: { label: "Don't approve this", color: "text-danger", border: "border-danger/40" },
};

// The proactive half of Meridian: a contract/spender address can be checked
// here before it's ever approved, by anyone, with no wallet connected. R1/R6
// score an approval that already happened elsewhere in the app — this runs
// the same underlying signals ahead of time instead. See lib/oracle/guard.ts.
export function Guard() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(143);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuardResult | null>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!isAddress(address)) {
      setError("Enter a valid contract or spender address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/guard?address=${address}&chainId=${chainId}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Check failed.");
        return;
      }
      setResult(body);
    } catch {
      setError("Check failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-brass/40 bg-ink-raised p-8">
      <h2 className="font-display text-2xl text-paper">Guard</h2>
      <p className="mt-2 font-body text-sm text-dim">
        Check a contract or spender address before you approve it. No wallet connection needed — this runs before
        you sign anything.
      </p>

      <form onSubmit={handleCheck} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          className="flex-1 border border-paper/15 bg-ink px-3 py-2 font-technical text-sm text-paper outline-none"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
        />
        <select
          className="border border-paper/15 bg-ink px-3 py-2 font-technical text-sm text-paper outline-none"
          value={chainId}
          onChange={(e) => setChainId(Number(e.target.value))}
        >
          <option value={143}>Monad</option>
          <option value={10143}>Monad Testnet</option>
        </select>
        <button
          type="submit"
          disabled={loading || !address}
          className="border border-brass px-4 py-2 font-display text-sm text-brass disabled:opacity-40"
        >
          {loading ? "Checking…" : "Check"}
        </button>
      </form>

      {error && <p className="mt-4 font-body text-sm text-danger">{error}</p>}

      {result && (
        <div className={`mt-6 border p-4 ${VERDICT_STYLES[result.verdict].border}`}>
          <p className={`font-display text-lg ${VERDICT_STYLES[result.verdict].color}`}>
            {VERDICT_STYLES[result.verdict].label}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2 font-technical text-xs text-dim">
            <div>
              <dt className="uppercase tracking-widest">Allowlisted</dt>
              <dd className="mt-1 text-paper">{result.allowlisted ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-widest">Contract age</dt>
              <dd className="mt-1 text-paper">
                {result.contractAgeDays === null ? "Unknown" : `${Math.floor(result.contractAgeDays)}d`}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-widest">Verified</dt>
              <dd className="mt-1 text-paper">
                {result.verifiedOnExplorer === null ? "Unknown" : result.verifiedOnExplorer ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
          {result.explanation && (
            <div className="mt-4 flex flex-col gap-2 font-body text-sm text-paper">
              <p>{result.explanation.why}</p>
              <p className="text-dim">{result.explanation.saferAlternative}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
