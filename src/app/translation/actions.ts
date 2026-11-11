"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ANON_COOKIE } from "@/lib/discovery/viewer";
import { LANG_COOKIE, isLanguage, parseLangCookie, splitParagraphs, withStoryLanguage } from "@/lib/translation/languages";
import { machineTranslationReady, supports, translateChapter, translationProvider } from "@/lib/translation/providers";
import type { ActionResult } from "@/lib/studio/types";

const fail = (error: string): ActionResult => ({ ok: false, error });
const DAILY_SIGNED_IN = 40;
const DAILY_DEVICE = 10;

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Remembers which language this reader reads a story in (per story, on this device). null = the original. */
export async function setReadingLanguage(storyId: string, lang: string | null): Promise<ActionResult> {
  if (lang !== null && !isLanguage(lang)) return fail("Unknown language.");
  const jar = await cookies();
  const next = withStoryLanguage(parseLangCookie(jar.get(LANG_COOKIE)?.value), storyId, lang);
  jar.set(LANG_COOKIE, JSON.stringify(next), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return { ok: true };
}

/** Rate limit for new machine translations: per account, or per device for signed-out readers. */
async function checkQuota(admin: ReturnType<typeof createAdminClient>, userId: string | null, anonId: string | null) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const q = admin.from("translation_requests").select("id", { count: "exact", head: true }).gte("created_at", since);
  const { count } = userId ? await q.eq("user_id", userId) : await q.eq("anon_id", anonId ?? "-");
  const limit = userId ? DAILY_SIGNED_IN : DAILY_DEVICE;
  return (count ?? 0) < limit
    ? null
    : userId
      ? `You've translated ${limit} chapters today. Try again tomorrow.`
      : `You've translated ${limit} chapters today. Sign in to translate more.`;
}

export interface TranslatedText {
  title: string;
  paragraphs: string[];
}

/**
 * The machine translation of a chapter into `lang`: from the shared cache when it is up to date, otherwise made
 * now (counted against the daily limit) and cached for every reader after.
 * `forDraft` lets an approved translator start from a machine draft even where readers can't machine-translate.
 */
export async function machineTranslate(
  chapterId: string,
  lang: string,
  opts: { forDraft?: boolean } = {},
): Promise<ActionResult & { text?: TranslatedText }> {
  if (!isLanguage(lang)) return fail("Unknown language.");
  if (!machineTranslationReady()) return fail("Machine translation isn't set up on this site yet.");
  const { supabase, user } = await currentUser();

  // Reading the chapter through the reader's own session checks they may read it.
  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, title, body, content_hash, status, story_id, stories(language, allow_machine_translation)")
    .eq("id", chapterId)
    .eq("status", "published")
    .maybeSingle();
  if (!chapter) return fail("This chapter isn't available.");
  const story = chapter.stories as unknown as { language: string; allow_machine_translation: boolean };
  if (story.language === lang) return fail("This chapter is already in that language.");
  if (opts.forDraft) {
    if (!user) return fail("Sign in first.");
    const { data: ok } = await supabase.rpc("is_story_translator", { p_story_id: chapter.story_id, p_language: lang });
    if (!ok) return fail("You aren't a translator of this story.");
  } else if (!story.allow_machine_translation) {
    return fail("The writer hasn't allowed machine translation for this story.");
  }
  const provider = translationProvider()!;
  if (!supports(provider, lang)) return fail("Machine translation into that language isn't available.");

  const admin = createAdminClient();
  const { data: cached } = await admin
    .from("chapter_translations")
    .select("title, body, source_hash")
    .eq("chapter_id", chapterId)
    .eq("language", lang)
    .eq("kind", "machine")
    .maybeSingle();
  if (cached && cached.source_hash === chapter.content_hash) {
    return { ok: true, text: { title: cached.title, paragraphs: splitParagraphs(cached.body) } };
  }

  const anonId = user ? null : ((await cookies()).get(ANON_COOKIE)?.value ?? null);
  if (!user && !anonId) return fail("Sign in to translate chapters.");
  const over = await checkQuota(admin, user?.id ?? null, anonId);
  if (over) return fail(over);

  let result;
  try {
    result = await translateChapter({ from: story.language, to: lang, title: chapter.title, paragraphs: splitParagraphs(chapter.body) });
  } catch (e) {
    return fail((e as Error).message || "The translation didn't work. Please try again.");
  }
  const body = result.paragraphs.join("\n\n");
  await admin.from("translation_requests").insert({ user_id: user?.id ?? null, anon_id: anonId, chapter_id: chapterId, language: lang });
  const { error } = await admin.from("chapter_translations").upsert(
    {
      chapter_id: chapterId,
      language: lang,
      kind: "machine",
      title: result.title,
      body,
      published: true,
      source_hash: chapter.content_hash,
      provider: result.provider,
      translator_id: null,
    },
    { onConflict: "chapter_id,language,kind" },
  );
  if (error) console.error("caching translation failed", error.message);
  return { ok: true, text: { title: result.title, paragraphs: result.paragraphs } };
}

// ---------------------------------------------------------------------------
// Volunteer translators
// ---------------------------------------------------------------------------
function friendly(message: string) {
  if (/row-level security/.test(message)) return "You can't do that for this story.";
  if (/duplicate key/.test(message)) return "There's already a request for this language.";
  return message.replace(/^.*?: /, "").replace(/^\w/, (c) => c.toUpperCase());
}

/** A translator asks to translate a story into one of their languages. */
export async function askToTranslate(storyId: string, lang: string, message: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in to volunteer as a translator.");
  if (!isLanguage(lang)) return fail("Pick a language.");
  const { data: existing } = await supabase
    .from("story_translators")
    .select("status")
    .eq("story_id", storyId)
    .eq("user_id", user.id)
    .eq("language", lang)
    .maybeSingle();
  if (existing?.status === "approved") return fail("You already translate this story into that language.");
  if (existing?.status === "requested") return fail("You've already asked; the writer will answer soon.");
  if (existing) await supabase.from("story_translators").delete().eq("story_id", storyId).eq("user_id", user.id).eq("language", lang);
  const { error } = await supabase
    .from("story_translators")
    .insert({ story_id: storyId, user_id: user.id, language: lang, status: "requested", message: message.trim().slice(0, 500) || null });
  if (error) return fail(friendly(error.message));
  // Add the language to their translator profile if it isn't there yet.
  const { data: p } = await supabase.from("profiles").select("translator_languages").eq("id", user.id).single();
  if (p && !p.translator_languages.includes(lang) && p.translator_languages.length < 12) {
    await supabase.from("profiles").update({ translator_languages: [...p.translator_languages, lang] }).eq("id", user.id);
  }
  return { ok: true };
}

/** A writer invites someone (by username) to translate their story. */
export async function inviteTranslator(storyId: string, username: string, lang: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  if (!isLanguage(lang)) return fail("Pick a language.");
  const { data: p } = await supabase.from("profiles").select("id").eq("username", username.trim().replace(/^@/, "").toLowerCase()).maybeSingle();
  if (!p) return fail(`There's no one called @${username.replace(/^@/, "")}.`);
  if (p.id === user.id) return fail("You can't invite yourself.");
  await supabase.from("story_translators").delete().eq("story_id", storyId).eq("user_id", p.id).eq("language", lang).eq("status", "declined");
  const { error } = await supabase.from("story_translators").insert({ story_id: storyId, user_id: p.id, language: lang, status: "invited" });
  if (error) return fail(friendly(error.message));
  return { ok: true };
}

/** Writers answer requests; translators answer invitations. */
export async function answerTranslator(storyId: string, userId: string, lang: string, approve: boolean): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  const { error, count } = await supabase
    .from("story_translators")
    .update({ status: approve ? "approved" : "declined" }, { count: "exact" })
    .eq("story_id", storyId)
    .eq("user_id", userId)
    .eq("language", lang);
  if (error) return fail(friendly(error.message));
  if (!count) return fail("That request is no longer open.");
  return { ok: true };
}

/** A writer removes a translator, or a translator stops translating. Their published chapters stay unless deleted. */
export async function removeTranslator(storyId: string, userId: string, lang: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  const { error } = await supabase.from("story_translators").delete().eq("story_id", storyId).eq("user_id", userId).eq("language", lang);
  return error ? fail(friendly(error.message)) : { ok: true };
}

/** Saves a volunteer translation of one chapter, as a draft or published. */
export async function saveCommunityTranslation(input: {
  chapterId: string;
  language: string;
  title: string;
  body: string;
  publish: boolean;
}): Promise<ActionResult & { savedAt?: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  if (!isLanguage(input.language)) return fail("Unknown language.");
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (input.publish && !body) return fail("Translate the chapter before publishing it.");
  if (body.length > 400000) return fail("That's longer than a chapter can be.");
  const { data: chapter } = await supabase.from("chapters").select("content_hash").eq("id", input.chapterId).maybeSingle();
  if (!chapter) return fail("This chapter isn't available.");
  const { data, error } = await supabase
    .from("chapter_translations")
    .upsert(
      {
        chapter_id: input.chapterId,
        language: input.language,
        kind: "community",
        title: input.title.trim().slice(0, 300),
        body,
        translator_id: user.id,
        published: input.publish,
        source_hash: chapter.content_hash,
      },
      { onConflict: "chapter_id,language,kind" },
    )
    .select("updated_at")
    .single();
  if (error) return fail(friendly(error.message));
  return { ok: true, savedAt: data.updated_at };
}

/** The languages someone translates, shown on their profile and in the translator directory. */
export async function setTranslatorLanguages(langs: string[]): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return fail("Sign in first.");
  const clean = [...new Set(langs.filter(isLanguage))].slice(0, 12);
  const { error } = await supabase.from("profiles").update({ translator_languages: clean }).eq("id", user.id);
  return error ? fail(error.message) : { ok: true };
}
