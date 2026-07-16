"use client";

import { useEffect, useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20ApproveAbi } from "@/lib/horizon/abi";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function RevokeButton({
  momentId,
  token,
  spender,
  chainId,
  onRevoked,
}: {
  momentId: string;
  token: string;
  spender: string;
  chainId: number;
  onRevoked: () => void;
}) {
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync, isPending: isSigning, data: txHash, reset } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash, chainId });
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfirmed || !txHash) return;

    let cancelled = false;
    (async () => {
      setVerifying(true);
      setError(null);
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error("Not signed in");

        const res = await fetch(`/api/moments/${momentId}/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ txHash }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Verification failed");
        }
        if (!cancelled) onRevoked();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't confirm the revoke.");
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, txHash]);

  async function handleClick() {
    setError(null);
    try {
      await writeContractAsync({
        address: token as `0x${string}`,
        abi: [erc20ApproveAbi],
        functionName: "approve",
        args: [spender as `0x${string}`, 0n],
        chainId,
      });
    } catch {
      setError("Revoke was rejected or failed to send.");
      reset();
    }
  }

  const walletMismatch = connectedAddress === undefined;
  const busy = isSigning || (txHash && !isConfirmed) || verifying;

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={Boolean(busy) || walletMismatch}
        className="rounded bg-crimson px-3 py-1 text-sm text-slate-100 disabled:opacity-50"
      >
        {isSigning ? "Confirm in wallet..." : txHash && !isConfirmed ? "Waiting for confirmation..." : verifying ? "Verifying..." : "Revoke approval"}
      </button>
      {error && <p className="text-xs text-crimson">{error}</p>}
    </div>
  );
}
