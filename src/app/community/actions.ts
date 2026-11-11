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

const COMMENT_SELECT = "id, body, paragraph_index, parent_id, created_at, updated_at, is_hidden, user_id, profiles(username, display_name)";

type Row = {
  id: string;
  body: string;
  paragraph_index: number | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  is_hidden: boolean;
  user_id: string;
  profiles: { username: string; display_name: string | null } | null;
};

function toView(r: Row, authorId: string | null): CommentView {
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
    isAuthor: authorId !== null && r.user_id === authorId,
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
  return { comments: (data as unknown as Row[]).map((r) => toView(r, authorId)), me: user?.id ?? null };
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
