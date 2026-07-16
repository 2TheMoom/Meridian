-- Supabase Auth here is SIWE-only (signInWithWeb3) — sessions never carry an
-- email address, so there is nowhere to send a Notify-tier alert without the
-- user opting in with one. Nullable and wallet-scoped rather than a new
-- profiles table: a user can set (or skip) a contact address per wallet from
-- the Guardrails screen, and notifications are simply skipped for any wallet
-- that hasn't set one.

alter table wallets add column notification_email text;
