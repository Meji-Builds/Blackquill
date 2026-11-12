import { test } from "node:test";
import assert from "node:assert/strict";
import { paragraphCounts, threads, timeAgo, type CommentView } from "./types.ts";

const c = (id: string, parentId: string | null, paragraphIndex: number | null): CommentView => ({
  id,
  parentId,
  paragraphIndex,
  body: id,
  createdAt: "2026-01-01T00:00:00Z",
  edited: false,
  hidden: false,
  userId: "u",
  username: "u",
  name: "U",
  isAuthor: false,
  likes: 0,
  liked: false,
  avatarUrl: null,
});

test("threads groups replies under their parent in order", () => {
  const t = threads([c("a", null, null), c("b", null, 2), c("r1", "a", null), c("r2", "b", null), c("r3", "a", null)]);
  assert.deepEqual(
    t.map((x) => [x.comment.id, x.replies.map((r) => r.id)]),
    [
      ["a", ["r1", "r3"]],
      ["b", ["r2"]],
    ],
  );
});

test("paragraphCounts counts paragraph comments and their replies", () => {
  const counts = paragraphCounts([c("a", null, null), c("b", null, 2), c("r1", "a", null), c("r2", "b", null), c("d", null, 0)]);
  assert.equal(counts.get(2), 2);
  assert.equal(counts.get(0), 1);
  assert.equal(counts.has(1), false);
});

test("timeAgo", () => {
  const now = new Date("2026-01-02T00:00:00Z").getTime();
  assert.equal(timeAgo("2026-01-01T23:59:30Z", now), "just now");
  assert.equal(timeAgo("2026-01-01T23:50:00Z", now), "10m");
  assert.equal(timeAgo("2026-01-01T21:00:00Z", now), "3h");
  assert.equal(timeAgo("2025-12-30T00:00:00Z", now), "3d");
});
