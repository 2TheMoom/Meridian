import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateGuard } from "./guard";

test("Guard: allowlisted address is always safe, regardless of age", () => {
  const result = evaluateGuard({ contractAgeDays: 1, allowlisted: true, verifiedOnExplorer: false });
  assert.equal(result.verdict, "safe");
  assert.equal(result.score, 0);
});

test("Guard: unallowlisted + young contract is danger", () => {
  const result = evaluateGuard({ contractAgeDays: 3, allowlisted: false, verifiedOnExplorer: null });
  assert.equal(result.verdict, "danger");
});

test("Guard: unallowlisted + unverified (even if old) is danger", () => {
  const result = evaluateGuard({ contractAgeDays: 365, allowlisted: false, verifiedOnExplorer: false });
  assert.equal(result.verdict, "danger");
});

test("Guard: unallowlisted + old + verified is caution, not danger", () => {
  const result = evaluateGuard({ contractAgeDays: 365, allowlisted: false, verifiedOnExplorer: true });
  assert.equal(result.verdict, "caution");
});

test("Guard: unallowlisted + old + unknown verification is caution, not danger", () => {
  const result = evaluateGuard({ contractAgeDays: 365, allowlisted: false, verifiedOnExplorer: null });
  assert.equal(result.verdict, "caution");
});

test("Guard: score reuses R1's real formula for the not-allowlisted case", () => {
  const result = evaluateGuard({ contractAgeDays: 365, allowlisted: false, verifiedOnExplorer: true });
  assert.equal(result.score, 85); // R1 base (70) + not-allowlisted bonus (15)
});
