import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { StoryForm } from "@/components/studio/StoryForm";
import { ChapterList } from "@/components/studio/ChapterList";
import { StoryActions } from "@/components/studio/StoryActions";
import { StatusBadge } from "@/components/studio/StatusBadge";
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

  const [{ data: story }, { data: genres }, { data: chapters }, { data: storyGenres }, { data: storyTags }] =
    await Promise.all([
      supabase.from("stories").select("*").eq("id", storyId).eq("author_id", user.id).maybeSingle(),
      supabase.from("genres").select("id, slug, name").order("name"),
      supabase
        .from("chapters")
        .select("id, story_id, number, title, word_count, status, publish_at, published_at, updated_at")
        .eq("story_id", storyId)
        .order("number"),
      supabase.from("story_genres").select("genres(slug)").eq("story_id", storyId),
      supabase.from("story_tags").select("tags(name)").eq("story_id", storyId),
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/studio" className="text-sm text-muted hover:text-foreground">
        ← Studio
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl">{s.title}</h1>
        <StatusBadge status={s.status} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {list.length} chapters · {published} published · {s.word_count.toLocaleString()} published words
      </p>

      {s.status === "draft" && (
        <StoryActions storyId={s.id} mode="publish" publishedChapters={published} />
      )}

      <section className="mt-10">
        <ChapterList storyId={s.id} chapters={list} />
      </section>

      <details className="group mt-12 rounded-lg border border-border bg-surface/50">
        <summary className="cursor-pointer list-none px-5 py-4 font-serif text-xl">
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
