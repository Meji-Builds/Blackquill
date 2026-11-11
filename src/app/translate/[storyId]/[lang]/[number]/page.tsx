import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { TranslationEditor } from "@/components/translation/TranslationEditor";
import { isLanguage } from "@/lib/translation/languages";
import { machineTranslationReady, supports, translationProvider } from "@/lib/translation/providers";

export const metadata: Metadata = { title: "Translate chapter" };
type Params = Promise<{ storyId: string; lang: string; number: string }>;

export default async function TranslateChapter({ params }: { params: Params }) {
  const { storyId, lang, number } = await params;
  const n = Number(number);
  if (!isLanguage(lang) || !/^[0-9a-f-]{36}$/i.test(storyId) || !Number.isInteger(n) || n < 1) notFound();
  const { supabase, user } = await requireUser(`/translate/${storyId}/${lang}/${n}`);
  const { data: ok } = await supabase.rpc("is_story_translator", { p_story_id: storyId, p_language: lang });
  if (!ok) notFound();
  const [{ data: story }, { data: chapter }, { data: numbers }] = await Promise.all([
    supabase.from("stories").select("id, title, language").eq("id", storyId).single(),
    supabase.from("chapters").select("id, number, title, body, content_hash").eq("story_id", storyId).eq("number", n).eq("status", "published").maybeSingle(),
    supabase.from("chapters").select("number").eq("story_id", storyId).eq("status", "published").order("number"),
  ]);
  if (!story || !chapter) notFound();
  const { data: existing } = await supabase
    .from("chapter_translations")
    .select("title, body, published, source_hash, translator_id, updated_at, profiles(username, display_name)")
    .eq("chapter_id", chapter.id)
    .eq("language", lang)
    .eq("kind", "community")
    .maybeSingle();
  const owner = existing?.profiles as unknown as { username: string; display_name: string | null } | null;
  const nums = (numbers ?? []).map((r) => r.number);
  const i = nums.indexOf(n);
  const provider = translationProvider();

  return (
    <TranslationEditor
      storyId={storyId}
      storyTitle={story.title}
      from={story.language}
      to={lang}
      chapter={{ id: chapter.id, number: chapter.number, title: chapter.title, body: chapter.body }}
      initial={
        existing && existing.translator_id === user.id
          ? { title: existing.title, body: existing.body, published: existing.published, savedAt: existing.updated_at, stale: existing.source_hash !== chapter.content_hash }
          : null
      }
      lockedBy={existing && existing.translator_id !== user.id ? (owner?.display_name || owner?.username || "another translator") : null}
      prev={i > 0 ? nums[i - 1] : null}
      next={i >= 0 && i < nums.length - 1 ? nums[i + 1] : null}
      machine={Boolean(machineTranslationReady() && provider && supports(provider, lang))}
    />
  );
}
