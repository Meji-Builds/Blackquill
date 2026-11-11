import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LANGUAGES, LANG_COOKIE, isLanguage, parseLangCookie, splitParagraphs } from "./languages";
import { machineTranslationReady, supports, translationProvider } from "./providers";

export interface ReaderLanguages {
  /** The story's original language. */
  original: string;
  /** The language the reader picked for this story, or null for the original. */
  chosen: string | null;
  /** Languages with volunteer translations of this story, with how far along each is. */
  community: { language: string; translators: string[]; chapters: number; total: number; hasThisChapter: boolean }[];
  /** Whether readers may machine-translate this story here, and into which languages. */
  machine: boolean;
  machineLanguages: string[];
}

export type ShownTranslation =
  | { kind: "community"; language: string; translator: string | null; translatorUsername: string | null; stale: boolean }
  | { kind: "machine"; language: string }
  | { kind: "pending"; language: string } // translate on the reader's device after load
  | { kind: "missing"; language: string }; // no translation of this chapter, nor a way to make one

/** The reader's language for a story: ?lang= first (shared links), then what they picked before. */
export async function chosenLanguage(storyId: string, param: string | undefined, original: string): Promise<string | null> {
  const fromParam = param && (param === "original" ? null : isLanguage(param) ? param : undefined);
  const lang = fromParam !== undefined ? fromParam : (parseLangCookie((await cookies()).get(LANG_COOKIE)?.value)[storyId] ?? null);
  return lang && lang !== original ? lang : null;
}

/** Picks what to show for one chapter: a volunteer translation first, then a current machine one. */
export async function resolveChapterText(
  supabase: SupabaseClient,
  opts: {
    chapter: { id: string; title: string; body: string; content_hash: string };
    story: { language: string; allow_machine_translation: boolean; allow_community_translation: boolean };
    chosen: string | null;
    /** From story_languages(): every language volunteers have translated part of the story into. */
    storyTranslations: { language: string; chapters: number; translators: string[] | null }[];
    totalChapters: number;
  },
): Promise<{ title: string; paragraphs: string[]; shown: ShownTranslation | null; languages: Omit<ReaderLanguages, "chosen" | "original"> }> {
  const { chapter, story, chosen, storyTranslations, totalChapters } = opts;
  const { data } = await supabase
    .from("chapter_translations")
    .select("language, kind, title, body, source_hash, profiles(username, display_name)")
    .eq("chapter_id", chapter.id)
    .eq("published", true);
  const rows = (data ?? []) as unknown as {
    language: string;
    kind: "machine" | "community";
    title: string;
    body: string;
    source_hash: string;
    profiles: { username: string; display_name: string | null } | null;
  }[];
  const provider = translationProvider();
  const machine = story.allow_machine_translation && machineTranslationReady();
  const languages = {
    community: storyTranslations.map((t) => ({
      language: t.language,
      translators: t.translators ?? [],
      chapters: t.chapters,
      total: totalChapters,
      hasThisChapter: rows.some((r) => r.kind === "community" && r.language === t.language),
    })),
    machine,
    machineLanguages: machine && provider ? LANGUAGES.filter((l) => l.code !== story.language && supports(provider, l.code)).map((l) => l.code) : [],
  };
  const original = { title: chapter.title, paragraphs: splitParagraphs(chapter.body), languages };
  if (!chosen) return { ...original, shown: null };

  const community = rows.find((r) => r.kind === "community" && r.language === chosen);
  if (community) {
    return {
      title: community.title || chapter.title,
      paragraphs: splitParagraphs(community.body),
      shown: {
        kind: "community",
        language: chosen,
        translator: community.profiles ? community.profiles.display_name || community.profiles.username : null,
        translatorUsername: community.profiles?.username ?? null,
        stale: community.source_hash !== chapter.content_hash,
      },
      languages,
    };
  }
  const cached = rows.find((r) => r.kind === "machine" && r.language === chosen && r.source_hash === chapter.content_hash);
  if (cached) return { title: cached.title || chapter.title, paragraphs: splitParagraphs(cached.body), shown: { kind: "machine", language: chosen }, languages };
  if (machine && languages.machineLanguages.includes(chosen)) return { ...original, shown: { kind: "pending", language: chosen } };
  return { ...original, shown: { kind: "missing", language: chosen } };
}
