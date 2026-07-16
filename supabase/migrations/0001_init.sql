-- Meridian v1 schema (spec section 8).
-- users are handled by Supabase Auth (Sign-In with Ethereum via signInWithWeb3).

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
  type text not null check (type in ('recurring', 'velocity_baseline', 'floor')),
  params jsonb not null,
  user_ack boolean default false,
  created_at timestamptz default now()
);

create table moments (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets not null,
  rule_id text not null, -- R1..R5
  score int not null,
  context jsonb not null, -- raw values fed to Oracle
  oracle_text text,
  status text not null default 'open'
    check (status in ('open', 'acked', 'acted', 'dismissed', 'snoozed')),
  tx_ref text,
  created_at timestamptz default now()
);

create table policies (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets not null,
  rule_id text not null,
  tier text not null default 'notify'
    check (tier in ('off', 'notify', 'confirm')), -- 'hold' added in v1.1
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

-- Row Level Security: every wallet-scoped table is keyed to auth.uid() via
-- the wallets.user_id column. The Horizon/Oracle worker bypasses all of this
-- using the service role key (see src/lib/supabase/server.ts).

alter table wallets enable row level security;
alter table snapshots enable row level security;
alter table patterns enable row level security;
alter table moments enable row level security;
alter table policies enable row level security;
alter table allowlist enable row level security;
alter table sync_state enable row level security;

create policy "wallets: owner full access" on wallets
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "snapshots: owner read" on snapshots
  for select
  using (exists (
    select 1 from wallets w where w.id = snapshots.wallet_id and w.user_id = auth.uid()
  ));

create policy "patterns: owner read" on patterns
  for select
  using (exists (
    select 1 from wallets w where w.id = patterns.wallet_id and w.user_id = auth.uid()
  ));

create policy "patterns: owner ack" on patterns
  for update
  using (exists (
    select 1 from wallets w where w.id = patterns.wallet_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from wallets w where w.id = patterns.wallet_id and w.user_id = auth.uid()
  ));

create policy "moments: owner read" on moments
  for select
  using (exists (
    select 1 from wallets w where w.id = moments.wallet_id and w.user_id = auth.uid()
  ));

create policy "moments: owner status update" on moments
  for update
  using (exists (
    select 1 from wallets w where w.id = moments.wallet_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from wallets w where w.id = moments.wallet_id and w.user_id = auth.uid()
  ));

create policy "policies: owner full access" on policies
  for all
  using (exists (
    select 1 from wallets w where w.id = policies.wallet_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from wallets w where w.id = policies.wallet_id and w.user_id = auth.uid()
  ));

create policy "allowlist: readable by any authenticated user" on allowlist
  for select
  using (auth.role() = 'authenticated');

create policy "sync_state: owner read" on sync_state
  for select
  using (exists (
    select 1 from wallets w where w.id = sync_state.wallet_id and w.user_id = auth.uid()
  ));
