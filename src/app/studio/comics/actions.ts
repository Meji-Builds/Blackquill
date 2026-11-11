"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { splitScenes } from "@/lib/comics/scenes";
import { COMIC_STYLES, panelPrompt } from "@/lib/comics/styles";
import { generatePanelImage } from "@/lib/comics/providers";
import { publicStorageUrl } from "@/lib/supabase/env";
import type { ActionResult } from "@/lib/studio/types";

const fail = (error: string): ActionResult => ({ ok: false, error });
const MAX_REFERENCE = 2.5 * 1024 * 1024;
const niceDbError = (m: string) => m.charAt(0).toUpperCase() + m.slice(1) + (m.endsWith(".") ? "" : ".");

async function chapterContext(chapterId: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("chapters")
    .select("id, number, story_id, body, stories!inner(author_id)")
    .eq("id", chapterId)
    .maybeSingle();
  const story = data?.stories as unknown as { author_id: string } | undefined;
  if (!data || story?.author_id !== user.id) return null;
  return { supabase, user, chapter: data };
}

function revalidate(storyId: string, chapterId: string, number: number) {
  revalidatePath(`/studio/${storyId}/chapters/${chapterId}/comic`);
  revalidatePath(`/story/${storyId}/chapter/${number}`);
}

/** Splits the chapter into scenes with draft prompts. Replaces any existing panels (the budget used is kept). */
export async function splitIntoScenes(chapterId: string, styleId: string): Promise<ActionResult> {
  const ctx = await chapterContext(chapterId);
  if (!ctx) return fail("Chapter not found.");
  const scenes = splitScenes(ctx.chapter.body);
  if (scenes.length === 0) return fail("Write the chapter before making comic panels.");
  const style = COMIC_STYLES.some((s) => s.id === styleId) ? styleId : "webtoon";
  const { error } = await ctx.supabase.rpc("prepare_comic_scenes", {
    p_chapter_id: chapterId,
    p_scenes: scenes,
    p_style: style,
  });
  if (error) return fail(niceDbError(error.message));
  revalidate(ctx.chapter.story_id, chapterId, ctx.chapter.number);
  return { ok: true, message: `Split into ${scenes.length} scenes.` };
}

export async function updatePanelText(panelId: string, fields: { prompt?: string; caption?: string }): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const patch: Record<string, string> = {};
  if (fields.prompt !== undefined) {
    if (!fields.prompt.trim() || fields.prompt.length > 1000) return fail("Prompts are 1 to 1,000 characters.");
    patch.prompt = fields.prompt.trim();
  }
  if (fields.caption !== undefined) {
    if (fields.caption.length > 300) return fail("Captions can be at most 300 characters.");
    patch.caption = fields.caption.trim();
  }
  const { error, count } = await supabase.from("comic_panels").update(patch, { count: "exact" }).eq("id", panelId);
  if (error) return fail(niceDbError(error.message));
  if (!count) return fail("Panel not found.");
  return { ok: true };
}

export async function setChapterStyle(chapterId: string, styleId: string): Promise<ActionResult> {
  const ctx = await chapterContext(chapterId);
  if (!ctx) return fail("Chapter not found.");
  if (!COMIC_STYLES.some((s) => s.id === styleId)) return fail("Unknown style.");
  const { error } = await ctx.supabase.from("comic_panels").update({ style: styleId }).eq("chapter_id", chapterId);
  if (error) return fail(niceDbError(error.message));
  revalidate(ctx.chapter.story_id, chapterId, ctx.chapter.number);
  return { ok: true };
}

/** Stores a reference image (private) that guides the look of every panel in the chapter. */
export async function uploadReference(chapterId: string, form: FormData): Promise<ActionResult> {
  const ctx = await chapterContext(chapterId);
  if (!ctx) return fail("Chapter not found.");
  const file = form.get("reference");
  if (!(file instanceof File) || file.size === 0) {
    const { error } = await ctx.supabase.from("comic_panels").update({ reference_image_url: null }).eq("chapter_id", chapterId);
    if (error) return fail(niceDbError(error.message));
    revalidate(ctx.chapter.story_id, chapterId, ctx.chapter.number);
    return { ok: true, message: "Reference removed." };
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return fail("Reference images must be PNG, JPG or WebP.");
  if (file.size > MAX_REFERENCE) return fail("Reference images must be 2.5 MB or smaller.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${ctx.user.id}/${chapterId}-${Date.now()}.${ext}`;
  const up = await ctx.supabase.storage.from("references").upload(path, file, { contentType: file.type });
  if (up.error) return fail(`Upload failed: ${up.error.message}`);
  const { error } = await ctx.supabase.from("comic_panels").update({ reference_image_url: path }).eq("chapter_id", chapterId);
  if (error) return fail(niceDbError(error.message));
  revalidate(ctx.chapter.story_id, chapterId, ctx.chapter.number);
  return { ok: true, message: "Reference saved. New panels will follow its look." };
}

export interface GenerateResult {
  ok: boolean;
  error?: string;
  imageUrl?: string;
  remaining?: number;
}

/** Spends one generation from the chapter's budget, generates the panel image, stores it and attaches it. */
export async function generatePanel(panelId: string): Promise<GenerateResult> {
  const { supabase, user } = await requireUser();
  const { data: panel } = await supabase
    .from("comic_panels")
    .select("id, chapter_id, scene_index, prompt, caption, style, reference_image_url, generation_count, chapters!inner(story_id, number)")
    .eq("id", panelId)
    .maybeSingle();
  if (!panel) return { ok: false, error: "Panel not found." };
  const ch = panel.chapters as unknown as { story_id: string; number: number };

  const begin = await supabase.rpc("begin_panel_generation", { p_panel_id: panelId });
  if (begin.error) return { ok: false, error: niceDbError(begin.error.message) };

  let reference: { bytes: Buffer; contentType: string } | null = null;
  if (panel.reference_image_url) {
    const dl = await supabase.storage.from("references").download(panel.reference_image_url);
    if (dl.data) reference = { bytes: Buffer.from(await dl.data.arrayBuffer()), contentType: dl.data.type || "image/png" };
  }

  try {
    const image = await generatePanelImage({
      prompt: panelPrompt(panel.prompt, panel.style),
      caption: panel.caption,
      styleId: panel.style,
      seed: `${panel.id}:${panel.generation_count + 1}:${panel.prompt}`,
      reference,
    });
    const path = `${user.id}/${panel.chapter_id}/${panel.id}-${Date.now()}.${image.extension}`;
    const up = await supabase.storage.from("comic-panels").upload(path, image.bytes, { contentType: image.contentType });
    if (up.error) throw new Error(`Couldn't store the image: ${up.error.message}`);
    const url = publicStorageUrl("comic-panels", path);
    const rec = await supabase.rpc("record_panel_image", { p_panel_id: panelId, p_url: url });
    if (rec.error) throw new Error(niceDbError(rec.error.message));
    revalidate(ch.story_id, panel.chapter_id, ch.number);
    return { ok: true, imageUrl: url, remaining: begin.data as number };
  } catch (e) {
    const message = (e as Error).message || "Generation failed.";
    await supabase.rpc("record_panel_image", { p_panel_id: panelId, p_url: "", p_error: message });
    return { ok: false, error: message, remaining: begin.data as number };
  }
}

export async function reviewPanel(panelId: string, decision: "approved" | "rejected" | "pending"): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("comic_panels")
    .update({ status: decision })
    .eq("id", panelId)
    .select("chapter_id, chapters!inner(story_id, number)")
    .maybeSingle();
  if (error) return fail(niceDbError(error.message));
  if (!data) return fail("Panel not found.");
  const ch = data.chapters as unknown as { story_id: string; number: number };
  revalidate(ch.story_id, data.chapter_id, ch.number);
  return { ok: true };
}
