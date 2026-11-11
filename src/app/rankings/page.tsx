import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";

export const dynamic = "force-dynamic";

const LISTS = {
  trending: { label: "Trending", blurb: "Read deepest in the past week. Recent days count more." },
  rising: { label: "Rising", blurb: "Stories under 90 days old whose readers keep going." },
  finished: { label: "Most finished", blurb: "The most readers who finished at least one chapter, all time." },
} as const;
type List = keyof typeof LISTS;

interface Ranked {
  id: string;
  title: string;
  cover_url: string | null;
  synopsis: string;
  status: string;
  word_count: number;
  author_username: string;
  author_name: string | null;
  chapter_count: number;
  genres: string[];
  readers_7d: number;
  finishers_total: number;
  depth: number;
}

type SearchParams = Promise<{ list?: string; genre?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { list } = await searchParams;
  return { title: `${LISTS[(list as List) in LISTS ? (list as List) : "trending"].label} · Rankings` };
}

function href(list: List, genre: string | null) {
  const p = new URLSearchParams();
  if (list !== "trending") p.set("list", list);
  if (genre) p.set("genre", genre);
  const s = p.toString();
  return s ? `/rankings?${s}` : "/rankings";
}

const readers = (n: number) => {
  const r = Math.round(n);
  return `${r.toLocaleString()} ${r === 1 ? "reader" : "readers"}`;
};

export default async function RankingsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const list: List = sp.list && sp.list in LISTS ? (sp.list as List) : "trending";
  const genre = sp.genre && /^[a-z0-9-]{1,40}$/.test(sp.genre) ? sp.genre : null;

  const supabase = await createClient();
  const [{ data }, { data: genres }] = await Promise.all([
    supabase.rpc("ranked_stories", { p_list: list, p_genre: genre, p_limit: 50 }),
    supabase.rpc("genre_counts"),
  ]);
  const rows = (data ?? []) as Ranked[];
  const genreList = ((genres ?? []) as { slug: string; name: string; stories: number }[]).filter((g) => g.stories > 0);
  const genreName = new Map(genreList.map((g) => [g.slug, g.name]));

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-12 sm:pt-10">
      <h1 className="font-display text-[38px] leading-tight font-semibold">Rankings</h1>
      <p className="mt-1 text-sm text-muted">
        Ranked by how deeply people read: chapters finished, coming back and adding to a library count; opening a
        story alone does not.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Ranking">
        {(Object.keys(LISTS) as List[]).map((l) => (
          <Link
            key={l}
            href={href(l, genre)}
            aria-current={l === list ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              l === list ? "border-accent bg-accent/15" : "border-border text-muted hover:text-foreground"
            }`}
          >
            {LISTS[l].label}
          </Link>
        ))}
      </nav>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link href={href(list, null)} className={!genre ? "text-accent" : "text-muted hover:text-foreground"}>
          All genres
        </Link>
        {genreList.map((g) => (
          <Link
            key={g.slug}
            href={href(list, g.slug)}
            className={genre === g.slug ? "text-accent" : "text-muted hover:text-foreground"}
          >
            {g.name}
          </Link>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted">{LISTS[list].blurb}</p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-10 text-center text-muted">
          Nothing ranked here yet. Stories appear once readers have spent real time with them.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-border">
          {rows.map((s, i) => (
            <li key={s.id}>
              <Link href={`/story/${s.id}`} className="group flex gap-4 py-4">
                <span className="w-7 shrink-0 pt-1 text-right font-display text-2xl font-semibold text-muted tabular-nums">{i + 1}</span>
                <Cover url={s.cover_url} title={s.title} className="w-16 shrink-0 sm:w-20" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg leading-snug group-hover:text-accent">{s.title}</p>
                  <p className="truncate text-xs text-muted">
                    {s.author_name || `@${s.author_username}`}
                    {s.genres.length > 0 && ` · ${s.genres.map((g) => genreName.get(g) ?? g).join(", ")}`}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{s.synopsis}</p>
                  <p className="mt-1 text-xs text-muted">
                    {list === "finished"
                      ? `${readers(s.finishers_total)} finished a chapter`
                      : `${readers(s.readers_7d)} this week`}
                    {" · "}
                    {s.chapter_count} {s.chapter_count === 1 ? "chapter" : "chapters"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
