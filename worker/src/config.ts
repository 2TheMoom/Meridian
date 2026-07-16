function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  chainId: Number(process.env.HORIZON_CHAIN_ID ?? 10143), // testnet by default; set 143 for mainnet
  wsRpcUrl: requireEnv("HORIZON_WS_RPC_URL"),
  wsRpcUrlFallback: process.env.HORIZON_WS_RPC_URL_FALLBACK,
  windowBlocks: Number(process.env.HORIZON_WINDOW_BLOCKS ?? 50),
  confirmationDepth: Number(process.env.HORIZON_CONFIRMATION_DEPTH ?? 3),
  windowFlushIntervalMs: Number(process.env.HORIZON_WINDOW_FLUSH_MS ?? 30_000),
  walletRefreshIntervalMs: Number(process.env.HORIZON_WALLET_REFRESH_MS ?? 60_000),
};
