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

test("paragraphIndexAt matches toParagraphs", async () => {
  const { paragraphIndexAt } = await import("./text.ts");
  const body = "One.\n\nTwo\nstill two.\n\n\nThree.";
  assert.equal(paragraphIndexAt(body, 0), 0);
  assert.equal(paragraphIndexAt(body, 2), 0);
  assert.equal(paragraphIndexAt(body, body.indexOf("Two") + 1), 1);
  assert.equal(paragraphIndexAt(body, body.indexOf("still") + 3), 1);
  assert.equal(paragraphIndexAt(body, body.indexOf("Three")), 1); // at the very start of "Three": not in it yet
  assert.equal(paragraphIndexAt(body, body.length), 2);
  assert.equal(paragraphIndexAt("", 0), 0);
});
