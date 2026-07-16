# MeridianKeel

Keel's Hold tier (v1.1, spec section 6): a user-funded daily spend-cap vault for native MON on Monad. This is the security-critical piece of Meridian — the only part of the product that ever holds user funds.

> **Status: first draft, not yet audited.** This has a full test suite and passes it, but that is not the same thing as an audit. Per the spec's own build-in-public plan, this contract goes through a public four-gate self-audit — spec thread → invariant tests thread → self-audit findings thread → testnet → mainnet — before any real deployment. Nothing here should be treated as production-ready until that process is complete and published.

## Design

One policy type, deliberately minimal scope:

- Users deposit native MON into their own vault position.
- Spends within the wallet's configured daily cap execute instantly.
- Spends over cap are queued with a 24-hour timelock, cancelable by the user at any time before execution.
- Increasing the daily cap (including setting it for the first time — going from 0 is also an increase) is timelocked 24 hours. Decreasing is instant. The timelock on increases is the actual product: a forced pause against impulsive or coerced decisions, not just a defense against attackers.
- Emergency withdrawal of the full available balance is always available but delayed 12 hours. The request emits an event Meridian's off-chain layer watches to send an email alert — the delay plus visibility is the drainer-resistance mechanism.
- The daily window is a reset-on-next-spend-after-24h model, not a continuously rolling window — a deliberate simplification, documented in the contract, that's cheap to reason about at the cost of slight imprecision at the boundary.
- The owner has no path to user funds. Owner powers are limited to pausing new deposits and updating a published allowlist pointer (informational metadata only — never enforced on-chain).

Out of scope for this version, by design: ERC-20 support (MON only; USDC is a stated follow-up in the spec), on-chain destination allowlisting, and true continuous rolling windows.

## Usage

```bash
forge build
forge test
forge test -vvv              # with call traces
forge coverage --report summary
forge fmt                    # or --check in CI
```

Requires `lib/forge-std`, vendored directly in this repo (not a git submodule — see `.gitignore`).

## Test suite

40 tests in `test/MeridianKeel.t.sol`, covering:

- Every state transition (deposit, cap change, spend, cancel, emergency withdrawal) on both its success and failure paths
- **Every distinct `require()` revert message in the contract has at least one dedicated test** — verified by direct cross-reference against the source, not just by trusting `forge coverage`'s branch numbers (which turned out to be an unreliable way to detect gaps here — a genuinely-tested revert path showed as 0 hits due to how the tool's branch/path numbering works with the optimizer disabled for coverage runs; treat the tool's summary as a starting point; confirming gaps by reading the contract is what actually caught the real ones)
- Reentrancy: a `noReentrancy` guard shared across all fund-moving functions, exercised by an attacker contract that tries to re-enter both the same function and a *different* guarded function from within a callback
- Fund conservation: the contract's own ETH balance always equals the sum of tracked vault balances
- Transfer-failure paths (a recipient that rejects plain ETH transfers) roll back cleanly with state unchanged, for all three functions that move funds out

Result: 100% line, statement, branch, and function coverage on `src/MeridianKeel.sol` (`test/helpers/` coverage is lower and expected to be — those are test doubles, not production code).

**What this test suite does not cover, and what a real audit should add:** fuzz/invariant testing across randomized call sequences (the current tests are all deterministic scenarios), gas griefing analysis on the reentrancy guard, and formal reasoning about the window-reset simplification's edge cases under adversarial timing.
