import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreR6NftApprovalRisk } from "./r6NftApprovalRisk";

test("R6: a revoke (approved: false) never triggers, regardless of age/allowlist", () => {
  const result = scoreR6NftApprovalRisk({ approved: false, contractAgeDays: 1, allowlisted: false });
  assert.equal(result.triggered, false);
  assert.equal(result.score, 0);
});

test("R6: approval to an old, allowlisted operator scores exactly the base", () => {
  const result = scoreR6NftApprovalRisk({ approved: true, contractAgeDays: 365, allowlisted: true });
  assert.equal(result.triggered, true);
  assert.equal(result.score, 70);
});

test("R6: approval + young operator adds the young-contract bonus", () => {
  const result = scoreR6NftApprovalRisk({ approved: true, contractAgeDays: 5, allowlisted: true });
  assert.equal(result.score, 85);
});

test("R6: approval + not allowlisted adds the allowlist bonus", () => {
  const result = scoreR6NftApprovalRisk({ approved: true, contractAgeDays: 365, allowlisted: false });
  assert.equal(result.score, 85);
});

test("R6: approval + young + unallowlisted stacks both bonuses, capped at 100", () => {
  const result = scoreR6NftApprovalRisk({ approved: true, contractAgeDays: 1, allowlisted: false });
  assert.equal(result.score, 100);
});

test("R6: unknown operator age (null) does not earn the young-contract bonus", () => {
  const result = scoreR6NftApprovalRisk({ approved: true, contractAgeDays: null, allowlisted: true });
  assert.equal(result.score, 70);
});

test("R6: exactly at the young-contract boundary (14 days) does not count as young", () => {
  const result = scoreR6NftApprovalRisk({ approved: true, contractAgeDays: 14, allowlisted: true });
  assert.equal(result.score, 70);
});

test("R6: config overrides change scoring", () => {
  const result = scoreR6NftApprovalRisk(
    { approved: true, contractAgeDays: 365, allowlisted: true },
    { baseScore: 50 },
  );
  assert.equal(result.score, 50);
});
