import { test } from "node:test";
import assert from "node:assert/strict";
import { minFinishSeconds } from "./viewer.ts";

test("minFinishSeconds", () => {
  assert.equal(minFinishSeconds(0), 10);
  assert.equal(minFinishSeconds(1800), 120);
  assert.equal(minFinishSeconds(1_000_000), 600);
});
