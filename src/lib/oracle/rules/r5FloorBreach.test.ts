import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreR5FloorBreach } from "./r5FloorBreach";

test("R5: neither breached nor projected does not trigger", () => {
  const result = scoreR5FloorBreach({ breached: false, projectedBreachWithin7d: false });
  assert.equal(result.triggered, false);
  assert.equal(result.score, 0);
});

test("R5: projected breach within 7d scores 60", () => {
  const result = scoreR5FloorBreach({ breached: false, projectedBreachWithin7d: true });
  assert.equal(result.triggered, true);
  assert.equal(result.score, 60);
});

test("R5: actual breach scores 90", () => {
  const result = scoreR5FloorBreach({ breached: true, projectedBreachWithin7d: false });
  assert.equal(result.score, 90);
});

test("R5: actual breach outranks a simultaneous projected-breach flag", () => {
  const result = scoreR5FloorBreach({ breached: true, projectedBreachWithin7d: true });
  assert.equal(result.score, 90);
});
