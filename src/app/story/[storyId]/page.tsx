import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { StatusBadge } from "@/components/studio/StatusBadge";
import { ShelfButton, type ShelfOption } from "@/components/reader/ShelfButton";
import { OfflineButton } from "@/components/reader/OfflineButton";
import { readingMinutes } from "@/lib/reader/text";

type Params = Promise<{ storyId: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadStory(storyId: string) {
  if (!UUID.test(storyId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("stories")
    .select(
      "id, title, synopsis, cover_url, status, rating, word_count, last_chapter_at, author_id, profiles!stories_author_id_fkey(username, display_name), story_genres(genres(slug, name)), story_tags(tags(slug, name))",
    )
    .eq("id", storyId)
    .neq("status", "draft")
    .maybeSingle();
  return data ? { supabase, story: data } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { storyId } = await params;
  const loaded = await loadStory(storyId);
  if (!loaded) return { title: "Story not found" };
  return { title: loaded.story.title, description: loaded.story.synopsis.slice(0, 160) };
}

export default async function StoryPage({ params }: { params: Params }) {
  const { storyId } = await params;
  const loaded = await loadStory(storyId);
  if (!loaded) notFound();
  const { supabase, story } = loaded;

  const author = story.profiles as unknown as { username: string; display_name: string | null } | null;
  const genres = (story.story_genres as unknown as { genres: { slug: string; name: string } | null }[]).flatMap((g) =>
    g.genres ? [g.genres] : [],
  );
  const tags = (story.story_tags as unknown as { tags: { slug: string; name: string } | null }[]).flatMap((t) =>
    t.tags ? [t.tags] : [],
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: chapters }, progressRes, shelvesRes] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, number, title, word_count, published_at, choice_points(id)")
      .eq("story_id", story.id)
      .eq("status", "published")
      .order("number"),
    user
      ? supabase
          .from("reading_progress")
          .select("chapter_id")
          .eq("user_id", user.id)
          .eq("story_id", story.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("shelves")
          .select("id, name, kind, position, shelf_items(story_id)")
          .eq("user_id", user.id)
          .eq("shelf_items.story_id", story.id)
          .order("position")
      : Promise.resolve({ data: null }),
  ]);
  const list = chapters ?? [];
  const resume = progressRes.data ? list.find((c) => c.id === progressRes.data!.chapter_id) : undefined;
  const first = list[0];
  const shelves: ShelfOption[] | null = shelvesRes.data
    ? (shelvesRes.data as { id: string; name: string; kind: string; shelf_items: unknown[] }[]).map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        on: s.shelf_items.length > 0,
      }))
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 sm:grid-cols-[200px_1fr]">
        <Cover url={story.cover_url} title={story.title} className="w-40 sm:w-full" />
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl">{story.title}</h1>
          {author && (
            <p className="mt-2 text-muted">
              by <span className="text-foreground">{author.display_name || author.username}</span>{" "}
              <span className="text-sm">@{author.username}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusBadge status={story.status} />
            {story.rating !== "everyone" && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">{story.rating}</span>
            )}
            <span>
              {list.length} {list.length === 1 ? "chapter" : "chapters"} · {story.word_count.toLocaleString()} words · about{" "}
              {readingMinutes(story.word_count)} min
            </span>
            {story.last_chapter_at && <span>· Updated {new Date(story.last_chapter_at).toLocaleDateString()}</span>}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {resume ? (
              <Link
                href={`/story/${story.id}/chapter/${resume.number}`}
                className="rounded-md bg-accent-strong px-5 py-2 font-medium text-white hover:bg-accent"
              >
                Continue: Chapter {resume.number}
              </Link>
            ) : first ? (
              <Link
                href={`/story/${story.id}/chapter/${first.number}`}
                className="rounded-md bg-accent-strong px-5 py-2 font-medium text-white hover:bg-accent"
              >
                Start reading
              </Link>
            ) : (
              <span className="rounded-md border border-border px-5 py-2 text-muted">No chapters yet</span>
            )}
            {shelves ? (
              <ShelfButton storyId={story.id} shelves={shelves} />
            ) : (
              <Link
                href={`/login?next=/story/${story.id}`}
                className="rounded-md border border-border px-4 py-2 hover:bg-surface-2"
              >
                Sign in to add to library
              </Link>
            )}
            <OfflineButton
              storyId={story.id}
              title={story.title}
              coverUrl={story.cover_url}
              chapters={list.map((c) => c.number)}
            />
          </div>

          {(genres.length > 0 || tags.length > 0) && (
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              {genres.map((g) => (
                <Link key={g.slug} href={`/genre/${g.slug}`} className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 hover:bg-accent/20">
                  {g.name}
                </Link>
              ))}
              {tags.map((t) => (
                <Link key={t.slug} href={`/tag/${t.slug}`} className="rounded-full border border-border px-3 py-1 text-muted hover:text-foreground">
                  #{t.name}
                </Link>
              ))}
            </div>
          )}

          {story.synopsis && (
            <div className="mt-6 space-y-3 font-serif text-lg leading-relaxed text-foreground/90">
              {(story.synopsis as string).split(/\n\s*\n/).map((p: string, i: number) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-serif text-2xl">Chapters</h2>
        {list.length === 0 ? (
          <p className="mt-4 text-muted">The author has not published a chapter yet.</p>
        ) : (
          <ol className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
            {list.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/story/${story.id}/chapter/${c.number}`}
                  className="flex items-baseline gap-4 px-4 py-3 hover:bg-surface-2"
                >
                  <span className="w-8 shrink-0 text-right font-mono text-sm text-muted">{c.number}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {c.title || `Chapter ${c.number}`}
                    {(c.choice_points as unknown as { id: string } | null) && (
                      <span className="ml-2 rounded-full border border-accent/40 px-2 py-0.5 text-xs text-accent">
                        Choice
                      </span>
                    )}
                    {resume?.id === c.id && <span className="ml-2 text-xs text-accent">You are here</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {c.published_at && new Date(c.published_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
