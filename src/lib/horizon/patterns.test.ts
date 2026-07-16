import assert from "node:assert/strict";
import { test } from "node:test";
import { AMOUNT_TOLERANCE, INTERVAL_TOLERANCE, nextRunningAverage, withinTolerance } from "./patterns";

test("withinTolerance: exact match is always within tolerance", () => {
  assert.equal(withinTolerance(100, 100, 0.1), true);
});

test("withinTolerance: within the boundary is accepted", () => {
  assert.equal(withinTolerance(110, 100, AMOUNT_TOLERANCE), true); // exactly +10%
  assert.equal(withinTolerance(90, 100, AMOUNT_TOLERANCE), true); // exactly -10%
});

test("withinTolerance: just outside the boundary is rejected", () => {
  assert.equal(withinTolerance(110.01, 100, AMOUNT_TOLERANCE), false);
  assert.equal(withinTolerance(89.99, 100, AMOUNT_TOLERANCE), false);
});

test("withinTolerance: interval tolerance uses its own wider band", () => {
  assert.equal(withinTolerance(120, 100, INTERVAL_TOLERANCE), true); // +20%
  assert.equal(withinTolerance(121, 100, INTERVAL_TOLERANCE), false);
});

test("withinTolerance: zero reference only matches an exact zero value", () => {
  assert.equal(withinTolerance(0, 0, AMOUNT_TOLERANCE), true);
  assert.equal(withinTolerance(1, 0, AMOUNT_TOLERANCE), false);
});

test("nextRunningAverage: second sample averages evenly with the first", () => {
  // First sample established the "average" as itself (count=1); second sample arrives.
  assert.equal(nextRunningAverage(100, 1, 200), 150);
});

test("nextRunningAverage: a large history moves proportionally less for one new sample", () => {
  // 99 samples averaging 100 (sum 9900) plus one sample of 200 -> 10100 / 100
  assert.equal(nextRunningAverage(100, 99, 200), 101);
});

test("nextRunningAverage: identical new sample leaves the average unchanged", () => {
  assert.equal(nextRunningAverage(50, 4, 50), 50);
});
