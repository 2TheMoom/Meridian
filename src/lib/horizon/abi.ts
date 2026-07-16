import { parseAbiItem } from "viem";

export const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export const approvalEvent = parseAbiItem(
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
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

export const UNLIMITED_APPROVAL_THRESHOLD = 2n ** 255n; // effectively "unlimited" for uint256 max-style approvals
