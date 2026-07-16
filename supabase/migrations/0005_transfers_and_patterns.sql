-- Recurring-payment detection (R3, spec section 4 point 3) needs discrete
-- outgoing-transfer history per wallet — snapshots only ever stored
-- aggregates (approvals, balances, outflow_usd), never individual transfer
-- events. This table is ERC-20 only: native MON transfers emit no logs, so
-- there is no recipient to record for them (see horizon/outflow.ts's
-- balance-delta note for the same limitation applied to outflow tracking).

create table transfers (
  id bigint generated always as identity primary key,
  wallet_id uuid references wallets not null,
  token text not null, -- lowercase ERC-20 contract address
  to_address text not null,
  amount text not null, -- raw amount, smallest unit, as a string (matches snapshots.approvals' amount encoding)
  tx_hash text not null,
  block_number bigint not null,
  created_at timestamptz not null default now(),
  unique (wallet_id, tx_hash, token, to_address)
);

create index transfers_wallet_token_to_idx on transfers (wallet_id, token, to_address, block_number desc);

alter table transfers enable row level security;

create policy "transfers: owner read" on transfers
  for select
  using (exists (
    select 1 from wallets w where w.id = transfers.wallet_id and w.user_id = auth.uid()
  ));
