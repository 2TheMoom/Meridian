import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreR3UnackedRecurringPayment } from "./r3UnackedRecurringPayment";

test("R3: acked pattern never triggers", () => {
  const result = scoreR3UnackedRecurringPayment({ acked: true, amountTrendingUpward: true });
  assert.equal(result.triggered, false);
  assert.equal(result.score, 0);
});

test("R3: unacked flat payment scores the base", () => {
  const result = scoreR3UnackedRecurringPayment({ acked: false, amountTrendingUpward: false });
  assert.equal(result.triggered, true);
  assert.equal(result.score, 40);
});

test("R3: unacked trending-upward payment adds the bonus", () => {
  const result = scoreR3UnackedRecurringPayment({ acked: false, amountTrendingUpward: true });
  assert.equal(result.score, 60);
});
