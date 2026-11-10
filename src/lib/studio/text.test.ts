import { test } from "node:test";
import assert from "node:assert/strict";
import { countWords, parseTags, slugify } from "./text.ts";

test("slugify", () => {
  assert.equal(slugify("The Obsidian Quill!"), "the-obsidian-quill");
  assert.equal(slugify("  Café — Noir  "), "cafe-noir");
  assert.equal(slugify("!!!"), "story");
  assert.equal(slugify("a".repeat(100)).length, 60);
});

test("countWords", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   \n "), 0);
  assert.equal(countWords("The quill\n\ncut  deep."), 4);
});

test("parseTags", () => {
  assert.deepEqual(parseTags("slow burn, magic, , slow burn"), ["slow burn", "magic"]);
});
