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
  return { ok: true };
}

export async function setComicEnabled(storyId: string, enabled: boolean, cap = 6): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("set_comic_enabled", { p_story_id: storyId, p_enabled: enabled, p_cap: cap });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
