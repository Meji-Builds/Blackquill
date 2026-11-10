"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/studio/types";

const fail = (error: string): ActionResult => ({ ok: false, error });
const DEFAULT_KINDS = ["reading", "plan_to_read", "completed"];

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Saves where the reader stopped. Silently does nothing for signed-out readers. */
export async function saveProgress(storyId: string, chapterId: string, scroll: number): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: true };
  const scroll_position = Math.min(1, Math.max(0, Number.isFinite(scroll) ? scroll : 0));
  const { error } = await supabase.from("reading_progress").upsert(
    { user_id: user.id, story_id: storyId, chapter_id: chapterId, scroll_position, updated_at: new Date().toISOString() },
    { onConflict: "user_id,story_id" },
  );
  return error ? fail(error.message) : { ok: true };
}

/**
 * Puts a story on exactly the given shelves. Reading, Plan to Read and Completed are mutually exclusive;
 * custom shelves are independent.
 */
export async function setStoryShelves(storyId: string, shelfIds: string[]): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in to use your library.");

  const { data: shelves, error } = await supabase.from("shelves").select("id, kind").eq("user_id", user.id);
  if (error || !shelves) return fail(error?.message ?? "Could not load your shelves.");
  const owned = new Map(shelves.map((s) => [s.id, s.kind as string]));
  const wanted = shelfIds.filter((id) => owned.has(id));
  if (wanted.filter((id) => DEFAULT_KINDS.includes(owned.get(id)!)).length > 1) {
    return fail("A story can be on only one of Reading, Plan to Read and Completed.");
  }

  const del = await supabase
    .from("shelf_items")
    .delete()
    .eq("story_id", storyId)
    .in("shelf_id", [...owned.keys()].filter((id) => !wanted.includes(id)));
  if (del.error) return fail(del.error.message);
  if (wanted.length) {
    const ins = await supabase
      .from("shelf_items")
      .upsert(wanted.map((shelf_id) => ({ shelf_id, story_id: storyId })), { onConflict: "shelf_id,story_id", ignoreDuplicates: true });
    if (ins.error) return fail(ins.error.message);
  }
  revalidatePath("/library");
  return { ok: true };
}

export async function createShelf(name: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in to use your library.");
  const clean = name.trim();
  if (!clean || clean.length > 60) return fail("Shelf names are 1 to 60 characters.");
  const { count } = await supabase.from("shelves").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= 30) return fail("You can have up to 30 shelves.");
  const { error } = await supabase
    .from("shelves")
    .insert({ user_id: user.id, name: clean, kind: "custom", position: count ?? 0 });
  if (error) return fail(error.code === "23505" ? "You already have a shelf with that name." : error.message);
  revalidatePath("/library");
  return { ok: true };
}

export async function renameShelf(shelfId: string, name: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in to use your library.");
  const clean = name.trim();
  if (!clean || clean.length > 60) return fail("Shelf names are 1 to 60 characters.");
  const { error, count } = await supabase
    .from("shelves")
    .update({ name: clean }, { count: "exact" })
    .eq("id", shelfId)
    .eq("kind", "custom");
  if (error) return fail(error.code === "23505" ? "You already have a shelf with that name." : error.message);
  if (!count) return fail("Only custom shelves can be renamed.");
  revalidatePath("/library");
  return { ok: true };
}

export async function deleteShelf(shelfId: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in to use your library.");
  const { error, count } = await supabase.from("shelves").delete({ count: "exact" }).eq("id", shelfId).eq("kind", "custom");
  if (error) return fail(error.message);
  if (!count) return fail("Only custom shelves can be deleted.");
  revalidatePath("/library");
  return { ok: true };
}

export async function removeFromShelf(shelfId: string, storyId: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in to use your library.");
  const { error } = await supabase.from("shelf_items").delete().eq("shelf_id", shelfId).eq("story_id", storyId);
  if (error) return fail(error.message);
  revalidatePath("/library");
  return { ok: true };
}
