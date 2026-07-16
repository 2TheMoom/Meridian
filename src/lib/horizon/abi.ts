import { parseAbiItem } from "viem";

export const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export const approvalEvent = parseAbiItem(
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
);

// Shared verbatim by ERC-721 and ERC-1155 — both standards define the exact
// same signature for blanket, collection-wide operator approval. R6 watches
// this only, not ERC-721's single-token `Approval(owner, approved, tokenId)`
// — a single-token approval is bounded to one NFT, while ApprovalForAll is
// the actual drainer pattern (whole-collection control), so it's the entry
// condition that matters. See horizon/logs.ts and oracle/rules/r6NftApprovalRisk.ts.
export const approvalForAllEvent = parseAbiItem(
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
);

export const erc20BalanceOfAbi = parseAbiItem(
  "function balanceOf(address account) view returns (uint256)",
);

export const erc20DecimalsAbi = parseAbiItem("function decimals() view returns (uint8)");

// Shared by the client-side revoke transaction (wagmi write) and the
// server-side calldata verification in /api/moments/[id]/revoke — both must
// agree on the exact function signature being encoded/decoded.
export const erc20ApproveAbi = parseAbiItem(
  "function approve(address spender, uint256 amount) returns (bool)",
);

// Same client/server split as erc20ApproveAbi above — R6's Confirm-tier
// revoke (RevokeButton.tsx, /api/moments/[id]/revoke) both encode/decode
// this exact signature, shared verbatim by ERC-721 and ERC-1155.
export const setApprovalForAllAbi = parseAbiItem(
  "function setApprovalForAll(address operator, bool approved)",
);

export const UNLIMITED_APPROVAL_THRESHOLD = 2n ** 255n; // effectively "unlimited" for uint256 max-style approvals
