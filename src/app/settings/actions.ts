"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/studio/types";

const USERNAME = /^[a-z0-9_]{3,30}$/;

export async function updateProfile(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser("/settings");
  const penName = String(form.get("penName") ?? "").trim().replace(/\s+/g, " ");
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const bio = String(form.get("bio") ?? "").trim();
  const showMature = form.get("showMature") === "on";

  if (penName.length > 60) return { ok: false, error: "Pen names can be at most 60 characters." };
  if (!USERNAME.test(username))
    return { ok: false, error: "Usernames are 3 to 30 characters: lowercase letters, numbers and underscores." };
  if (bio.length > 1000) return { ok: false, error: "Your bio can be at most 1,000 characters." };

  // Only writers have pen names; for readers the field isn't shown and nothing is changed.
  const hasPenNameField = form.has("penName");
  const { error } = await supabase
    .from("profiles")
    .update({
      ...(hasPenNameField ? { display_name: penName || null } : {}),
      username,
      bio: bio || null,
      show_mature: showMature,
    })
    .eq("id", user.id);
  if (error) {
    if (/pen names are for writers/.test(error.message)) return { ok: false, error: "Pen names are for writers. Start a story first." };
    if (error.code === "23505") return { ok: false, error: `@${username} is taken. Try another username.` };
    return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

/** Live availability check for the username field. */
export async function usernameAvailable(username: string): Promise<boolean | null> {
  const { supabase, user } = await requireUser("/settings");
  const u = username.trim().toLowerCase();
  if (!USERNAME.test(u)) return null;
  const { data } = await supabase.from("profiles").select("id").eq("username", u).maybeSingle();
  return !data || data.id === user.id;
}
