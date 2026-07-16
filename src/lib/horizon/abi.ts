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

export const UNLIMITED_APPROVAL_THRESHOLD = 2n ** 255n; // effectively "unlimited" for uint256 max-style approvals
