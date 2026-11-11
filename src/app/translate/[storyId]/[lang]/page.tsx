import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { BackLink } from "@/components/ui/BackLink";
import { isLanguage, languageLabel } from "@/lib/translation/languages";

export const metadata: Metadata = { title: "Translate" };
type Params = Promise<{ storyId: string; lang: string }>;

export default async function TranslateStory({ params }: { params: Params }) {
  const { storyId, lang } = await params;
  if (!isLanguage(lang) || !/^[0-9a-f-]{36}$/i.test(storyId)) notFound();
  const { supabase, user } = await requireUser(`/translate/${storyId}/${lang}`);
  const { data: ok } = await supabase.rpc("is_story_translator", { p_story_id: storyId, p_language: lang });
  if (!ok) notFound();
  const [{ data: story }, { data: chapters }, { data: mine }] = await Promise.all([
    supabase.from("stories").select("id, title, language").eq("id", storyId).single(),
    supabase.from("chapters").select("id, number, title, word_count, content_hash").eq("story_id", storyId).eq("status", "published").order("number"),
    supabase.from("chapter_translations").select("chapter_id, published, source_hash, title, translator_id").eq("language", lang).eq("kind", "community"),
  ]);
  if (!story) notFound();
  const byChapter = new Map((mine ?? []).map((t) => [t.chapter_id, t]));
  const list = chapters ?? [];
  const published = list.filter((c) => byChapter.get(c.id)?.published).length;
  const next = list.find((c) => !byChapter.get(c.id)?.published);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-12">
      <BackLink href="/translate">Translation desk</BackLink>
      <p className="mt-3 text-xs font-semibold tracking-wide text-gold uppercase">
        {languageLabel(story.language)} → {languageLabel(lang)}
      </p>
      <h1 className="mt-1 font-display text-[34px] leading-tight font-semibold">{story.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {published} of {list.length} chapters published in {languageLabel(lang)}.
      </p>
      {next && (
        <Link href={`/translate/${storyId}/${lang}/${next.number}`} className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-accent-strong px-5 text-sm font-medium text-white">
          {byChapter.has(next.id) ? "Continue" : "Start"} with chapter {next.number} <ChevronRight className="h-4 w-4" />
        </Link>
      )}
      <ol className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {list.map((c) => {
          const t = byChapter.get(c.id);
          const someoneElse = t && t.translator_id !== user.id;
          const state = !t ? ["Not started", "bg-border-strong"] : t.source_hash !== c.content_hash ? ["Original changed", "bg-warning"] : t.published ? ["Published", "bg-success"] : ["Draft", "bg-accent"];
          return (
            <li key={c.id}>
              <Link href={`/translate/${storyId}/${lang}/${c.number}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2">
                <span className="w-7 text-right text-sm text-muted tabular-nums">{c.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t?.title || c.title || `Chapter ${c.number}`}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${state[1]}`} /> {state[0]}
                    {someoneElse && " · by another translator"} · {c.word_count.toLocaleString()} words
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
