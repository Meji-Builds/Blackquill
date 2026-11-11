import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { StoryCard, StoryRow } from "@/components/browse/StoryCard";
import type { StoryHit } from "@/lib/browse/params";
import { ImpressionTracker } from "@/components/browse/ImpressionTracker";
import { ANON_COOKIE } from "@/lib/discovery/viewer";
import { Cover } from "@/components/Cover";
import { btn } from "@/components/ui/styles";
import { Compass, Feather } from "lucide-react";

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

function Hero({ spotlight }: { spotlight?: StoryHit }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-surface">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(143,107,255,0.28),transparent_45%),radial-gradient(circle_at_10%_110%,rgba(217,178,111,0.12),transparent_40%)]"
      />
      <div className="relative grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
        <div className="max-w-xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Serialized fiction, read deeply</p>
          <h1 className="mt-3 font-display text-[40px] leading-[1.05] font-semibold sm:text-[56px]">
            Stories found by how deeply they are read.
          </h1>
          <p className="mt-4 text-base text-muted sm:text-lg">
            Web novels and light novels, free to read and free to publish. Every new story gets a Fresh Shelf week
            with real readers, and rankings reward chapters finished, not clicks.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/browse" className={btn.primary}>
              <Compass className="h-4 w-4" /> Start reading
            </Link>
            <Link href="/studio" className={btn.secondary}>
              <Feather className="h-4 w-4" /> Start writing
            </Link>
          </div>
        </div>
        {spotlight && (
          <Link href={`/story/${spotlight.id}`} className="group hidden w-48 md:block" aria-label={`Spotlight: ${spotlight.title}`}>
            <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-muted uppercase">Spotlight</p>
            <Cover
              url={spotlight.cover_url}
              title={spotlight.title}
              author={spotlight.author_name || spotlight.author_username}
              className="w-full transition duration-300 group-hover:-translate-y-1"
            />
            <p className="mt-3 font-serif font-semibold group-hover:text-accent">{spotlight.title}</p>
          </Link>
        )}
      </div>
    </section>
  );
}

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
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

  const mature = user
    ? Boolean((await supabase.from("profiles").select("show_mature").eq("id", user.id).maybeSingle()).data?.show_mature)
    : false;
  const [continueRes, freshRes, updatedRes, genreRes, trendingRes, risingRes] = await Promise.all([
    user
      ? supabase
          .from("reading_progress")
          .select(`updated_at, scroll_position, chapters(number), stories!inner(${storyCols}, chapters(count))`)
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(ROW)
      : Promise.resolve({ data: [] }),
    supabase.rpc("fresh_shelf_stories", {
      p_anon: user ? null : ((await cookies()).get(ANON_COOKIE)?.value ?? null),
      p_limit: ROW,
      p_include_mature: mature,
    }),
    supabase.rpc("search_stories", { p_sort: "updated", p_limit: ROW, p_include_mature: mature }),
    supabase.rpc("genre_counts"),
    supabase.rpc("ranked_stories", { p_list: "trending", p_limit: ROW, p_include_mature: mature }),
    supabase.rpc("ranked_stories", { p_list: "rising", p_limit: ROW, p_include_mature: mature }),
  ]);

  const genres = ((genreRes.data ?? []) as { slug: string; name: string; stories: number }[]).filter((g) => g.stories > 0);
  const topGenres = genres.slice(0, 4);
  const genreRows = await Promise.all(
    topGenres.map((g) => supabase.rpc("search_stories", { p_genres: [g.slug], p_sort: "updated", p_limit: ROW, p_include_mature: mature })),
  );

  const continueItems = ((continueRes.data ?? []) as unknown as {
    chapters: { number: number } | null;
    scroll_position: number;
    stories: Joined & { chapters: { count: number }[] };
  }[]).filter((r) => r.stories.status !== "draft");
  const fresh = (freshRes.data ?? []) as StoryHit[];
  const trending = (trendingRes.data ?? []) as StoryHit[];
  const rising = (risingRes.data ?? []) as StoryHit[];
  const updated = (updatedRes.data ?? []) as StoryHit[];

  const card = (s: Joined, extra?: { subtitle?: string; href?: string; progress?: number }) => (
    <StoryCard
      story={{ ...s, author_name: s.profiles?.display_name, author_username: s.profiles?.username }}
      {...extra}
    />
  );

  const viewerName = user
    ? (await supabase.from("profiles").select("display_name, username").eq("id", user.id).single()).data
    : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pt-6 pb-12 sm:pt-8">
      {user ? (
        <header>
          <p className="text-sm text-muted">Welcome back</p>
          <h1 className="font-display text-[34px] leading-tight font-semibold">
            {viewerName?.display_name || viewerName?.username}
          </h1>
        </header>
      ) : (
        <Hero spotlight={trending[0] ?? updated[0]} />
      )}

      {user && (
        <StoryRow title="Continue Reading" href="/library">
          {continueItems.map((r) => {
            const total = r.stories.chapters[0]?.count ?? 0;
            const n = r.chapters?.number ?? 0;
            return card(r.stories, {
              subtitle: n ? `Chapter ${n}${total ? ` of ${total}` : ""}` : undefined,
              href: n ? `/story/${r.stories.id}/chapter/${n}` : undefined,
              progress: total ? Math.min(1, (n - 1 + (r.scroll_position ?? 0)) / total) : undefined,
            });
          })}
        </StoryRow>
      )}

      <ImpressionTracker storyIds={fresh.map((s) => s.id)}>
        <StoryRow
          title="Fresh Shelf"
          note="New this week. Be one of their first readers."
          empty="No new stories this week yet. Yours could be the first."
        >
          {fresh.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </StoryRow>
      </ImpressionTracker>

      <StoryRow title="Trending" href="/rankings" note="Read deepest this week.">
        {trending.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
      </StoryRow>

      <StoryRow title="Rising" href="/rankings?list=rising" note="Newer stories whose readers keep going.">
        {rising.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
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
        <section>
          <h2 className="font-display text-[28px] leading-tight font-semibold">Browse by genre</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {genres.map((g) => (
              <Link
                key={g.slug}
                href={`/genre/${g.slug}`}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm transition hover:border-accent/60 hover:bg-surface-2"
              >
                <span className="font-medium">{g.name}</span>
                <span className="text-xs text-muted tabular-nums">{g.stories}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
