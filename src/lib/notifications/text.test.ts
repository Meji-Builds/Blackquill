import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationHref, pushMessage, type PushFacts } from "./text.ts";

const base: PushFacts = {
  id: "n1",
  kind: "comment_like",
  storyId: "s1",
  chapterNumber: 3,
  actorUsername: "ada",
  language: null,
  actorName: "Ada",
  storyTitle: "Lanterns Below",
  chapterTitle: "The Well",
  commentId: "c1",
  commentBody: "What   a\nreveal!",
  others: 2,
};

test("likes from several people collapse into one alert", () => {
  const m = pushMessage(base);
  assert.equal(m.title, "Ada and 2 others liked your comment");
  assert.equal(m.body, "“What a reveal!”");
  assert.equal(m.tag, "like-c-c1");
  assert.equal(pushMessage({ ...base, others: 1 }).title, "Ada and 1 other liked your comment");
  assert.equal(pushMessage({ ...base, kind: "chapter_like", others: 0 }).title, "Ada liked Chapter 3: The Well");
});

test("new chapters and replies", () => {
  assert.deepEqual(pushMessage({ ...base, kind: "new_chapter" }), {
    title: "New chapter of Lanterns Below",
    body: "Chapter 3: The Well",
    tag: "chapter-s1-3",
  });
  assert.equal(pushMessage({ ...base, kind: "comment_reply" }).title, "Ada replied to you");
  assert.equal(pushMessage({ ...base, kind: "comment_reply", commentBody: "x".repeat(400) }).body.length, 142);
});

test("where a notification leads", () => {
  assert.equal(notificationHref(base), "/story/s1/chapter/3#comments");
  assert.equal(notificationHref({ ...base, kind: "chapter_like" }), "/story/s1/chapter/3");
  assert.equal(notificationHref({ ...base, kind: "new_follower" }), "/author/ada");
  assert.equal(notificationHref({ ...base, kind: "translator_approved", language: "fr" }), "/translate/s1/fr");
});
