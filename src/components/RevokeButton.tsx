"use client";

import { useEffect, useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20ApproveAbi, setApprovalForAllAbi } from "@/lib/horizon/abi";
import type { RuleId } from "@/lib/oracle/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function RevokeButton({
  momentId,
  ruleId,
  token,
  spender,
  chainId,
  walletAddress,
  onRevoked,
}: {
  momentId: string;
  ruleId: RuleId;
  token: string;
  spender: string;
  chainId: number;
  walletAddress: string | null;
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
      if (ruleId === "R6") {
        await writeContractAsync({
          address: token as `0x${string}`,
          abi: [setApprovalForAllAbi],
          functionName: "setApprovalForAll",
          args: [spender as `0x${string}`, false],
          chainId,
        });
      } else {
        await writeContractAsync({
          address: token as `0x${string}`,
          abi: [erc20ApproveAbi],
          functionName: "approve",
          args: [spender as `0x${string}`, 0n],
          chainId,
        });
      }
    } catch {
      setError("Revoke was rejected or failed to send.");
      reset();
    }
  }

  // Not just "is some wallet connected" — the connected wallet must be the
  // exact one this Moment belongs to. Without this, switching MetaMask
  // accounts while viewing another wallet's Moment would let you attempt a
  // revoke transaction signed from the wrong address entirely.
  const walletMismatch =
    connectedAddress === undefined ||
    (walletAddress !== null && connectedAddress.toLowerCase() !== walletAddress.toLowerCase());
  const busy = isSigning || (txHash && !isConfirmed) || verifying;

  return (
    <div className="flex flex-col gap-1">
      <Button variant="danger" size="sm" onClick={handleClick} disabled={Boolean(busy) || walletMismatch}>
        {isSigning ? "Confirm in wallet..." : txHash && !isConfirmed ? "Waiting for confirmation..." : verifying ? "Verifying..." : "Revoke approval"}
      </Button>
      {walletMismatch && !busy && (
        <p className="font-body text-xs text-danger">
          {connectedAddress === undefined
            ? "Connect a wallet to revoke."
            : "Connected wallet doesn't match this Moment's wallet — switch accounts to revoke."}
        </p>
      )}
      {error && <p className="font-body text-xs text-danger">{error}</p>}
    </div>
  );
}
