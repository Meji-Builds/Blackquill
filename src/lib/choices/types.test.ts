import { test } from "node:test";
import assert from "node:assert/strict";
import { percentages } from "./types.ts";

test("percentages always add up to 100", () => {
  assert.deepEqual(percentages([0, 0]), [0, 0]);
  assert.deepEqual(percentages([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(percentages([2, 1]), [67, 33]);
  assert.deepEqual(percentages([5, 0, 0]), [100, 0, 0]);
  for (let i = 0; i < 200; i++) {
    const c = [0, 0, 0].map(() => Math.floor(Math.random() * 50));
    if (c.some(Boolean)) assert.equal(percentages(c).reduce((a, b) => a + b, 0), 100);
  }
});
