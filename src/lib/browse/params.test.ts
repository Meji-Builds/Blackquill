import { test } from "node:test";
import assert from "node:assert/strict";
import { filtersHref, parseFilters, toRpcArgs } from "./params.ts";

test("parseFilters defaults and validation", () => {
  const f = parseFilters({});
  assert.equal(f.sort, "updated");
  assert.equal(f.page, 1);
  const g = parseFilters({ q: "  ink ", genre: ["fantasy", "Horror,bad slug!"], status: "nope", page: "-3", sort: "words" });
  assert.equal(g.q, "ink");
  assert.deepEqual(g.genres, ["fantasy", "horror"]);
  assert.equal(g.status, null);
  assert.equal(g.page, 1);
  assert.equal(g.sort, "words");
  assert.equal(parseFilters({ q: "ink" }).sort, "relevance");
});

test("toRpcArgs maps length buckets and paging", () => {
  const a = toRpcArgs(parseFilters({ length: "medium", page: "3", updated: "30" }));
  assert.equal(a.p_min_words, 20000);
  assert.equal(a.p_max_words, 100000);
  assert.equal(a.p_offset, 48);
  assert.equal(a.p_updated_within_days, 30);
});

test("filtersHref round-trips and resets page", () => {
  const f = parseFilters({ q: "ink", genre: ["fantasy"], page: "4" });
  assert.equal(filtersHref("/browse", f), "/browse?q=ink&genre=fantasy");
  assert.equal(filtersHref("/browse", f, { page: 5 }), "/browse?q=ink&genre=fantasy&page=5");
  const back = parseFilters(Object.fromEntries(new URLSearchParams("genre=fantasy&genre=horror&mature=1")) as never);
  assert.equal(back.mature, true);
});

test("canonicalHref strips empty form fields", async () => {
  const { canonicalHref } = await import("./params.ts");
  const raw = { q: "", genre: "horror", status: "completed", length: "", sort: "updated" };
  assert.equal(canonicalHref("/browse", raw, parseFilters(raw)), "/browse?genre=horror&status=completed");
  assert.equal(canonicalHref("/browse", { genre: "horror" }, parseFilters({ genre: "horror" })), null);
  const tagRaw = { q: "", tag: "slow-burn", status: "ongoing" };
  assert.equal(
    canonicalHref("/tag/slow-burn", tagRaw, parseFilters(tagRaw), { tags: ["slow-burn"] }),
    "/tag/slow-burn?status=ongoing",
  );
});
