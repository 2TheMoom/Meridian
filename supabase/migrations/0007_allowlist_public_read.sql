-- Guard (pre-sign address check) needs to read the allowlist without a
-- signed-in session — that's the entire point, it works before anyone
-- connects a wallet. The allowlist is public reference data (known-good
-- Monad protocol addresses), not user data, so there's no reason to gate
-- reads behind auth. Wallets/moments/policies/etc. keep their existing
-- authenticated-only RLS untouched.
create policy "allowlist: readable by anyone" on allowlist
  for select
  to anon
  using (true);
