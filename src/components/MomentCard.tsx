"use client";

import { RULE_LABELS } from "@/lib/oracle/labels";
import type { Moment } from "@/lib/oracle/types";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { RevokeButton } from "./RevokeButton";

const DANGER_THRESHOLD = 85; // spec section 7: reserved for score >= 85 only

const STATUS_LABELS: Record<string, string> = {
  acked: "acknowledged",
  dismissed: "dismissed",
  acted: "approval revoked",
  snoozed: "snoozed",
};

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
  chainId,
  walletAddress,
  onAcknowledge,
  onDismiss,
  onRevoked,
  isUpdating,
}: {
  moment: Moment;
  chainId: number;
  walletAddress: string | null;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  onRevoked: (id: string) => void;
  isUpdating: boolean;
}) {
  const isSevere = moment.score >= DANGER_THRESHOLD;
  const [why, saferAlternative] = (moment.oracle_text ?? "").split("\n\n");
  const spender = moment.context.spender as string | undefined;
  const token = moment.context.token as string | undefined;
  const isOpen = moment.status === "open";

  return (
    <Panel accent={isSevere ? "left-danger" : "left-brass"} size="sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 font-display text-sm text-ink ${isSevere ? "bg-danger" : "bg-brass"}`}
          >
            {RULE_LABELS[moment.rule_id]}
          </span>
          <span className="font-technical text-xs text-dim">score {moment.score}</span>
        </div>
        <span className="font-technical text-[11px] text-dim">{formatTimestamp(moment.created_at)}</span>
      </div>

      {why && (
        <div className="mt-3 space-y-2 font-body text-sm leading-relaxed text-paper/90">
          <p>{why}</p>
          {saferAlternative && <p className="text-paper/70">{saferAlternative}</p>}
        </div>
      )}

      {(spender || token) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-technical text-xs text-dim">
          {spender && <span>spender {truncateAddress(spender)}</span>}
          {token && <span>token {truncateAddress(token)}</span>}
        </div>
      )}

      {isOpen ? (
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <Button variant="secondary" size="sm" onClick={() => onAcknowledge(moment.id)} disabled={isUpdating}>
            Acknowledge
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onDismiss(moment.id)} disabled={isUpdating}>
            Dismiss
          </Button>
          {(moment.rule_id === "R1" || moment.rule_id === "R6") && token && spender && (
            <RevokeButton
              momentId={moment.id}
              ruleId={moment.rule_id}
              token={token}
              spender={spender}
              chainId={chainId}
              walletAddress={walletAddress}
              onRevoked={() => onRevoked(moment.id)}
            />
          )}
        </div>
      ) : (
        <p className="mt-4 font-technical text-[11px] uppercase tracking-wide text-dim">
          {STATUS_LABELS[moment.status] ?? moment.status}
        </p>
      )}
    </Panel>
  );
}
