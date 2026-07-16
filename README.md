# Meridian

**The chain is too fast for second thoughts. Meridian is your second thought, running before you sign.**

Meridian is a consumer-protection layer for [Monad](https://monad.xyz) (chain ID 143). It watches registered wallets, scores risky on-chain activity with a deterministic rules engine, explains that risk in plain language, and lets users act — revoke an approval, acknowledge a pattern, adjust a guardrail — before a mistake settles.

## How it works

| Component | Role |
|---|---|
| **Horizon** | Watcher. A WebSocket worker that subscribes to new blocks on Monad, tracks registered wallets' approvals, transfers, and balances, and writes periodic snapshots. |
| **Oracle** | Regret engine. A deterministic rules engine (R1–R5) scores each snapshot; Claude narrates the score in plain language but never computes or sees it. |
| **Keel** | Protection. Notify (email), Confirm (one-tap on-chain actions like revoking an approval), and — in v1.1 — Hold (a spend-cap smart contract). |
| **Meridian** | The product surface: Timeline, Guardrails, and Moment views. |

## Features

- Sign-In with Ethereum (SIWE) via Supabase Auth — no email/password
- Wallet registration with cryptographic ownership verification
- Real-time approval and transfer monitoring via WebSocket block subscription
- Deterministic risk scoring: risky approvals, velocity spikes, recurring payments, first-touch contracts, and balance floor breaches
- Contract-age (on-chain, via `eth_getCode` binary search) and source-verification (block explorer API) enrichment for newly-touched contracts
- Plain-language risk explanations via Claude, constrained to a two-part, restraint-oriented format
- USD-normalized spend tracking via a CoinGecko-backed price cache
- One-tap approval revocation, verified on-chain rather than client-trusted
- `MeridianKeel.sol` — an optional daily spend-cap vault contract (Hold tier), first draft with a full test suite, not yet audited
- Email notifications via Resend
- Per-rule guardrail configuration (tier + thresholds)
- Allowlist seeded from Monad's official protocols registry

## Tech stack

- **App:** Next.js 16 (App Router), TypeScript, Tailwind CSS — deployed on Vercel
- **Chain:** wagmi + viem, RainbowKit for wallet connection
- **Contracts:** Solidity, Foundry (`contracts/`)
- **Data:** Supabase (Postgres, Auth, Row Level Security)
- **Worker:** Node.js WebSocket listener (Horizon) — deployed on Railway
- **LLM:** Anthropic API (Claude Sonnet 5), explanations only
- **Pricing:** CoinGecko API
- **Explorer data:** Etherscan V2 multichain API (serves monadscan.com)
- **Email:** Resend

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project
- A Monad RPC endpoint (HTTP and WebSocket)

### Installation

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` — see [Environment variables](#environment-variables).

### Database setup

```bash
npx supabase init
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Enable the Web3 Wallet (Ethereum) provider under Dashboard → Authentication → Providers.

### Seed the allowlist

```bash
npm run seed:allowlist
```

Pulls known Monad protocol addresses from [monad-crypto/protocols](https://github.com/monad-crypto/protocols) into the `allowlist` table, per network. Idempotent — safe to re-run.

### Run the app

```bash
npm run dev
```

### Run the Horizon worker

```bash
npm run worker
```

Requires a WebSocket RPC endpoint and additional environment variables (see below). Deploy to a host that supports long-lived processes (e.g. Railway) — it cannot run on Vercel's serverless functions.

### Run tests

```bash
npm test
```

### Contracts (MeridianKeel.sol)

```bash
cd contracts
forge build
forge test
forge coverage --report summary
```

To deploy (Monad mainnet — no testnet stage; keystore-based, never a plaintext private key — see [`contracts/README.md`](./contracts/README.md)):

```bash
cd contracts
cp .env.example .env   # MONAD_RPC_URL, ETHERSCAN_API_KEY
cast wallet import meridian-deployer --interactive
forge script script/DeployMeridianKeel.s.sol --rpc-url monad --broadcast --account meridian-deployer --verify
```

First draft, not yet audited — see [`contracts/README.md`](./contracts/README.md) for exactly what has and hasn't been verified.

## Environment variables

See `.env.example` for the full list with defaults. Grouped by area:

| Area | Variables |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Wallet connect | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` |
| Monad RPC | `NEXT_PUBLIC_MONAD_RPC_URL`, `NEXT_PUBLIC_MONAD_TESTNET_RPC_URL` (+ explorer URLs) |
| Horizon worker | `HORIZON_CHAIN_ID`, `HORIZON_WS_RPC_URL`, `MERIDIAN_APP_URL`, `ORACLE_EXPLAIN_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` |
| Cron fallback | `HORIZON_SWEEP_SECRET` |
| Oracle / Claude | `ANTHROPIC_API_KEY`, `ORACLE_EXPLAIN_SECRET`, `ORACLE_DAILY_MOMENT_CAP` |
| Price cache | `COINGECKO_API_KEY` (optional — raises CoinGecko rate limits) |
| Explorer verification | `ETHERSCAN_API_KEY` (optional — without it, R4's verification signal is "unknown," never "unverified") |
| Notifications | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |

## Project structure

```
src/
  app/                Next.js routes (pages + API)
    timeline/          Timeline screen
    guardrails/         Guardrails screen
    api/                 API routes
  components/          UI components (MomentCard, RevokeButton, ...)
  lib/
    horizon/             Block-window processing, decimals, outflow calc,
                          recurring-payment detection, contract-age/
                          verification lookups
    oracle/              Rules engine, explanation layer, Moment pipeline
    pricing/             CoinGecko price cache
    notifications/       Resend email
    supabase/            Client factories (browser, user-scoped, service role)
worker/                 Horizon worker entrypoint (Railway)
contracts/              MeridianKeel.sol (Foundry) — Hold tier, not yet audited
scripts/                One-off scripts (allowlist seeding)
supabase/migrations/    SQL migrations
```

## API routes

| Route | Purpose |
|---|---|
| `POST /api/wallets` | Register a wallet (ownership-verified via SIWE identity) |
| `GET /api/wallets` | List the caller's registered wallets |
| `PATCH /api/wallets/:id` | Update wallet settings (e.g. notification email) |
| `GET /api/timeline?wallet=` | Fetch a wallet's Moments, newest first |
| `GET/PATCH /api/moments/:id` | Read or update a Moment's status (`acked`/`dismissed`) |
| `POST /api/moments/:id/revoke` | Verify and record an on-chain approval revocation |
| `GET/PUT /api/policies?wallet=` | Read or update guardrail configuration |
| `POST /api/oracle/explain` | Internal — Claude explanation layer |
| `POST /api/horizon/sweep` | Internal — cron-triggered backfill for the Horizon worker |

## Security

- **Row Level Security** on every user-scoped table (`wallets`, `snapshots`, `moments`, `policies`, `patterns`, `transfers`, `sync_state`); only service-role clients (Horizon, Oracle) bypass it.
- **Wallet ownership is cryptographically verified** — registration derives the wallet address from the caller's verified SIWE identity, never from client input.
- **Oracle's score never reaches the LLM.** Claude receives only raw rule inputs and returns plain-language text; it cannot see, compute, or influence a Moment's numeric score.
- **On-chain actions are independently verified.** Approval revocations are confirmed by fetching and decoding the transaction from-chain before a Moment is marked resolved — a client's claim alone is never trusted.
- **Internal-only routes** (`/api/oracle/explain`, `/api/horizon/sweep`) require a shared secret compared with `crypto.timingSafeEqual`.
- **Chain-scoped caches.** The allowlist and price cache are keyed by `(address, chain_id)` / `(key, chain_id)`, not by address alone, since the same address can be an unrelated contract on a different network.
- **Security headers** (CSP, HSTS, X-Frame-Options, Permissions-Policy) are set on all responses.
- `npm audit` is clean; dependency overrides pin several transitive packages to patched versions.
- **`MeridianKeel.sol`** follows checks-effects-interactions throughout and has a reentrancy guard shared across every fund-moving function, 100% branch coverage in its test suite, and no owner path to user funds. It is a first draft, not an audited contract — see [`contracts/README.md`](./contracts/README.md) for exactly what has and hasn't been verified.

Known limitations: no IP/token-bucket rate limiting yet (only a per-user wallet cap); the CSP has not been exercised against a live wallet-connect flow in a browser; R4's contract-age lookup needs an archive-capable RPC endpoint to be reliable (falls back to "unknown" otherwise, never guesses).

## Status

**Implemented:** wallet registration, SIWE auth, the Horizon worker, Oracle's rules engine (R1–R5, all five now producing real Moments), the Claude explanation layer, the Moment creation pipeline, Timeline UI, Guardrails UI, the price cache, Confirm-tier revoke, email notifications, the daily Moment cap, and `MeridianKeel.sol` (unaudited first draft).

**Partial:**
- R2 (velocity spike) is live on mainnet only — there's no real market for testnet tokens to price against.
- R5 (floor breach) detects actual breaches; the 7-day projected-breach forecast isn't computed yet.
- R4's value-ratio bonus stays at 0 — native-value-bearing first-touch calls aren't detectable yet (Horizon only watches ERC-20 Transfer/Approval logs, not raw call data).
- R3's recurring-payment detection only covers ERC-20 transfers — native MON transfers emit no logs, so there's no recipient to match against.

**Planned (v1.1):**
- `MeridianKeel.sol`'s public self-audit, testnet deployment, then mainnet — the contract exists, the audit doesn't.
- Telegram notifications.
- NFT approval monitoring (R6).
