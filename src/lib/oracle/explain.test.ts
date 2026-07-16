import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FALLBACK_EXPLANATIONS,
  isValidExplanation,
  violatesRestraintPrinciple,
} from "./explain";

test("isValidExplanation accepts a well-formed explanation", () => {
  assert.equal(isValidExplanation({ why: "a", saferAlternative: "b" }), true);
});

test("isValidExplanation rejects missing fields", () => {
  assert.equal(isValidExplanation({ why: "a" }), false);
  assert.equal(isValidExplanation({ saferAlternative: "b" }), false);
  assert.equal(isValidExplanation({}), false);
});

test("isValidExplanation rejects empty strings", () => {
  assert.equal(isValidExplanation({ why: "", saferAlternative: "b" }), false);
  assert.equal(isValidExplanation({ why: "a", saferAlternative: "" }), false);
});

test("isValidExplanation rejects non-string fields and non-objects", () => {
  assert.equal(isValidExplanation({ why: 1, saferAlternative: "b" }), false);
  assert.equal(isValidExplanation(null), false);
  assert.equal(isValidExplanation("not an object"), false);
});

test("violatesRestraintPrinciple flags leverage/yield-farm/hedging suggestions", () => {
  assert.equal(
    violatesRestraintPrinciple({ why: "x", saferAlternative: "Consider using leverage to offset this." }),
    true,
  );
  assert.equal(
    violatesRestraintPrinciple({ why: "x", saferAlternative: "Try yield farming the difference." }),
    true,
  );
  assert.equal(violatesRestraintPrinciple({ why: "x", saferAlternative: "Hedge your position." }), true);
});

test("violatesRestraintPrinciple flags em dashes", () => {
  assert.equal(violatesRestraintPrinciple({ why: "This is bad — really bad.", saferAlternative: "Pause it." }), true);
});

test("violatesRestraintPrinciple passes restraint-only, em-dash-free copy", () => {
  assert.equal(
    violatesRestraintPrinciple({
      why: "This approval has no upper limit.",
      saferAlternative: "Consider revoking it or capping it to what you need.",
    }),
    false,
  );
});

test("violatesRestraintPrinciple does not false-positive on ordinary long/short usage", () => {
  // "long as" / "as long" should not trip the short(ing)/long(ing) 'the|this|it' patterns
  assert.equal(
    violatesRestraintPrinciple({
      why: "As long as this stays unrevoked, the risk remains.",
      saferAlternative: "Wait before doing anything further.",
    }),
    false,
  );
});

test("every rule has a fallback explanation that itself passes the restraint check", () => {
  for (const [ruleId, explanation] of Object.entries(FALLBACK_EXPLANATIONS)) {
    assert.equal(
      violatesRestraintPrinciple(explanation),
      false,
      `fallback for ${ruleId} should not itself violate the restraint principle`,
    );
    assert.equal(isValidExplanation(explanation), true, `fallback for ${ruleId} should be well-formed`);
  }
});
