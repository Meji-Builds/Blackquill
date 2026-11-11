import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { StoryForm } from "@/components/studio/StoryForm";
import { ChapterList } from "@/components/studio/ChapterList";
import { StoryActions } from "@/components/studio/StoryActions";
import { StatusBadge } from "@/components/studio/StatusBadge";
import { BackLink } from "@/components/ui/BackLink";
import { btn } from "@/components/ui/styles";
import { BarChart3, Eye } from "lucide-react";
import { StudioTranslations } from "@/components/translation/StudioTranslations";
import { RemovedNotice } from "@/components/community/RemovedNotice";
import { updateStory } from "../actions";
import type { ChapterRow, Genre, StoryRow } from "@/lib/studio/types";

type Params = Promise<{ storyId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { storyId } = await params;
  const { supabase } = await requireUser(`/studio/${storyId}`);
  const { data } = await supabase.from("stories").select("title").eq("id", storyId).maybeSingle();
  return { title: data?.title ?? "Story" };
}

export default async function StoryStudioPage({ params }: { params: Params }) {
  const { storyId } = await params;
  const { supabase, user } = await requireUser(`/studio/${storyId}`);

  const [{ data: story }, { data: genres }, { data: chapters }, { data: storyGenres }, { data: storyTags }, { data: slot }] =
    await Promise.all([
      supabase.from("stories").select("*").eq("id", storyId).eq("author_id", user.id).maybeSingle(),
      supabase.from("genres").select("id, slug, name").order("name"),
      supabase
        .from("chapters")
        .select("id, story_id, number, title, word_count, status, publish_at, published_at, updated_at, choice_points(id)")
        .eq("story_id", storyId)
        .order("number"),
      supabase.from("story_genres").select("genres(slug)").eq("story_id", storyId),
      supabase.from("story_tags").select("tags(name)").eq("story_id", storyId),
      supabase
        .from("fresh_shelf_slots")
        .select("impressions_target, impressions_served, ends_at, outcome, extended")
        .eq("story_id", storyId)
        .maybeSingle(),
    ]);
  if (!story) notFound();
  const s = story as StoryRow;

  const genreSlugs = (storyGenres ?? []).flatMap((r) => {
    const g = r.genres as unknown as { slug: string } | null;
    return g ? [g.slug] : [];
  });
  const tagNames = (storyTags ?? []).flatMap((r) => {
    const t = r.tags as unknown as { name: string } | null;
    return t ? [t.name] : [];
  });
  const list = (chapters ?? []) as Omit<ChapterRow, "body">[];
  const published = list.filter((c) => c.status === "published").length;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-12">
      <BackLink href="/studio">Studio</BackLink>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 font-display text-[34px] leading-tight font-semibold sm:text-[40px]">{s.title}</h1>
        <StatusBadge status={s.status} />
      </div>
      {s.status !== "draft" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/story/${s.id}`} className={btn.small}>
            <Eye className="h-4 w-4" /> View as reader
          </Link>
          <Link href={`/studio/${s.id}/analytics`} className={btn.small}>
            <BarChart3 className="h-4 w-4" /> Analytics
          </Link>
        </div>
      )}
      <p className="mt-1 text-sm text-muted">
        {list.length} {list.length === 1 ? "chapter" : "chapters"} · {published} published ·{" "}
        {s.word_count.toLocaleString()} published {s.word_count === 1 ? "word" : "words"}
      </p>

      {(story as { removed_at?: string | null }).removed_at && (
        <div className="mt-4">
          <RemovedNotice reason={(story as { removed_reason?: string | null }).removed_reason ?? null} />
        </div>
      )}
      {s.status === "draft" && (
        <StoryActions storyId={s.id} mode="publish" publishedChapters={published} />
      )}

      {slot && (
        <p className="mt-6 rounded-lg border border-border bg-surface/60 px-4 py-3 text-sm">
          <span className="font-medium text-accent">Fresh Shelf: </span>
          {slot.outcome === "active" &&
            `shown to ${slot.impressions_served} of ${slot.impressions_target} new readers so far, until ${new Date(
              slot.ends_at,
            ).toLocaleDateString()}${slot.extended ? " (extended a week to reach more readers)" : ""}.`}
          {slot.outcome === "graduated" &&
            "graduated. Readers stayed with it, so it can now appear in Rising and Trending."}
          {slot.outcome === "ended" &&
            "week finished. The story stays in search and genre pages, and can still rise if readers find it there."}
        </p>
      )}

      <section className="mt-10">
        <ChapterList storyId={s.id} chapters={list} />
      </section>

      <StudioTranslations
        supabase={supabase}
        story={s}
        publishedChapterIds={list.filter((c) => c.status === "published").map((c) => c.id)}
      />

      <details className="group mt-12 rounded-lg border border-border bg-surface/50">
        <summary className="cursor-pointer list-none px-5 py-4 font-display text-2xl font-semibold">
          Story details <span className="text-sm text-muted group-open:hidden">(title, cover, genres, tags…)</span>
        </summary>
        <div className="border-t border-border p-5">
          <StoryForm
            action={updateStory.bind(null, s.id)}
            genres={(genres ?? []) as Genre[]}
            story={s}
            selectedGenres={genreSlugs}
            tags={tagNames}
            submitLabel="Save details"
          />
        </div>
      </details>

      <section className="mt-12 rounded-lg border border-danger/30 p-5">
        <h2 className="font-serif text-lg">Delete story</h2>
        <p className="mt-1 text-sm text-muted">Removes the story, every chapter and its reader data. This cannot be undone.</p>
        <StoryActions storyId={s.id} mode="delete" title={s.title} />
      </section>
    </div>
  );
}
