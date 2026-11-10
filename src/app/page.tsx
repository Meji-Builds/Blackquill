import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { StoryCard, StoryRow } from "@/components/browse/StoryCard";
import type { StoryHit } from "@/lib/browse/params";

export const dynamic = "force-dynamic";

const ROW = 12;

interface Joined {
  id: string;
  title: string;
  cover_url: string | null;
  status: string;
  rating: string;
  word_count: number;
  last_chapter_at: string | null;
  profiles: { username: string; display_name: string | null } | null;
}

function Hero() {
  return (
    <section className="max-w-2xl">
      <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Stories found by how deeply they are read.</h1>
      <p className="mt-4 text-lg text-muted">
        Publish serialized fiction for free. Every new story gets a Fresh Shelf slot and a real audience in its first
        week.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/browse" className="rounded-md bg-accent-strong px-4 py-2 font-medium text-white hover:bg-accent">
          Start reading
        </Link>
        <Link href="/studio" className="rounded-md border border-border px-4 py-2 hover:bg-surface-2">
          Start writing
        </Link>
      </div>
    </section>
  );
}

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Hero />
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const storyCols =
    "id, title, cover_url, status, rating, word_count, last_chapter_at, profiles!stories_author_id_fkey(username, display_name)";

  const [continueRes, freshRes, updatedRes, genreRes] = await Promise.all([
    user
      ? supabase
          .from("reading_progress")
          .select(`updated_at, chapters(number), stories!inner(${storyCols})`)
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(ROW)
      : Promise.resolve({ data: [] }),
    supabase
      .from("fresh_shelf_slots")
      .select(`starts_at, stories!inner(${storyCols})`)
      .eq("graduated", false)
      .gt("ends_at", new Date().toISOString())
      .neq("stories.rating", "mature")
      .not("stories.last_chapter_at", "is", null)
      .order("starts_at", { ascending: false })
      .limit(ROW),
    supabase.rpc("search_stories", { p_sort: "updated", p_limit: ROW }),
    supabase.rpc("genre_counts"),
  ]);

  const genres = ((genreRes.data ?? []) as { slug: string; name: string; stories: number }[]).filter((g) => g.stories > 0);
  const topGenres = genres.slice(0, 4);
  const genreRows = await Promise.all(
    topGenres.map((g) => supabase.rpc("search_stories", { p_genres: [g.slug], p_sort: "updated", p_limit: ROW })),
  );

  const continueItems = ((continueRes.data ?? []) as unknown as {
    chapters: { number: number } | null;
    stories: Joined;
  }[]).filter((r) => r.stories.status !== "draft");
  const fresh = ((freshRes.data ?? []) as unknown as { stories: Joined }[]).map((r) => r.stories);
  const updated = (updatedRes.data ?? []) as StoryHit[];

  const card = (s: Joined, extra?: { subtitle?: string; href?: string }) => (
    <StoryCard
      story={{ ...s, author_name: s.profiles?.display_name, author_username: s.profiles?.username }}
      {...extra}
    />
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 [&>section:first-child]:mt-0">
      {!user && <Hero />}

      {user && (
        <StoryRow title="Continue Reading" href="/library">
          {continueItems.map((r) =>
            card(r.stories, {
              subtitle: r.chapters ? `Chapter ${r.chapters.number}` : undefined,
              href: r.chapters ? `/story/${r.stories.id}/chapter/${r.chapters.number}` : undefined,
            }),
          )}
        </StoryRow>
      )}

      <StoryRow
        title="Fresh Shelf"
        note="New stories in their first week. Be one of their first readers."
        empty="No new stories this week yet. Yours could be the first."
      >
        {fresh.map((s) => card(s))}
      </StoryRow>

      <StoryRow title="Recently Updated" href="/browse?sort=updated">
        {updated.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
      </StoryRow>

      {topGenres.map((g, i) => (
        <StoryRow key={g.slug} title={g.name} href={`/genre/${g.slug}`}>
          {((genreRows[i].data ?? []) as StoryHit[]).map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </StoryRow>
      ))}

      {genres.length > 0 && (
        <section className="mt-14">
          <h2 className="font-serif text-2xl">Browse by genre</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {genres.map((g) => (
              <Link
                key={g.slug}
                href={`/genre/${g.slug}`}
                className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent hover:text-accent"
              >
                {g.name} <span className="text-muted">{g.stories}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
