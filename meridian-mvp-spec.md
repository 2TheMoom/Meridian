# Meridian — Full MVP Specification (Monad)

**Tagline:** The chain is too fast for second thoughts. Meridian is your second thought, running before you sign.

**Mission:** Reduce financial regret by preventing costly on-chain mistakes before they settle. Monad finalizes in ~800ms; mistakes are irreversible in under a second. Meridian is proactive care for future-you.

**Chain:** Monad Mainnet, chain ID 143 (testnet for staging). EVM bytecode compatible; standard Solidity, wagmi/viem, Foundry all work unchanged.

---

## 1. System Overview

| Component | Role | v1 Form |
|---|---|---|
| **Meridian** | The platform / user experience | Next.js 14 web app on Vercel |
| **Horizon** | Autonomous watcher agent | WebSocket block listener + cron fallback (Node worker) |
| **Oracle** | Intelligence / regret scoring | Deterministic rules engine + Claude explanation layer |
| **Keel** | Protection / intervention engine | Notify + Confirm tiers at launch; Hold tier via MeridianKeel.sol in v1.1 |

Flow: `User activity → Horizon observes → Oracle scores + explains → Keel intervenes per policy → Meridian surfaces it`

**v1 trust posture:** Meridian never takes custody. Keel v1 advises and prepares transactions; the user always signs. Hold tier (v1.1) uses a capped, user-funded policy contract audited in public before launch.

---

## 2. Stack

- **Frontend/API:** Next.js 14 (App Router), Vercel, wagmi + viem (chain 143 config), RainbowKit or ConnectKit for wallet connect
- **Backend data:** Supabase (Postgres + Auth). Auth = Sign-In With Ethereum (SIWE) mapped to Supabase user
- **Horizon worker:** Node.js long-running WebSocket listener. Host on Railway (Vercel serverless can't hold sockets). Cron fallback via cron-job.org hitting a Vercel API route every 5 min
- **RPC:** Paid-tier or generous free-tier provider required. Candidates: QuickNode (getLogs capped at 5 blocks on free trial, 10,000 blocks paid), Chainstack (free tier + WebSocket support), Tatum (has native transaction-event notifications that can replace some polling). Recommendation: Chainstack free tier for dev, upgrade one provider before mainnet launch; keep a second as fallback in env
- **Contracts (v1.1):** Foundry. Zero contracts in v1
- **Notifications:** Email via Resend (v1). Telegram bot as fast-follow (you have the GhostPay bot pattern)
- **LLM:** Anthropic API for Oracle explanations only (never for scoring)

---

## 3. Monad-Specific Engineering Notes

1. **Block cadence:** ~0.4s blocks, ~0.8s finality, up to 10k TPS. A 5-minute window ≈ 750 blocks/min ≈ 3,750 blocks. Poll-only design burns RPC quota fast; WebSocket-first is the correct architecture.
2. **eth_getLogs limits vary by provider tier.** Build chunk size as an env var (`LOGS_CHUNK_BLOCKS`, default 500). Reuse the CeloSense chunked pagination pattern.
3. **RPC behavior differences:** QuickNode warns some methods behave differently on Monad than Ethereum due to architectural differences. Validate getLogs ordering, block tags, and receipt fields on testnet before trusting diff logic.
4. **Finality:** ~800ms single-slot finality means no reorg-handling complexity is needed beyond 1–2 block confirmation depth. Treat blocks as final after 3 blocks for safety.
5. **Ecosystem freshness:** most contracts are weeks/months old. Oracle's contract-age signal is high-value here but needs an allowlist seeded from Monad's official protocols repo to avoid crying wolf on legitimate blue chips.

---

## 4. Horizon — The Watcher

### Architecture
- **Primary:** WebSocket `newHeads` subscription. Batch incoming blocks into windows of N blocks (default 50, ~20s of chain time). Per window: one `eth_getLogs` for Transfer + Approval events filtered to registered wallet addresses (as topic participants), plus native balance checks via `eth_getBalance` at window close.
- **Fallback:** cron every 5 min compares `last_processed_block` in DB vs chain head; backfills any gap in chunks.
- **State:** every window writes a snapshot row; processing is idempotent (upsert on `(wallet, block_range)`).

### What Horizon detects (v1)
1. **Approval changes** — new/modified ERC-20 approvals (Approval event where owner = registered wallet). Flag: unlimited (`type(uint256).max` or > 10x wallet balance of that token), and approvals to contracts not on allowlist.
2. **Outgoing transfers** — native MON + ERC-20 out. Feeds velocity and floor checks.
3. **Recurring payments** — same recipient, amount within ±10%, interval regularity ±20%, ≥2 occurrences. Creates a `pattern` row; user can ack as intentional.
4. **Spend velocity** — rolling 7d and 30d outflow (USD-normalized via a price feed; v1 can use a simple CoinGecko cache for MON + top Monad tokens).
5. **Balance floor breach** — wallet balance (native or per-token) drops below user-set floor.
6. **First-touch contracts** — wallet interacts with a contract address never seen in its history, with value or approval attached.

### Non-goals (v1)
- Mempool interception (Monad's speed makes pre-confirmation racing unrealistic for an MVP anyway; the honest v1 story is fast *post-confirmation* detection + *pre-signature* protection via Keel policies)
- NFT approvals (v1.1)
- Multi-chain

---

## 5. Oracle — The Regret Engine

### Design principle
Scoring is **deterministic and auditable**. The LLM only writes the explanation. This is the trust story: "Oracle's rules are open; the AI just translates them into plain language."

### Rules (each yields 0–100, thresholds configurable in `policies`)

| ID | Signal | Base score logic |
|---|---|---|
| R1 | Risky approval | Unlimited approval = 70. +15 if contract age < 14 days. +15 if not on allowlist. Capped 100 |
| R2 | Velocity spike | 7d outflow vs trailing 30d baseline: >2x = 50, >4x = 75, >8x = 95 |
| R3 | Unacked recurring payment | 40 flat; +20 if amount trending upward across occurrences |
| R4 | First-touch contract w/ value | 30 base; +20 if value > 5% of wallet; +25 if contract age < 7 days; +15 if unverified source on explorer |
| R5 | Floor breach | 60 if projected breach within 7d at current velocity; 90 on actual breach |

Score ≥ threshold (default 50) creates a **Moment**.

### Explanation layer
One Claude API call per Moment. System prompt constraint: exactly two parts, ≤ 2 sentences each — (a) why this looks regrettable in plain language, (b) the safer alternative. Input: rule fired, raw values, wallet context summary. Output stored in `moments.oracle_text`. Never let the LLM see or alter scores.

**Islamic-finance alignment (product principle):** Oracle's "safer alternative" suggestions are restraint-oriented only — revoke, pause, cap, wait. It never suggests leverage, yield-chasing, or speculative repositioning. This is a stated design principle on the landing page.

### Allowlist
`allowlist` table seeded from Monad's official protocols repo (name, address, category, added_at). Manually curated at launch; community submissions later.

---

## 6. Keel — The Protection Engine

### v1 tiers (no contracts)
- **Notify:** email (Resend) + in-app Moment. Immediate on Moment creation.
- **Confirm:** Notify + a prepared action the user can execute in one tap:
  - Revoke approval → prebuilt `approve(spender, 0)` tx via wagmi `useWriteContract`
  - Ack recurring payment → marks pattern intentional, suppresses future R3
  - Snooze → suppress this rule for this counterparty for 30d
- Per-category tier config lives in `policies` (categories map to rules R1–R5).

### v1.1: MeridianKeel.sol — the Hold tier
Monad has no native spend-permission primitive (unlike Base), so Hold requires a contract. Deliberately brutal scope:

- **One policy type:** daily spend cap per wallet, denominated in one token (MON first, then USDC).
- User deposits budget into their own vault position in MeridianKeel; day-to-day spends route through it; anything within cap executes instantly; anything over cap queues with a **24-hour timelock**, cancelable by the user.
- **Cap increases are also timelocked 24h** (the anti-impulse mechanic — this IS the product).
- Emergency full withdrawal: always available, but itself behind a 12h delay with email alert (drainer resistance).
- No admin keys over user funds. Owner can only update the allowlist pointer and pause new deposits.
- Target: ~150–200 lines, Foundry test suite, your own four-gate audit pass published as a thread before mainnet deploy.

**Build-in-public arc:** "I audit protocols for a living. Now I'm auditing my own protection contract before I ask you to trust it." Spec thread → invariant tests thread → self-audit findings thread → testnet → mainnet. This is where the auditor brand and builder brand compound.

---

## 7. Meridian — The Platform (UI)

Three screens. No more.

1. **Timeline** — reverse-chron feed of Horizon observations. Moments render as cards: rule badge, score, Oracle's two-sentence explanation, Keel action buttons. Quiet days show a calm "all clear" state (the product must feel like care, not alarm fatigue — cap Moments surfaced per day, collapse duplicates).
2. **Guardrails** — policy config: per-rule tier (Notify/Confirm/off), thresholds (floor amounts, velocity multiplier), acked recurring payments list, snoozed counterparties.
3. **Moment view** — deep view of one flagged event: the transaction(s), Oracle reasoning, counterparty info (age, allowlist status, explorer link), actions.

**Visual identity:** the time/trajectory metaphor. Suggested: deep navy field, a single horizon-line motif, warm amber for Moments (not red — regret prevention, not danger sirens), crimson reserved for score ≥ 85 only. Barlow Condensed headings, JetBrains Mono for addresses/amounts. No em dashes in copy.

---

## 8. Data Model (Supabase)

```sql
-- users handled by Supabase Auth (SIWE)

create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  address text not null,
  chain_id int not null default 143,
  label text,
  created_at timestamptz default now(),
  unique (user_id, address, chain_id)
);

create table snapshots (
  id bigint generated always as identity primary key,
  wallet_id uuid references wallets not null,
  from_block bigint not null,
  to_block bigint not null,
  approvals jsonb not null default '[]',
  balances jsonb not null default '{}',
  outflow_usd numeric default 0,
  created_at timestamptz default now(),
  unique (wallet_id, from_block, to_block)
);

create table patterns (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets not null,
  type text not null check (type in ('recurring','velocity_baseline','floor')),
  params jsonb not null,
  user_ack boolean default false,
  created_at timestamptz default now()
);

create table moments (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets not null,
  rule_id text not null,          -- R1..R5
  score int not null,
  context jsonb not null,          -- raw values fed to Oracle
  oracle_text text,
  status text not null default 'open'
    check (status in ('open','acked','acted','dismissed','snoozed')),
  tx_ref text,
  created_at timestamptz default now()
);

create table policies (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets not null,
  rule_id text not null,
  tier text not null default 'notify'
    check (tier in ('off','notify','confirm')),  -- 'hold' added in v1.1
  threshold jsonb not null default '{}',
  unique (wallet_id, rule_id)
);

create table allowlist (
  address text primary key,
  chain_id int not null default 143,
  name text not null,
  category text,
  source text default 'monad-protocols-repo',
  added_at timestamptz default now()
);

create table sync_state (
  wallet_id uuid primary key references wallets,
  last_processed_block bigint not null default 0,
  updated_at timestamptz default now()
);
```

Row Level Security on everything keyed to `user_id` via wallet join; Horizon worker uses the service role key.

---

## 9. API Surface (Next.js routes)

- `POST /api/wallets` — register wallet (SIWE-verified ownership)
- `GET /api/timeline?wallet=` — snapshots + moments merged
- `GET /api/moments/:id` / `PATCH` — status transitions
- `GET|PUT /api/policies?wallet=` — guardrail config
- `POST /api/patterns/:id/ack` — acknowledge recurring payment
- `POST /api/horizon/sweep` — cron fallback entry (secret header auth)
- `POST /api/oracle/explain` — internal, worker → Claude API (never client-callable)

Worker (Railway) talks to Supabase directly, not through these routes.

---

## 10. Build Plan (4 weeks solo, Windows/Git Bash/VS Code)

**Week 1 — Foundation + Horizon core**
Supabase project (EU West), schema migrations, SIWE auth, wallet registration UI. Horizon worker: WebSocket newHeads on Monad testnet, block batching, approval + transfer log parsing, snapshot writes, sync_state, cron fallback route. Validate getLogs behavior quirks on testnet.

**Week 2 — Oracle + Timeline**
Rules engine R1–R5 as pure functions with unit tests. Allowlist seeding script from Monad protocols repo. Claude explanation layer. Moment creation pipeline. Timeline UI with Moment cards. First X post: introduce Meridian, tag Monad ecosystem accounts.

**Week 3 — Keel v1 + Guardrails**
Resend email notifications. Confirm tier: one-tap revoke flow (wagmi write), ack/snooze actions. Guardrails screen. Price cache for USD normalization. Alarm-fatigue controls (daily Moment cap, dedupe).

**Week 4 — Mainnet + launch**
Switch worker to mainnet RPC (paid/verified tier), register first real wallets (your own), 3–5 days of live soak, fix signal noise. Landing page. Launch thread. Begin MeridianKeel.sol spec thread (v1.1 arc).

**v1.1 (weeks 5–8):** MeridianKeel.sol build + public self-audit + testnet + mainnet Hold tier. Telegram notifications. NFT approvals (R6).

---

## 11. Positioning & Ecosystem Strategy

- **Core line:** "Monad settles in under a second. Meridian is the pause button the chain doesn't have."
- **Why Monad needs this:** young ecosystem = unaudited contracts everywhere, speed = no reaction window, and no incumbent safety layer (Base has revoke.cash mindshare; Monad's slot is open). A consumer-protection tool de-risks the whole ecosystem, which is exactly what L1 foundations fund.
- **Ecosystem motion:** apply to Monad builder programs/hackathons immediately with the v1; the MeridianKeel public self-audit is the differentiated grant narrative (security researcher building consumer protection).
- **Content:** weekly build-in-public thread. Milestones: intro, Horizon live on testnet, Oracle rules explained (educational thread on approval risk — evergreen content), mainnet launch, Keel audit series.
- **Honest claims only:** v1 detects fast and prevents at the policy layer; it does not front-run confirmed transactions. Never market mempool-speed interception you don't have — the audience that matters will check.

## 12. Success Metrics (first 60 days)

- 100 registered wallets
- ≥ 25 revocations executed through Confirm tier (the "regret prevented" number — this is the metric you tweet)
- Moment false-positive rate < 30% (measured by dismiss rate); tune thresholds against it
- 1 ecosystem grant application submitted with live product attached

## 13. Explicit v1 Cuts

Fiat/bank data · multi-chain · mempool interception · ML personalization · social/leaderboards · token · mobile app · NFT approvals · DeFi position monitoring. Each is a roadmap post, not a feature.
