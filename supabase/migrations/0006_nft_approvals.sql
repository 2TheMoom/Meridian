-- R6 (NFT approval risk) needs per-window ApprovalForAll events, shaped and
-- windowed exactly like the existing `approvals` column. Unlike `transfers`
-- (which needed queryable history across snapshots for R3's pattern
-- matching), NFT approvals are evaluated per-snapshot only, so this is a new
-- column on `snapshots`, not a new table.
alter table snapshots
  add column nft_approvals jsonb not null default '[]';

-- Already covered by the existing "snapshots: owner read" RLS policy (same
-- row, new column) — no new policy needed.
