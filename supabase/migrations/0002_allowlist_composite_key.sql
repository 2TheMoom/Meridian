-- The same address string can be a different, unrelated contract on mainnet
-- vs testnet (different deployments/networks). A single-column primary key
-- on `address` let seeding one network silently overwrite the chain_id of a
-- same-address entry from the other network. Scope the allowlist per chain.

alter table allowlist drop constraint allowlist_pkey;
alter table allowlist add primary key (address, chain_id);
