import { test } from "node:test";
import assert from "node:assert/strict";
import { readingMinutes, toParagraphs } from "./text.ts";

test("toParagraphs", () => {
  assert.deepEqual(toParagraphs(""), []);
  assert.deepEqual(toParagraphs("One.\n\nTwo\nstill two.\r\n\r\n  \n\nThree."), ["One.", "Two\nstill two.", "Three."]);
});

test("readingMinutes", () => {
  assert.equal(readingMinutes(0), 1);
  assert.equal(readingMinutes(2300), 10);
});
