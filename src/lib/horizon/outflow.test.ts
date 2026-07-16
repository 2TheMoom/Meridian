import assert from "node:assert/strict";
import { test } from "node:test";
import { computeOutflowUsd } from "./outflow";

const WALLET = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const TOKEN_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function transferLog(from: string, to: string, value: bigint, tokenAddress: string) {
  return {
    address: tokenAddress,
    args: { from, to, value },
  } as unknown as import("./logs").TransferLog;
}

test("computeOutflowUsd: no prior balance means native outflow is skipped entirely", () => {
  const usd = computeOutflowUsd({
    walletAddress: WALLET,
    walletTransferLogs: [],
    priorNativeBalance: null,
    currentNativeBalance: 0n,
    nativePriceUsd: 2,
    tokenPricesUsd: {},
    tokenDecimals: {},
  });
  assert.equal(usd, 0);
});

test("computeOutflowUsd: a native balance drop converts to USD at the native price", () => {
  const usd = computeOutflowUsd({
    walletAddress: WALLET,
    walletTransferLogs: [],
    priorNativeBalance: 10n * 10n ** 18n, // 10 MON
    currentNativeBalance: 7n * 10n ** 18n, // 7 MON -> 3 MON spent
    nativePriceUsd: 2, // $2/MON
    tokenPricesUsd: {},
    tokenDecimals: {},
  });
  assert.equal(usd, 6); // 3 MON * $2
});

test("computeOutflowUsd: a native balance increase is floored at zero, not negative", () => {
  const usd = computeOutflowUsd({
    walletAddress: WALLET,
    walletTransferLogs: [],
    priorNativeBalance: 5n * 10n ** 18n,
    currentNativeBalance: 8n * 10n ** 18n, // balance went up this window
    nativePriceUsd: 2,
    tokenPricesUsd: {},
    tokenDecimals: {},
  });
  assert.equal(usd, 0);
});

test("computeOutflowUsd: no native price known means native outflow is skipped even with a drop", () => {
  const usd = computeOutflowUsd({
    walletAddress: WALLET,
    walletTransferLogs: [],
    priorNativeBalance: 10n * 10n ** 18n,
    currentNativeBalance: 0n,
    nativePriceUsd: null,
    tokenPricesUsd: {},
    tokenDecimals: {},
  });
  assert.equal(usd, 0);
});

test("computeOutflowUsd: sums outgoing ERC-20 transfers using decimals and price", () => {
  const usd = computeOutflowUsd({
    walletAddress: WALLET,
    walletTransferLogs: [transferLog(WALLET, OTHER, 100n * 10n ** 6n, TOKEN_A)], // 100 units, 6 decimals
    priorNativeBalance: null,
    currentNativeBalance: 0n,
    nativePriceUsd: null,
    tokenPricesUsd: { [TOKEN_A]: 1.5 },
    tokenDecimals: { [TOKEN_A]: 6 },
  });
  assert.equal(usd, 150); // 100 * $1.50
});

test("computeOutflowUsd: incoming transfers to the wallet are not counted as outflow", () => {
  const usd = computeOutflowUsd({
    walletAddress: WALLET,
    walletTransferLogs: [transferLog(OTHER, WALLET, 100n * 10n ** 6n, TOKEN_A)],
    priorNativeBalance: null,
    currentNativeBalance: 0n,
    nativePriceUsd: null,
    tokenPricesUsd: { [TOKEN_A]: 1.5 },
    tokenDecimals: { [TOKEN_A]: 6 },
  });
  assert.equal(usd, 0);
});

test("computeOutflowUsd: a token with no known price or decimals is skipped, not guessed", () => {
  const usd = computeOutflowUsd({
    walletAddress: WALLET,
    walletTransferLogs: [transferLog(WALLET, OTHER, 100n * 10n ** 18n, TOKEN_A)],
    priorNativeBalance: null,
    currentNativeBalance: 0n,
    nativePriceUsd: null,
    tokenPricesUsd: {},
    tokenDecimals: {},
  });
  assert.equal(usd, 0);
});

test("computeOutflowUsd: multiple outgoing transfers of the same token are summed before pricing", () => {
  const usd = computeOutflowUsd({
    walletAddress: WALLET,
    walletTransferLogs: [
      transferLog(WALLET, OTHER, 10n * 10n ** 6n, TOKEN_A),
      transferLog(WALLET, OTHER, 20n * 10n ** 6n, TOKEN_A),
    ],
    priorNativeBalance: null,
    currentNativeBalance: 0n,
    nativePriceUsd: null,
    tokenPricesUsd: { [TOKEN_A]: 2 },
    tokenDecimals: { [TOKEN_A]: 6 },
  });
  assert.equal(usd, 60); // (10 + 20) * $2
});

test("computeOutflowUsd: native and token outflow combine in the same window", () => {
  const usd = computeOutflowUsd({
    walletAddress: WALLET,
    walletTransferLogs: [transferLog(WALLET, OTHER, 5n * 10n ** 6n, TOKEN_A)],
    priorNativeBalance: 2n * 10n ** 18n,
    currentNativeBalance: 1n * 10n ** 18n,
    nativePriceUsd: 3,
    tokenPricesUsd: { [TOKEN_A]: 2 },
    tokenDecimals: { [TOKEN_A]: 6 },
  });
  assert.equal(usd, 13); // 1 MON * $3 + 5 tokens * $2
});
