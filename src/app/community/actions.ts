"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/studio/types";
import type { CommentView } from "@/lib/community/types";

const fail = (error: string): ActionResult => ({ ok: false, error });

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function friendly(message: string) {
  if (/quickly/.test(message)) return "You're commenting very quickly. Wait a few minutes and try again.";
  if (/row-level security/.test(message)) return "You can't comment on this chapter.";
  return message;
}

/** Follow or unfollow a story or an author. Returns the new state. */
export async function setFollow(
  target: { storyId?: string; authorId?: string },
  follow: boolean,
): Promise<ActionResult & { following?: boolean }> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in to follow.");
  const column = target.storyId ? "story_id" : "author_id";
  const id = target.storyId ?? target.authorId;
  if (!id) return fail("Nothing to follow.");
  if (column === "author_id" && id === user.id) return fail("You can't follow yourself.");
  if (follow) {
    const { error } = await supabase.from("follows").insert({ user_id: user.id, [column]: id });
    if (error && error.code !== "23505") return fail(error.message);
  } else {
    const { error } = await supabase.from("follows").delete().eq("user_id", user.id).eq(column, id);
    if (error) return fail(error.message);
  }
  return { ok: true, following: follow };
}

const COMMENT_SELECT = "id, body, paragraph_index, parent_id, created_at, updated_at, is_hidden, user_id, profiles!comments_user_id_fkey(username, display_name, avatar_url), comment_likes(count)";

type Row = {
  id: string;
  body: string;
  paragraph_index: number | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  is_hidden: boolean;
  user_id: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  comment_likes: { count: number }[] | null;
};

function toView(r: Row, authorId: string | null, liked = false): CommentView {
  return {
    id: r.id,
    body: r.body,
    paragraphIndex: r.paragraph_index,
    parentId: r.parent_id,
    createdAt: r.created_at,
    edited: new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 2000,
    hidden: r.is_hidden,
    userId: r.user_id,
    username: r.profiles?.username ?? "reader",
    name: r.profiles?.display_name || r.profiles?.username || "Reader",
    avatarUrl: r.profiles?.avatar_url ?? null,
    isAuthor: authorId !== null && r.user_id === authorId,
    likes: r.comment_likes?.[0]?.count ?? 0,
    liked,
  };
}

/** All visible comments on a chapter, oldest first, plus who is asking. */
export async function loadComments(chapterId: string): Promise<{ comments: CommentView[]; me: string | null; error?: string }> {
  const { supabase, user } = await currentUser();
  const { data: chapter } = await supabase.from("chapters").select("stories(author_id)").eq("id", chapterId).maybeSingle();
  const authorId = (chapter?.stories as unknown as { author_id: string } | null)?.author_id ?? null;
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("chapter_id", chapterId)
    .order("created_at")
    .limit(500);
  if (error) return { comments: [], me: user?.id ?? null, error: error.message };
  const rows = data as unknown as Row[];
  const mine = new Set<string>();
  if (user && rows.length) {
    const { data: likes } = await supabase
      .from("comment_likes")
      .select("comment_id, comments!inner(chapter_id)")
      .eq("user_id", user.id)
      .eq("comments.chapter_id", chapterId);
    for (const l of likes ?? []) mine.add(l.comment_id);
  }
  return { comments: rows.map((r) => toView(r, authorId, mine.has(r.id))), me: user?.id ?? null };
}

export async function postComment(input: {
  chapterId: string;
  body: string;
  paragraphIndex?: number | null;
  parentId?: string | null;
}): Promise<ActionResult & { comment?: CommentView }> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in to comment.");
  const body = input.body.trim();
  if (!body) return fail("Write something first.");
  if (body.length > 4000) return fail("Comments can be up to 4,000 characters.");
  const { data, error } = await supabase
    .from("comments")
    .insert({
      chapter_id: input.chapterId,
      user_id: user.id,
      body,
      paragraph_index: input.parentId ? null : (input.paragraphIndex ?? null),
      parent_id: input.parentId ?? null,
    })
    .select(COMMENT_SELECT)
    .single();
  if (error) return fail(friendly(error.message));
  const { data: chapter } = await supabase.from("chapters").select("stories(author_id)").eq("id", input.chapterId).maybeSingle();
  const authorId = (chapter?.stories as unknown as { author_id: string } | null)?.author_id ?? null;
  return { ok: true, comment: toView(data as unknown as Row, authorId) };
}

export async function editComment(id: string, body: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  const clean = body.trim();
  if (!clean || clean.length > 4000) return fail("Comments are 1 to 4,000 characters.");
  const { error, count } = await supabase
    .from("comments")
    .update({ body: clean }, { count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return fail(error.message);
  if (!count) return fail("You can only edit your own comments.");
  return { ok: true };
}

export async function deleteComment(id: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  const { error, count } = await supabase.from("comments").delete({ count: "exact" }).eq("id", id).eq("user_id", user.id);
  if (error) return fail(error.message);
  if (!count) return fail("You can only delete your own comments.");
  return { ok: true };
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  return error ? fail(error.message) : { ok: true };
}

export async function unreadCount(): Promise<number> {
  const { supabase, user } = await currentUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  return count ?? 0;
}

export async function fileReport(
  targetType: "story" | "chapter" | "comment" | "profile",
  targetId: string,
  reason: string,
): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in to report something.");
  const clean = reason.trim().slice(0, 1000);
  if (!clean) return fail("Pick a reason.");
  const { error } = await supabase.from("reports").insert({ target_type: targetType, target_id: targetId, reporter_id: user.id, reason: clean });
  if (error) {
    if (error.code === "23505") return { ok: true }; // already reported; nothing more to do
    if (/quickly/.test(error.message)) return fail("You've sent a lot of reports recently. Try again later.");
    return fail(error.message);
  }
  return { ok: true };
}

/** Like or unlike a chapter or a comment. Returns the new state and count. */
export async function setLike(
  target: { chapterId?: string; commentId?: string },
  like: boolean,
): Promise<ActionResult & { liked?: boolean; count?: number }> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in to like.");
  const table = target.chapterId ? "chapter_likes" : "comment_likes";
  const column = target.chapterId ? "chapter_id" : "comment_id";
  const id = target.chapterId ?? target.commentId;
  if (!id) return fail("Nothing to like.");
  if (like) {
    const { error } = await supabase.from(table).insert({ user_id: user.id, [column]: id });
    if (error && error.code !== "23505") return fail(/row-level security/.test(error.message) ? "You can't like this." : error.message);
  } else {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id).eq(column, id);
    if (error) return fail(error.message);
  }
  const { count } = await supabase.from(table).select("user_id", { count: "exact", head: true }).eq(column, id);
  return { ok: true, liked: like, count: count ?? 0 };
}

/** Likes on a chapter, and whether the reader liked it. */
export async function chapterLikes(chapterId: string): Promise<{ count: number; liked: boolean }> {
  const { supabase, user } = await currentUser();
  const [{ count }, mine] = await Promise.all([
    supabase.from("chapter_likes").select("user_id", { count: "exact", head: true }).eq("chapter_id", chapterId),
    user
      ? supabase.from("chapter_likes").select("user_id").eq("chapter_id", chapterId).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { count: count ?? 0, liked: Boolean(mine.data) };
}

/** Remember this device for phone notifications. */
export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  if (!/^https:\/\//.test(sub.endpoint)) return fail("This browser can't receive notifications.");
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth });
  return error ? fail(error.message) : { ok: true };
}

/** Stop phone notifications on this device. */
export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return error ? fail(error.message) : { ok: true };
}

/** Which kinds of alerts reach the phone. */
export async function setPushPrefs(prefs: Record<string, boolean>): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  const allowed = ["chapters", "comments", "likes", "followers", "translations"];
  const clean = Object.fromEntries(Object.entries(prefs).filter(([k, v]) => allowed.includes(k) && typeof v === "boolean"));
  const { error } = await supabase.from("profiles").update({ push_prefs: clean }).eq("id", user.id);
  return error ? fail(error.message) : { ok: true };
}
