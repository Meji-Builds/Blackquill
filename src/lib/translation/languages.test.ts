import { test } from "node:test";
import assert from "node:assert/strict";
import { batches, languageLabel, parseLangCookie, splitParagraphs, withStoryLanguage } from "./languages.ts";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

test("labels", () => {
  assert.equal(languageLabel("es"), "Español (Spanish)");
  assert.equal(languageLabel("en"), "English");
});

test("lang cookie parses safely and keeps only known languages", () => {
  assert.deepEqual(parseLangCookie(JSON.stringify({ [A]: "es", [B]: "klingon", x: "fr" })), { [A]: "es" });
  assert.deepEqual(parseLangCookie("not json"), {});
  assert.deepEqual(parseLangCookie("[1]"), {});
});

test("withStoryLanguage sets, clears and moves to the end", () => {
  const m = withStoryLanguage({ [A]: "es", [B]: "fr" }, A, "de");
  assert.deepEqual(Object.keys(m), [B, A]);
  assert.equal(m[A], "de");
  assert.deepEqual(withStoryLanguage(m, A, null), { [B]: "fr" });
});

test("paragraphs and batches", () => {
  assert.deepEqual(splitParagraphs("a\n\n b \r\n\r\nc"), ["a", "b", "c"]);
  const b = batches(["x".repeat(4000), "y".repeat(3000), "z".repeat(10)], 6000);
  assert.equal(b.length, 2);
  assert.equal(b[1].length, 2);
});
