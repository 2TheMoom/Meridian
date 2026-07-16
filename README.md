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

Needs `HORIZON_WS_RPC_URL` (a WebSocket RPC endpoint — Chainstack/QuickNode, not the HTTP one used by the app), `SUPABASE_SERVICE_ROLE_KEY`, `MERIDIAN_APP_URL`, and `ORACLE_EXPLAIN_SECRET` (the worker calls the app's `/api/oracle/explain` for narration rather than holding `ANTHROPIC_API_KEY` itself — see below). Defaults to Monad testnet (`HORIZON_CHAIN_ID=10143`); set it to `143` for mainnet. It:

- subscribes to `newHeads`, batches blocks into windows (`HORIZON_WINDOW_BLOCKS`, default 50), and treats a block final after `HORIZON_CONFIRMATION_DEPTH` (default 3) confirmations
- per window, fetches Transfer/Approval logs for all registered wallets (chunked via `LOGS_CHUNK_BLOCKS`) and native + touched-token balances, then upserts a `snapshots` row and advances `sync_state`
- after each snapshot write, runs the Moment pipeline against it (see below) before moving to the next window
- a new wallet with no `sync_state` starts from the current confirmed head, not genesis — v1 detects going forward, it doesn't backfill history
- on any per-window error it logs and keeps running; `POST /api/horizon/sweep` (secret-header-authed, meant to be hit by an external cron every 5 min) is the from-DB-state reconciliation path if the worker itself was down

Deploy this to Railway with start command `npm run worker` — it needs a long-lived process, which is why it can't run on Vercel.

### Run the Oracle rules engine tests

```bash
npm test
```

`src/lib/oracle/rules/` implements R1–R5 (spec section 5) as pure, side-effect-free functions — each takes a plain input object and a partial config override (for the `policies.threshold` overrides) and returns `{ ruleId, score, triggered, details }`. No DB or network access, no LLM in the loop — the explanation layer (Claude) only narrates a score these functions already produced, never computes or adjusts it. Uses Node's built-in test runner (`node:test`), no extra test-framework dependency.

### Oracle's explanation layer

`POST /api/oracle/explain` (internal only, `x-oracle-secret` header auth, never client-callable) calls Claude Sonnet 5 to narrate a Moment a rules-engine call already scored. `src/lib/oracle/explain.ts` is the core:

- **The score never reaches the model.** `ExplanationInput` has no field for it — the caller passes `ruleId` + `details` (the rule's raw inputs) only, not the `RuleResult.score`. This is enforced by the type, not just an instruction.
- **Structured output** (`output_config.format: json_schema`) forces the exact `{ why, saferAlternative }` two-part shape the spec requires, rather than parsing prose.
- **Restraint-only guardrail:** a regex backstop (`violatesRestraintPrinciple`) checks the response for leverage/yield-farming/hedging/repositioning language or em dashes before it's trusted — on a match (or an API failure, a refusal, or a malformed response) it falls back to a deterministic, on-brand template per rule ID, so a Moment always gets `oracle_text` populated. Tested in `explain.test.ts` without hitting the network.
- Uses `thinking: {type: "disabled"}` and `effort: "low"` — this is a short, bounded, templated narration task, not one that benefits from extended reasoning.

### Moment creation pipeline

`src/lib/oracle/pipeline.ts` (`createMomentsFromSnapshot`) is what turns a Horizon snapshot into `moments` rows: it evaluates all five rules, checks each wallet's `policies` row (tier + an optional `threshold.momentThreshold` override — `off` suppresses the rule entirely, otherwise the default cutoff is 50), dedupes against existing moments, calls the explanation layer, and inserts. It's called automatically from `horizon/window.ts` right after every snapshot upsert (worker and cron-sweep paths both wire it in — the worker passes an HTTP explain client so it never needs `ANTHROPIC_API_KEY`, the sweep route calls the explanation layer in-process since it already runs inside the app).

**Honest status per rule** — not every rule can produce real Moments yet, because the upstream data isn't all there:

| Rule | Status | Why |
|---|---|---|
| R1 (risky approval) | **Live** | Unlimited/allowlist flags come straight off the snapshot Horizon already computes. Contract-age bonus is unavailable (no explorer integration yet), so R1 fires correctly off the other two signals alone. |
| R5 (floor breach) | **Live for actual breaches** | Compares snapshot balance to `policies.threshold.floorNative`. "Projected breach within 7d" needs velocity data (see R2) and is always `false` for now. |
| R2 (velocity spike) | **Wired, inert** | `snapshots.outflow_usd` is always 0 until the Week 3 price cache lands — the pipeline aggregates 7d/30d outflow correctly, it's just summing zeros. Activates automatically once USD normalization exists. |
| R3 (unacked recurring payment) | **Wired, inert** | Evaluates whatever `patterns` rows exist, but Horizon doesn't yet detect recurring payments and write them (spec section 4, point 3). Activates once that detection is built. |
| R4 (first-touch contract) | **Wired, mostly inert** | "First touch" is computed correctly (never seen this spender in an earlier snapshot for this wallet), but value-ratio, contract-age, and explorer-verification bonuses are all unavailable, so R4 only ever reaches its 30-point base score — below the default 50-point threshold. Also approval-gated only: a native-value-bearing call to a new contract isn't detectable yet (Horizon only watches ERC-20 Transfer/Approval logs, not call data). |

Dedup strategy varies by rule shape: R1/R4 key on `tx_ref` (one Moment per approval transaction), R2/R3/R5 key on "no other open Moment for this (wallet, rule)" so a sustained condition doesn't spam a new Moment every ~20-second window.

**Known scaling limitation:** the pipeline issues several sequential Supabase queries per wallet per window (policy lookups, dedup checks, a prior-snapshots scan for R4). Fine at v1 scale; worth batching or caching before this runs against hundreds of wallets on 20-second windows.

### Timeline UI

`/timeline` (`src/app/timeline/page.tsx`) is the reverse-chron feed from spec section 7: fetches the signed-in user's wallets and moments via the two new routes below, groups moments by calendar day, and shows a calm "All clear" state whenever there are no *open* moments — history with only acked/dismissed moments doesn't read as an alert. `MomentCard` renders the rule badge, score, Oracle's two-part explanation, and Acknowledge/Dismiss actions; amber by default, crimson only at score ≥ 85 per the spec's visual identity (not a Keel-severity color, an Oracle-severity one). Headings use Barlow Condensed and addresses use JetBrains Mono, both loaded via `next/font/google` in `layout.tsx` (previously declared as CSS variables with no font actually wired up — fixed here).

New routes, both RLS-scoped to the caller's own wallets:

- `GET /api/timeline?wallet=<walletId>` — up to 100 moments, newest first
- `GET /api/moments/:id` / `PATCH /api/moments/:id` — single moment; PATCH only accepts `acked` or `dismissed` (not `acted`, which is reserved for Keel actually executing an on-chain remediation in v1.1, or `open`, the only creation state) — the client can never claim a remediation happened without one occurring)

**What's explicitly not wired up yet:** R1 moments show a "Revoke (coming soon)" button, disabled rather than omitted, so the intended future action is visible — but it's not connected to a transaction. Keel's Confirm tier (one-tap revoke via `wagmi useWriteContract`) is Week 3 scope. Snooze (suppress a rule for a counterparty for 30 days, per spec section 6) isn't in the action set either — the DB status enum supports it, but Oracle's dedup logic doesn't yet check for it, so shipping the button would be a UI action that silently does less than it implies.

**Verification:** typecheck, full build, and `npm audit` all pass. I started the dev server and confirmed both `/` and `/timeline` return 200 and render their expected server-side HTML shell (including the font/color classes). I do not have browser automation tooling in this environment, so the interactive parts — wallet connect, sign-in, the Moment card actions actually PATCHing, the day-grouping and all-clear logic against real data — have not been exercised in a live browser and should be checked before shipping.

## Security posture

- **Dependencies:** `npm audit` is clean (0 vulnerabilities) as of this scaffold. `package.json` `overrides` force-patch transitive copies of `viem`/`ws`/`postcss`/`uuid` bundled inside WalletConnect/Reown's dependency chain — re-run `npm audit` after any dependency bump, since those overrides pin versions that need revisiting as upstream catches up.
- **RLS:** every wallet-scoped table (`snapshots`, `patterns`, `moments`, `policies`, `sync_state`) is gated on `wallets.user_id = auth.uid()` via a join; only the Horizon/Oracle service-role client bypasses it.
- **Wallet registration ownership check:** `POST /api/wallets` derives the address from the caller's *verified* SIWE identity (`src/lib/auth.ts`, parsed from Supabase's `web3:ethereum:{address}` identity record) and rejects any request where the submitted address doesn't match — a client can't register a wallet it didn't sign for.
- **Input handling:** address format (viem `isAddress`), chain ID allowlist (143/10143 only), label length cap, and a request body size cap are enforced before any DB write.
- **Abuse mitigation:** a per-user cap (10 wallets) stops one account from writing unbounded rows. This is *not* a substitute for real IP/token-bucket rate limiting — add that (e.g. Upstash Ratelimit on the Vercel edge) before mainnet launch.
- **HTTP headers:** CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy` are set in `next.config.mjs`. The CSP's `connect-src`/`frame-src` allowlist for WalletConnect/Reown/Coinbase endpoints is based on their documented relay domains but **has not been exercised against a live wallet-connect flow in a browser** — verify it doesn't block a real connect/sign-in before shipping, and tighten `script-src`/`style-src` further if RainbowKit doesn't need `'unsafe-inline'` in practice.
- **Horizon worker isolation:** the worker only ever holds the Supabase service-role key server-side (Railway env, never shipped to the browser). `POST /api/horizon/sweep` compares its secret header with `crypto.timingSafeEqual` rather than `===`, and only accepts chain IDs 143/10143.
- **Allowlist is chain-scoped:** `allowlist`'s primary key is `(address, chain_id)`, not `address` alone (migration `0002`) — 60 addresses in the real monad-crypto/protocols data exist on *both* mainnet and testnet as unrelated contracts; a single-column key would have let seeding one network silently overwrite the other's `chain_id`. `src/lib/horizon/window.ts`'s allowlist lookup filters by the wallet's own `chain_id` for the same reason — a mainnet-allowlisted address must not suppress the "not allowlisted" signal for a same-address testnet contract.
- **`POST /api/oracle/explain` is internal only** (secret header, `crypto.timingSafeEqual`, same pattern as the sweep route — factored into `src/lib/internalAuth.ts`). It never receives a Moment's numeric score, so even a fully compromised Anthropic API key or a prompt-injected response can't leak or spoof scoring — the rules engine's output is the sole source of truth for that.

## Status

Week 1 complete: app scaffold, Supabase schema + RLS, wallet connect + SIWE sign-in, wallet registration (with ownership verification), security headers, and the Horizon worker (WebSocket listener + cron fallback route).

Week 2 complete: Oracle's R1–R5 rules engine (pure functions, unit tested), allowlist seeding script, Claude explanation layer, Moment creation pipeline (R1 and R5-actual-breach live; R2/R3/R4 wired but waiting on upstream data — see table above), Timeline UI (server-rendering verified, not yet exercised interactively in a browser).

Week 3 next per the build plan: Keel v1 (Resend notifications, Confirm-tier one-tap revoke), Guardrails screen, price cache for USD normalization (which will also activate R2), alarm-fatigue controls (daily Moment cap, dedupe). See `meridian-mvp-spec.md` section 10.
