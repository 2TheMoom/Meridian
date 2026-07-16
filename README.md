# Meridian

The chain is too fast for second thoughts. Meridian is your second thought, running before you sign.

Consumer-protection layer for Monad (chain ID 143): watches wallets, scores risky on-chain activity deterministically, and lets you act before a mistake settles. Full spec: `meridian-mvp-spec.md`.

## Stack

- Next.js 14 (App Router) + wagmi/viem + RainbowKit, deployed on Vercel
- Supabase (Postgres + Auth via native Sign-In with Ethereum / `signInWithWeb3`)
- Horizon (watcher worker, Railway) — not yet scaffolded, see spec section 4
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
npx supabase db push       # applies supabase/migrations/0001_init.sql
```

Enable the Web3 Wallet (Ethereum) provider in Dashboard → Authentication → Providers, or via `supabase/config.toml` for local dev (`supabase start`).

### Run the app

```bash
npm run dev
```

## Status

Week 1 in progress: app scaffold, Supabase schema + RLS, wallet connect + SIWE sign-in, wallet registration. Horizon worker, Oracle rules engine, and Keel actions are not yet built — see `meridian-mvp-spec.md` section 10 for the build plan.
