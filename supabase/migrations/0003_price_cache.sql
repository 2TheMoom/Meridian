-- USD price cache for Oracle's velocity signal (R2) and Horizon's outflow_usd.
-- Keyed by (key, chain_id) rather than key alone — same lesson as the
-- allowlist collision fix in migration 0002: don't assume a token address
-- means the same thing across networks. key is 'native' for the chain's
-- native token, or a lowercase ERC-20 contract address.

create table price_cache (
  key text not null,
  chain_id int not null,
  usd_price numeric not null,
  updated_at timestamptz not null default now(),
  primary key (key, chain_id)
);

-- Internal cache only, no product value in exposing it client-side (unlike
-- allowlist). RLS enabled with zero policies: only the service-role client
-- (Horizon/Oracle) can read or write it.
alter table price_cache enable row level security;
