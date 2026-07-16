"use client";

import { RULE_LABELS } from "@/lib/oracle/labels";
import type { Moment } from "@/lib/oracle/types";

const CRIMSON_THRESHOLD = 85; // spec section 7: crimson reserved for score >= 85 only

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function MomentCard({
  moment,
  onAcknowledge,
  onDismiss,
  isUpdating,
}: {
  moment: Moment;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  isUpdating: boolean;
}) {
  const isSevere = moment.score >= CRIMSON_THRESHOLD;
  const [why, saferAlternative] = (moment.oracle_text ?? "").split("\n\n");
  const spender = moment.context.spender as string | undefined;
  const token = moment.context.token as string | undefined;
  const isOpen = moment.status === "open";

  return (
    <div
      className={`rounded border-l-4 bg-horizon p-4 ${isSevere ? "border-crimson" : "border-amber"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 font-heading text-sm tracking-wide text-navy ${
              isSevere ? "bg-crimson" : "bg-amber"
            }`}
          >
            {RULE_LABELS[moment.rule_id]}
          </span>
          <span className="font-mono text-sm text-slate-400">score {moment.score}</span>
        </div>
        <span className="text-xs text-slate-500">{formatTimestamp(moment.created_at)}</span>
      </div>

      {why && (
        <div className="mt-3 space-y-2 text-sm text-slate-200">
          <p>{why}</p>
          {saferAlternative && <p className="text-slate-300">{saferAlternative}</p>}
        </div>
      )}

      {(spender || token) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-slate-500">
          {spender && <span>spender {truncateAddress(spender)}</span>}
          {token && <span>token {truncateAddress(token)}</span>}
        </div>
      )}

      {isOpen ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onAcknowledge(moment.id)}
            disabled={isUpdating}
            className="rounded bg-slate-700 px-3 py-1 text-sm text-slate-100 disabled:opacity-50"
          >
            Acknowledge
          </button>
          <button
            onClick={() => onDismiss(moment.id)}
            disabled={isUpdating}
            className="rounded border border-slate-600 px-3 py-1 text-sm text-slate-300 disabled:opacity-50"
          >
            Dismiss
          </button>
          {moment.rule_id === "R1" && (
            <button
              disabled
              title="Keel's one-tap revoke ships in v1.1 — not wired to a transaction yet"
              className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-500"
            >
              Revoke (coming soon)
            </button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">{moment.status}</p>
      )}
    </div>
  );
}
