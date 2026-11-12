"use server";

import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/studio/types";

type Target = "story" | "chapter" | "comment" | "profile";

export async function resolveReports(
  targetType: Target,
  targetId: string,
  action: "dismiss" | "remove" | "restore",
  note?: string,
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("resolve_reports", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_action: action,
    p_note: note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  // Clearing a profile also clears its picture; delete the stored files too.
  if (targetType === "profile" && action === "remove") await deleteAvatarFiles(supabase, targetId);
  return { ok: true };
}

type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

async function deleteAvatarFiles(supabase: Supabase, userId: string) {
  const { data } = await supabase.storage.from("avatars").list(userId);
  if (data?.length) await supabase.storage.from("avatars").remove(data.map((f) => `${userId}/${f.name}`));
}

/** Removes someone's profile picture (from a report about their profile or one of their comments). */
export async function removeProfilePicture(username: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: userId, error } = await supabase.rpc("remove_profile_picture", { p_username: username });
  if (error) return { ok: false, error: error.message };
  if (userId) await deleteAvatarFiles(supabase, userId as string);
  return { ok: true };
}

export async function setComicEnabled(storyId: string, enabled: boolean, cap = 6): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("set_comic_enabled", { p_story_id: storyId, p_enabled: enabled, p_cap: cap });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
