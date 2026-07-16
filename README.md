# Meridian

The chain is too fast for second thoughts. Meridian is your second thought, running before you sign.

Consumer-protection layer for Monad (chain ID 143): watches wallets, scores risky on-chain activity deterministically, and lets you act before a mistake settles. Full spec: `meridian-mvp-spec.md`.

## Stack

- Next.js 16 (App Router) + wagmi/viem + RainbowKit, deployed on Vercel
- Supabase (Postgres + Auth via native Sign-In with Ethereum / `signInWithWeb3`)
- Horizon (watcher worker, Railway): `worker/src/index.ts`, WebSocket `newHeads` listener over viem, sharing detection logic with the app via `src/lib/horizon/`
- Anthropic API for Oracle's plain-language explanations only (never scoring)

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase, WalletConnect, RPC values
```

### Supabase

```bash
npx supabase init          # if not already linked
npx supabase link --project-ref <your-project-ref>
npx supabase db push       # applies supabase/migrations/0001_init.sql and 0002_allowlist_composite_key.sql
```

Enable the Web3 Wallet (Ethereum) provider in Dashboard → Authentication → Providers, or via `supabase/config.toml` for local dev (`supabase start`).

### Seed the allowlist

```bash
npm run seed:allowlist                  # live protocols only (default)
npm run seed:allowlist -- --include-non-live
```

Pulls from [monad-crypto/protocols](https://github.com/monad-crypto/protocols) — the "official protocols repo" spec section 5 refers to — for both `mainnet` and `testnet`, flattens each protocol's `addresses` map to one allowlist row per address, and upserts on `(address, chain_id)`. Needs `SUPABASE_SERVICE_ROLE_KEY`. Uses `isAddress(addr, { strict: false })`: the source repo's addresses aren't consistently EIP-55 checksummed, and strict validation was silently dropping ~50 legitimate entries (including all of Chainlink's mainnet oracle feeds) before this was caught — format validity is what matters here, not checksum casing, since everything gets lowercased before storage anyway. Re-run periodically as new protocols are added upstream; it's idempotent.

### Run the app

```bash
npm run dev
```

### Run the Horizon worker

```bash
npm run worker        # or `npm run worker:dev` for auto-restart on change
```

Needs `HORIZON_WS_RPC_URL` (a WebSocket RPC endpoint — Chainstack/QuickNode, not the HTTP one used by the app) plus `SUPABASE_SERVICE_ROLE_KEY`. Defaults to Monad testnet (`HORIZON_CHAIN_ID=10143`); set it to `143` for mainnet. It:

- subscribes to `newHeads`, batches blocks into windows (`HORIZON_WINDOW_BLOCKS`, default 50), and treats a block final after `HORIZON_CONFIRMATION_DEPTH` (default 3) confirmations
- per window, fetches Transfer/Approval logs for all registered wallets (chunked via `LOGS_CHUNK_BLOCKS`) and native + touched-token balances, then upserts a `snapshots` row and advances `sync_state`
- a new wallet with no `sync_state` starts from the current confirmed head, not genesis — v1 detects going forward, it doesn't backfill history
- on any per-window error it logs and keeps running; `POST /api/horizon/sweep` (secret-header-authed, meant to be hit by an external cron every 5 min) is the from-DB-state reconciliation path if the worker itself was down

Deploy this to Railway with start command `npm run worker` — it needs a long-lived process, which is why it can't run on Vercel.

### Run the Oracle rules engine tests

```bash
npm test
```

`src/lib/oracle/rules/` implements R1–R5 (spec section 5) as pure, side-effect-free functions — each takes a plain input object and a partial config override (for the `policies.threshold` overrides) and returns `{ ruleId, score, triggered, details }`. No DB or network access, no LLM in the loop — the explanation layer (Claude) only narrates a score these functions already produced, never computes or adjusts it. Uses Node's built-in test runner (`node:test`), no extra test-framework dependency.

## Security posture

- **Dependencies:** `npm audit` is clean (0 vulnerabilities) as of this scaffold. `package.json` `overrides` force-patch transitive copies of `viem`/`ws`/`postcss`/`uuid` bundled inside WalletConnect/Reown's dependency chain — re-run `npm audit` after any dependency bump, since those overrides pin versions that need revisiting as upstream catches up.
- **RLS:** every wallet-scoped table (`snapshots`, `patterns`, `moments`, `policies`, `sync_state`) is gated on `wallets.user_id = auth.uid()` via a join; only the Horizon/Oracle service-role client bypasses it.
- **Wallet registration ownership check:** `POST /api/wallets` derives the address from the caller's *verified* SIWE identity (`src/lib/auth.ts`, parsed from Supabase's `web3:ethereum:{address}` identity record) and rejects any request where the submitted address doesn't match — a client can't register a wallet it didn't sign for.
- **Input handling:** address format (viem `isAddress`), chain ID allowlist (143/10143 only), label length cap, and a request body size cap are enforced before any DB write.
- **Abuse mitigation:** a per-user cap (10 wallets) stops one account from writing unbounded rows. This is *not* a substitute for real IP/token-bucket rate limiting — add that (e.g. Upstash Ratelimit on the Vercel edge) before mainnet launch.
- **HTTP headers:** CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy` are set in `next.config.mjs`. The CSP's `connect-src`/`frame-src` allowlist for WalletConnect/Reown/Coinbase endpoints is based on their documented relay domains but **has not been exercised against a live wallet-connect flow in a browser** — verify it doesn't block a real connect/sign-in before shipping, and tighten `script-src`/`style-src` further if RainbowKit doesn't need `'unsafe-inline'` in practice.
- **Horizon worker isolation:** the worker only ever holds the Supabase service-role key server-side (Railway env, never shipped to the browser). `POST /api/horizon/sweep` compares its secret header with `crypto.timingSafeEqual` rather than `===`, and only accepts chain IDs 143/10143.
- **Allowlist is chain-scoped:** `allowlist`'s primary key is `(address, chain_id)`, not `address` alone (migration `0002`) — 60 addresses in the real monad-crypto/protocols data exist on *both* mainnet and testnet as unrelated contracts; a single-column key would have let seeding one network silently overwrite the other's `chain_id`. `src/lib/horizon/window.ts`'s allowlist lookup filters by the wallet's own `chain_id` for the same reason — a mainnet-allowlisted address must not suppress the "not allowlisted" signal for a same-address testnet contract.

## Status

Week 1 complete: app scaffold, Supabase schema + RLS, wallet connect + SIWE sign-in, wallet registration (with ownership verification), security headers, and the Horizon worker (WebSocket listener + cron fallback route).

Week 2 in progress: Oracle's R1–R5 rules engine (pure functions, unit tested), allowlist seeding script. Not yet built: Claude explanation layer, Moment creation pipeline (wiring Horizon's `snapshots` into these rule functions), Timeline UI. See `meridian-mvp-spec.md` section 10 for the build plan.
