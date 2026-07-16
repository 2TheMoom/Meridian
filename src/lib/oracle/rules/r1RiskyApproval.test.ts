import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreR1RiskyApproval } from "./r1RiskyApproval";

test("R1: bounded approval never triggers, regardless of age/allowlist", () => {
  const result = scoreR1RiskyApproval({ unlimited: false, contractAgeDays: 1, allowlisted: false });
  assert.equal(result.triggered, false);
  assert.equal(result.score, 0);
});

test("R1: unlimited approval to an old, allowlisted contract scores exactly the base", () => {
  const result = scoreR1RiskyApproval({ unlimited: true, contractAgeDays: 365, allowlisted: true });
  assert.equal(result.triggered, true);
  assert.equal(result.score, 70);
});

test("R1: unlimited + young contract adds the young-contract bonus", () => {
  const result = scoreR1RiskyApproval({ unlimited: true, contractAgeDays: 5, allowlisted: true });
  assert.equal(result.score, 85);
});

test("R1: unlimited + not allowlisted adds the allowlist bonus", () => {
  const result = scoreR1RiskyApproval({ unlimited: true, contractAgeDays: 365, allowlisted: false });
  assert.equal(result.score, 85);
});

test("R1: unlimited + young + unallowlisted stacks both bonuses, capped at 100", () => {
  const result = scoreR1RiskyApproval({ unlimited: true, contractAgeDays: 1, allowlisted: false });
  assert.equal(result.score, 100);
});

test("R1: unknown contract age (null) does not earn the young-contract bonus", () => {
  const result = scoreR1RiskyApproval({ unlimited: true, contractAgeDays: null, allowlisted: true });
  assert.equal(result.score, 70);
});

test("R1: exactly at the young-contract boundary (14 days) does not count as young", () => {
  const result = scoreR1RiskyApproval({ unlimited: true, contractAgeDays: 14, allowlisted: true });
  assert.equal(result.score, 70);
});

test("R1: config overrides change scoring", () => {
  const result = scoreR1RiskyApproval(
    { unlimited: true, contractAgeDays: 365, allowlisted: true },
    { baseScore: 50 },
  );
  assert.equal(result.score, 50);
});
