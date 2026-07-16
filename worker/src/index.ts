import { createPublicClient, webSocket } from "viem";
import { monad, monadTestnet } from "../../src/lib/chain";
import { getLastProcessedBlock, setLastProcessedBlock } from "../../src/lib/horizon/syncState";
import { getRegisteredWallets } from "../../src/lib/horizon/wallets";
import { processWindow, type RegisteredWallet } from "../../src/lib/horizon/window";
import { createServiceRoleSupabaseClient } from "../../src/lib/supabase/server";
import { config } from "./config";

const chain = config.chainId === 143 ? monad : monadTestnet;
const supabase = createServiceRoleSupabaseClient();
const client = createPublicClient({
  chain,
  transport: webSocket(config.wsRpcUrl, { reconnect: true, retryCount: 10 }),
});

let wallets: RegisteredWallet[] = [];
let cursor: bigint | null = null;
let latestHead = 0n;
let processing = false;

function log(...args: unknown[]) {
  console.log(`[horizon:${chain.id}]`, new Date().toISOString(), ...args);
}

async function refreshWallets() {
  try {
    wallets = await getRegisteredWallets(supabase, config.chainId);
    log(`tracking ${wallets.length} wallet(s)`);
  } catch (err) {
    log("failed to refresh wallet list", err);
  }
}

async function initCursor() {
  const confirmedHead = latestHead - BigInt(config.confirmationDepth);
  const positions = await Promise.all(
    wallets.map(async (w) => {
      const existing = await getLastProcessedBlock(supabase, w.id);
      if (existing !== null) return existing;
      // New wallet, no history: start from just before the current confirmed
      // head rather than genesis — v1 detects going forward, not full backfill.
      const seeded = confirmedHead > 0n ? confirmedHead - 1n : 0n;
      await setLastProcessedBlock(supabase, w.id, seeded);
      return seeded;
    }),
  );

  cursor = positions.length > 0 ? positions.reduce((min, p) => (p < min ? p : min)) : confirmedHead;
  log(`starting cursor at block ${cursor}`);
}

async function runWindows() {
  if (processing || cursor === null || wallets.length === 0) return;
  processing = true;
  try {
    let position = cursor;
    const confirmedHead = latestHead - BigInt(config.confirmationDepth);
    while (confirmedHead - position >= BigInt(config.windowBlocks)) {
      const from = position + 1n;
      const to = position + BigInt(config.windowBlocks);
      await processWindow(supabase, client, config.chainId, wallets, from, to);
      position = to;
      cursor = position;
      log(`processed window [${from}, ${to}]`);
    }
  } catch (err) {
    // Log and keep the process alive — the next cron sweep (Vercel) will
    // reconcile any gap left by a window that failed partway through.
    log("window processing error", err);
  } finally {
    processing = false;
  }
}

async function flushPartialWindow() {
  if (processing || cursor === null || wallets.length === 0) return;
  const position = cursor;
  const confirmedHead = latestHead - BigInt(config.confirmationDepth);
  if (confirmedHead <= position) return;
  processing = true;
  try {
    await processWindow(supabase, client, config.chainId, wallets, position + 1n, confirmedHead);
    log(`flushed partial window [${position + 1n}, ${confirmedHead}]`);
    cursor = confirmedHead;
  } catch (err) {
    log("partial window flush error", err);
  } finally {
    processing = false;
  }
}

async function main() {
  log(`starting Horizon worker on chain ${chain.id} via ${config.wsRpcUrl}`);

  await refreshWallets();
  const head = await client.getBlockNumber();
  latestHead = head;
  await initCursor();

  client.watchBlocks({
    onBlock: (block) => {
      if (block.number !== null) latestHead = block.number;
      void runWindows();
    },
    onError: (err) => log("watchBlocks error", err),
  });

  setInterval(() => void refreshWallets(), config.walletRefreshIntervalMs);
  setInterval(() => void flushPartialWindow(), config.windowFlushIntervalMs);
}

main().catch((err) => {
  // Fail fast and let Railway's process supervisor restart us with a clean
  // state rather than continuing in a possibly-inconsistent condition.
  console.error("[horizon] fatal startup error", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("[horizon] unhandled rejection", err);
  process.exit(1);
});
