import { test } from "node:test";
import assert from "node:assert/strict";
import { dropOff, retention, settled } from "./analytics.ts";

const ch = (readers: number[]) => readers.map((r, i) => ({ number: i + 1, title: "", readers: r, finishers: r }));

test("dropOff finds the largest relative fall", () => {
  assert.deepEqual(dropOff(ch([100, 90, 40, 38])), { number: 2, lost: 50, share: 50 / 90 });
});

test("dropOff ignores tiny chapters and rises", () => {
  assert.equal(dropOff(ch([2, 1, 0])), null);
  assert.equal(dropOff(ch([5, 6, 7])), null);
});

test("retention", () => {
  assert.equal(retention(ch([10, 5, 4])), 0.4);
  assert.equal(retention(ch([10])), null);
  assert.equal(retention(ch([0, 0])), null);
});

test("settled drops chapters published in the last three days", () => {
  const now = new Date("2026-01-10T00:00:00Z").getTime();
  const list = [
    { number: 1, title: "", readers: 5, finishers: 5, published_at: "2026-01-01T00:00:00Z" },
    { number: 2, title: "", readers: 0, finishers: 0, published_at: "2026-01-09T00:00:00Z" },
  ];
  assert.deepEqual(settled(list, now).map((c) => c.number), [1]);
});
