import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldCreateMoment } from "./pipeline";
import { momentThresholdFor, type Policy } from "./policies";
import type { RuleResult } from "./types";

function result(score: number, triggered = true): RuleResult {
  return { ruleId: "R1", score, triggered, details: {} };
}

test("shouldCreateMoment: untriggered result never creates a Moment", () => {
  const policy: Policy = { tier: "notify", threshold: {} };
  assert.equal(shouldCreateMoment(policy, result(90, false)), false);
});

test("shouldCreateMoment: tier 'off' suppresses even a high score", () => {
  const policy: Policy = { tier: "off", threshold: {} };
  assert.equal(shouldCreateMoment(policy, result(100)), false);
});

test("shouldCreateMoment: score below the default threshold (50) does not create a Moment", () => {
  const policy: Policy = { tier: "notify", threshold: {} };
  assert.equal(shouldCreateMoment(policy, result(49)), false);
});

test("shouldCreateMoment: score at or above the default threshold creates a Moment", () => {
  const policy: Policy = { tier: "notify", threshold: {} };
  assert.equal(shouldCreateMoment(policy, result(50)), true);
  assert.equal(shouldCreateMoment(policy, result(70)), true);
});

test("shouldCreateMoment: confirm tier behaves the same as notify for gating purposes", () => {
  const policy: Policy = { tier: "confirm", threshold: {} };
  assert.equal(shouldCreateMoment(policy, result(50)), true);
});

test("shouldCreateMoment: a policy threshold override changes the cutoff", () => {
  const policy: Policy = { tier: "notify", threshold: { momentThreshold: 80 } };
  assert.equal(shouldCreateMoment(policy, result(70)), false);
  assert.equal(shouldCreateMoment(policy, result(80)), true);
});

test("momentThresholdFor: falls back to the default when no override is set", () => {
  assert.equal(momentThresholdFor({ tier: "notify", threshold: {} }), 50);
});

test("momentThresholdFor: ignores a non-numeric override", () => {
  assert.equal(momentThresholdFor({ tier: "notify", threshold: { momentThreshold: "high" } }), 50);
});

test("momentThresholdFor: honors a numeric override", () => {
  assert.equal(momentThresholdFor({ tier: "notify", threshold: { momentThreshold: 65 } }), 65);
});
