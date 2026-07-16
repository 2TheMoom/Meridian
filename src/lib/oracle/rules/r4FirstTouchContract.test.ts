import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreR4FirstTouchContract } from "./r4FirstTouchContract";

test("R4: not a first-touch-with-value interaction never triggers", () => {
  const result = scoreR4FirstTouchContract({
    isFirstTouchWithValue: false,
    valueRatioOfWallet: 0.5,
    contractAgeDays: 1,
    verifiedOnExplorer: false,
  });
  assert.equal(result.triggered, false);
  assert.equal(result.score, 0);
});

test("R4: low-value, old, verified contract scores just the base", () => {
  const result = scoreR4FirstTouchContract({
    isFirstTouchWithValue: true,
    valueRatioOfWallet: 0.01,
    contractAgeDays: 365,
    verifiedOnExplorer: true,
  });
  assert.equal(result.triggered, true);
  assert.equal(result.score, 30);
});

test("R4: value over 5% of wallet adds the high-value bonus", () => {
  const result = scoreR4FirstTouchContract({
    isFirstTouchWithValue: true,
    valueRatioOfWallet: 0.06,
    contractAgeDays: 365,
    verifiedOnExplorer: true,
  });
  assert.equal(result.score, 50);
});

test("R4: value exactly at 5% does not cross the threshold", () => {
  const result = scoreR4FirstTouchContract({
    isFirstTouchWithValue: true,
    valueRatioOfWallet: 0.05,
    contractAgeDays: 365,
    verifiedOnExplorer: true,
  });
  assert.equal(result.score, 30);
});

test("R4: contract younger than 7 days adds the young-contract bonus", () => {
  const result = scoreR4FirstTouchContract({
    isFirstTouchWithValue: true,
    valueRatioOfWallet: 0.01,
    contractAgeDays: 3,
    verifiedOnExplorer: true,
  });
  assert.equal(result.score, 55);
});

test("R4: unknown verification status (null) does not add the unverified bonus", () => {
  const result = scoreR4FirstTouchContract({
    isFirstTouchWithValue: true,
    valueRatioOfWallet: 0.01,
    contractAgeDays: 365,
    verifiedOnExplorer: null,
  });
  assert.equal(result.score, 30);
});

test("R4: explicitly unverified adds the unverified bonus", () => {
  const result = scoreR4FirstTouchContract({
    isFirstTouchWithValue: true,
    valueRatioOfWallet: 0.01,
    contractAgeDays: 365,
    verifiedOnExplorer: false,
  });
  assert.equal(result.score, 45);
});

test("R4: all modifiers stack and cap at 100", () => {
  const result = scoreR4FirstTouchContract({
    isFirstTouchWithValue: true,
    valueRatioOfWallet: 0.9,
    contractAgeDays: 1,
    verifiedOnExplorer: false,
  });
  assert.equal(result.score, 90); // 30 + 20 + 25 + 15 = 90, under the cap
});
