"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { ActionResult, ContentRating, StoryStatus } from "@/lib/studio/types";
import { MAX_COVER_BYTES, MAX_GENRES, MAX_TAGS, RATINGS, STORY_STATUSES } from "@/lib/studio/types";
import { parseTags, slugify } from "@/lib/studio/text";
import { publicStorageUrl } from "@/lib/supabase/env";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

const fail = (error: string): ActionResult => ({ ok: false, error });

interface StoryInput {
  title: string;
  synopsis: string;
  rating: ContentRating;
  status: StoryStatus;
  genres: string[];
  tags: string[];
  cover: File | null;
  removeCover: boolean;
}

function readStoryForm(form: FormData): StoryInput | string {
  const title = String(form.get("title") ?? "").trim();
  const synopsis = String(form.get("synopsis") ?? "").trim();
  const rating = String(form.get("rating") ?? "everyone") as ContentRating;
  const status = String(form.get("status") ?? "draft") as StoryStatus;
  const genres = form.getAll("genres").map(String);
  const tags = parseTags(String(form.get("tags") ?? ""));
  const coverEntry = form.get("cover");
  const cover = coverEntry instanceof File && coverEntry.size > 0 ? coverEntry : null;

  if (!title) return "Give your story a title.";
  if (title.length > 200) return "Titles can be at most 200 characters.";
  if (synopsis.length > 5000) return "The synopsis can be at most 5,000 characters.";
  if (!RATINGS.some((r) => r.value === rating)) return "Pick a content rating.";
  if (!STORY_STATUSES.some((s) => s.value === status)) return "Pick a story status.";
  if (genres.length === 0) return "Pick at least one genre.";
  if (genres.length > MAX_GENRES) return `Pick at most ${MAX_GENRES} genres.`;
  if (tags.length > MAX_TAGS) return `Use at most ${MAX_TAGS} tags.`;
  if (cover) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(cover.type)) return "Covers must be JPG, PNG or WebP.";
    if (cover.size > MAX_COVER_BYTES) return "Covers must be 2 MB or smaller.";
  }
  return { title, synopsis, rating, status, genres, tags, cover, removeCover: form.get("removeCover") === "on" };
}

async function uniqueSlug(supabase: Supabase, authorId: string, title: string, exceptId?: string) {
  const base = slugify(title);
  const { data } = await supabase
    .from("stories")
    .select("id, slug")
    .eq("author_id", authorId)
    .like("slug", `${base}%`);
  const taken = new Set((data ?? []).filter((s) => s.id !== exceptId).map((s) => s.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

async function uploadCover(supabase: Supabase, userId: string, storyId: string, file: File) {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${storyId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("covers").upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Cover upload failed: ${error.message}`);
  return publicStorageUrl("covers", path);
}

async function saveClassification(supabase: Supabase, storyId: string, input: StoryInput) {
  const g = await supabase.rpc("set_story_genres", { p_story_id: storyId, p_genre_slugs: input.genres });
  if (g.error) return g.error.message;
  const t = await supabase.rpc("set_story_tags", { p_story_id: storyId, p_tag_names: input.tags });
  if (t.error) return t.error.message;
  return null;
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export async function createStory(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser("/studio/new");
  const input = readStoryForm(form);
  if (typeof input === "string") return fail(input);

  const slug = await uniqueSlug(supabase, user.id, input.title);
  const { data: story, error } = await supabase
    .from("stories")
    .insert({
      author_id: user.id,
      title: input.title,
      slug,
      synopsis: input.synopsis,
      rating: input.rating,
      status: input.status,
    })
    .select("id")
    .single();
  if (error || !story) return fail(error?.message ?? "Could not create the story.");

  const classErr = await saveClassification(supabase, story.id, input);
  if (classErr) return fail(classErr);

  // A first-time writer may pick a pen name along with their first story.
  const penName = String(form.get("penName") ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (penName) await supabase.from("profiles").update({ display_name: penName }).eq("id", user.id);

  if (input.cover) {
    try {
      const url = await uploadCover(supabase, user.id, story.id, input.cover);
      await supabase.from("stories").update({ cover_url: url }).eq("id", story.id);
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  revalidatePath("/studio");
  redirect(`/studio/${story.id}`);
}

export async function updateStory(storyId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser(`/studio/${storyId}`);
  const input = readStoryForm(form);
  if (typeof input === "string") return fail(input);

  const { data: existing } = await supabase
    .from("stories")
    .select("title, slug, cover_url")
    .eq("id", storyId)
    .eq("author_id", user.id)
    .single();
  if (!existing) return fail("Story not found.");

  let cover_url: string | null = existing.cover_url;
  if (input.removeCover) cover_url = null;
  if (input.cover) {
    try {
      cover_url = await uploadCover(supabase, user.id, storyId, input.cover);
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  const slug =
    existing.title === input.title ? existing.slug : await uniqueSlug(supabase, user.id, input.title, storyId);

  const { error } = await supabase
    .from("stories")
    .update({
      title: input.title,
      slug,
      synopsis: input.synopsis,
      rating: input.rating,
      status: input.status,
      cover_url,
    })
    .eq("id", storyId);
  if (error) return fail(error.message);

  const classErr = await saveClassification(supabase, storyId, input);
  if (classErr) return fail(classErr);

  revalidatePath(`/studio/${storyId}`);
  revalidatePath("/studio");
  return { ok: true, message: "Saved." };
}

export async function setStoryStatus(storyId: string, status: StoryStatus): Promise<ActionResult> {
  const { supabase } = await requireUser(`/studio/${storyId}`);
  if (!STORY_STATUSES.some((s) => s.value === status)) return fail("Unknown status.");
  const { error } = await supabase.from("stories").update({ status }).eq("id", storyId);
  if (error) return fail(error.message);
  revalidatePath(`/studio/${storyId}`);
  revalidatePath("/studio");
  return { ok: true };
}

export async function deleteStory(storyId: string): Promise<ActionResult> {
  const { supabase } = await requireUser(`/studio/${storyId}`);
  const { error, count } = await supabase.from("stories").delete({ count: "exact" }).eq("id", storyId);
  if (error) return fail(error.message);
  if (!count) return fail("Story not found.");
  revalidatePath("/studio");
  redirect("/studio");
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

export async function createChapter(storyId: string): Promise<ActionResult> {
  const { supabase } = await requireUser(`/studio/${storyId}`);
  const { data, error } = await supabase.rpc("create_chapter", { p_story_id: storyId, p_title: "" });
  if (error || !data) return fail(error?.message ?? "Could not create a chapter.");
  revalidatePath(`/studio/${storyId}`);
  redirect(`/studio/${storyId}/chapters/${data}`);
}

export interface SaveChapterResult {
  ok: boolean;
  error?: string;
  conflict?: boolean;
  savedAt?: string;
  wordCount?: number;
}

/** Autosave target: writes title and body only, never the publishing state. */
export async function saveChapterDraft(
  chapterId: string,
  title: string,
  body: string,
  expectedUpdatedAt: string | null,
): Promise<SaveChapterResult> {
  const { supabase } = await requireUser();
  if (title.length > 200) return { ok: false, error: "Chapter titles can be at most 200 characters." };
  if (body.length > 200_000) return { ok: false, error: "Chapters can be at most 200,000 characters." };

  let query = supabase.from("chapters").update({ title, body }).eq("id", chapterId);
  // Optimistic concurrency: refuse to overwrite a newer save from another tab or device.
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await query.select("updated_at, word_count").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      conflict: true,
      error: "This chapter was changed somewhere else. Copy your text, then reload to get the latest version.",
    };
  }
  return { ok: true, savedAt: data.updated_at, wordCount: data.word_count };
}

async function chapterStory(supabase: Supabase, chapterId: string) {
  const { data } = await supabase.from("chapters").select("story_id, body").eq("id", chapterId).single();
  return data;
}

export async function publishChapter(chapterId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const ch = await chapterStory(supabase, chapterId);
  if (!ch) return fail("Chapter not found.");
  if (!ch.body.trim()) return fail("Write something before publishing.");
  const { data, error } = await supabase
    .from("chapters")
    .update({ status: "published", publish_at: null })
    .eq("id", chapterId)
    .select("updated_at")
    .single();
  if (error) return fail(error.message);
  revalidatePath(`/studio/${ch.story_id}`);
  return { ok: true, message: "Published.", updatedAt: data.updated_at };
}

export async function scheduleChapter(chapterId: string, publishAtIso: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const when = new Date(publishAtIso);
  if (Number.isNaN(when.getTime())) return fail("Pick a valid date and time.");
  if (when.getTime() < Date.now() + 60_000) return fail("Pick a time at least a minute from now.");
  if (when.getTime() > Date.now() + 365 * 24 * 3600_000) return fail("Schedule at most a year ahead.");
  const ch = await chapterStory(supabase, chapterId);
  if (!ch) return fail("Chapter not found.");
  if (!ch.body.trim()) return fail("Write something before scheduling.");
  const { data, error } = await supabase
    .from("chapters")
    .update({ status: "scheduled", publish_at: when.toISOString() })
    .eq("id", chapterId)
    .select("updated_at")
    .single();
  if (error) return fail(error.message);
  revalidatePath(`/studio/${ch.story_id}`);
  return { ok: true, message: "Scheduled.", updatedAt: data.updated_at };
}

export async function unpublishChapter(chapterId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const ch = await chapterStory(supabase, chapterId);
  if (!ch) return fail("Chapter not found.");
  const { data, error } = await supabase
    .from("chapters")
    .update({ status: "draft", publish_at: null })
    .eq("id", chapterId)
    .select("updated_at")
    .single();
  if (error) return fail(error.message);
  revalidatePath(`/studio/${ch.story_id}`);
  return { ok: true, message: "Moved back to drafts.", updatedAt: data.updated_at };
}

export async function reorderChapters(storyId: string, chapterIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser(`/studio/${storyId}`);
  const { error } = await supabase.rpc("reorder_chapters", { p_story_id: storyId, p_chapter_ids: chapterIds });
  if (error) return fail(error.message);
  revalidatePath(`/studio/${storyId}`);
  return { ok: true };
}

export async function deleteChapter(chapterId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const ch = await chapterStory(supabase, chapterId);
  if (!ch) return fail("Chapter not found.");
  const { error } = await supabase.rpc("delete_chapter", { p_chapter_id: chapterId });
  if (error) return fail(error.message);
  revalidatePath(`/studio/${ch.story_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Choice points
// ---------------------------------------------------------------------------

export async function saveChoicePoint(
  chapterId: string,
  choice: { anchor: number; prompt: string; options: { label: string; branch: string }[] },
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const ch = await chapterStory(supabase, chapterId);
  if (!ch) return fail("Chapter not found.");
  const { error } = await supabase.rpc("save_choice_point", {
    p_chapter_id: chapterId,
    p_anchor: Math.max(0, Math.floor(choice.anchor)),
    p_prompt: choice.prompt,
    p_options: choice.options.map((o) => ({ label: o.label, branch: o.branch })),
  });
  if (error) return fail(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  revalidatePath(`/studio/${ch.story_id}`);
  return { ok: true, message: "Choice saved." };
}

export async function deleteChoicePoint(chapterId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const ch = await chapterStory(supabase, chapterId);
  if (!ch) return fail("Chapter not found.");
  const { error } = await supabase.from("choice_points").delete().eq("chapter_id", chapterId);
  if (error) return fail(error.message);
  revalidatePath(`/studio/${ch.story_id}`);
  return { ok: true, message: "Choice removed." };
}
