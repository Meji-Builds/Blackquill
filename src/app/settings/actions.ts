"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/studio/types";
import { publicStorageUrl } from "@/lib/supabase/env";

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

const PICTURE_SIZE = 320;

async function deleteOldPictures(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, keep?: string) {
  const { data } = await supabase.storage.from("avatars").list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await supabase.storage.from("avatars").remove(old);
}

/**
 * Saves a new profile picture. The browser has already cropped it square; here it is re-encoded (which also strips
 * location and camera data) and shrunk to 320px WebP, then the old picture is deleted.
 */
export async function setProfilePicture(form: FormData): Promise<ActionResult & { url?: string }> {
  const { supabase, user } = await requireUser("/settings");
  const file = form.get("picture");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a picture first." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "That file isn't a picture." };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "That picture is too large. Try a smaller one." };

  let webp: Buffer;
  try {
    const sharp = (await import("sharp")).default;
    webp = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(PICTURE_SIZE, PICTURE_SIZE, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { ok: false, error: "We couldn't read that picture. Try a JPG or PNG." };
  }

  const path = `${user.id}/${Date.now()}.webp`;
  const upload = () => supabase.storage.from("avatars").upload(path, webp, { contentType: "image/webp" });
  let up = await upload();
  if (up.error && /row-level security/i.test(up.error.message)) {
    // Too many files left over from interrupted uploads: tidy up (keeping the current picture) and try once more.
    const { data: me } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
    await deleteOldPictures(supabase, user.id, me?.avatar_url?.split("/avatars/")[1]);
    up = await upload();
  }
  if (up.error) return { ok: false, error: "Your picture couldn't be uploaded. Please try again." };
  const url = publicStorageUrl("avatars", path);
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) {
    await supabase.storage.from("avatars").remove([path]);
    if (/changed your picture a lot/.test(error.message)) return { ok: false, error: "You've changed your picture a lot today. Try again tomorrow." };
    return { ok: false, error: error.message };
  }
  await deleteOldPictures(supabase, user.id, path);
  revalidatePath("/", "layout");
  return { ok: true, url };
}

/** Goes back to the monogram. */
export async function removeProfilePicture(): Promise<ActionResult> {
  const { supabase, user } = await requireUser("/settings");
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  await deleteOldPictures(supabase, user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
