import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreR2VelocitySpike } from "./r2VelocitySpike";

test("R2: outflow at or below baseline does not trigger", () => {
  // 7d baseline-equivalent = 30d/30*7 = 700; outflow of 700 is exactly the baseline (ratio 1), not a spike
  const result = scoreR2VelocitySpike({ outflow7dUsd: 700, trailing30dOutflowUsd: 3000 });
  assert.equal(result.triggered, false);
  assert.equal(result.score, 0);
});

test("R2: just over 2x baseline scores the first tier", () => {
  // baseline-equivalent = 700; 1401 / 700 = 2.001...x
  const result = scoreR2VelocitySpike({ outflow7dUsd: 1401, trailing30dOutflowUsd: 3000 });
  assert.equal(result.triggered, true);
  assert.equal(result.score, 50);
});

test("R2: exactly 2x baseline does not cross the >2x threshold", () => {
  const result = scoreR2VelocitySpike({ outflow7dUsd: 1400, trailing30dOutflowUsd: 3000 });
  assert.equal(result.triggered, false);
});

test("R2: over 4x baseline scores the second tier", () => {
  const result = scoreR2VelocitySpike({ outflow7dUsd: 2801, trailing30dOutflowUsd: 3000 });
  assert.equal(result.score, 75);
});

test("R2: over 8x baseline scores the top tier", () => {
  const result = scoreR2VelocitySpike({ outflow7dUsd: 5601, trailing30dOutflowUsd: 3000 });
  assert.equal(result.score, 95);
});

test("R2: zero baseline with any outflow is an infinite spike, scores the top tier", () => {
  const result = scoreR2VelocitySpike({ outflow7dUsd: 100, trailing30dOutflowUsd: 0 });
  assert.equal(result.score, 95);
});

test("R2: zero baseline and zero outflow does not trigger", () => {
  const result = scoreR2VelocitySpike({ outflow7dUsd: 0, trailing30dOutflowUsd: 0 });
  assert.equal(result.triggered, false);
});
