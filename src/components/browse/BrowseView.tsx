import Link from "next/link";
import { LANGUAGES, languageLabel } from "@/lib/translation/languages";
import { createClient } from "@/lib/supabase/server";
import { StoryCard } from "./StoryCard";
import { btn } from "@/components/ui/styles";
import { ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import {
  LENGTHS,
  PAGE_SIZE,
  SORTS,
  STATUSES,
  UPDATED,
  filtersHref,
  toRpcArgs,
  type BrowseFilters,
  type StoryHit,
} from "@/lib/browse/params";

const field = "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

/**
 * Search results with filters. Used by /browse and by genre and tag pages, which pass `locked`
 * so their own genre or tag cannot be removed from the filter.
 */
export async function BrowseView({
  path,
  filters,
  locked,
}: {
  path: string;
  filters: BrowseFilters;
  locked?: { genre?: string; tag?: string };
}) {
  const supabase = await createClient();
  const [{ data, error }, { data: genres }] = await Promise.all([
    supabase.rpc("search_stories", toRpcArgs(filters)),
    supabase.from("genres").select("slug, name").order("name"),
  ]);
  const hits = (data ?? []) as StoryHit[];
  const total = hits[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const genreName = new Map((genres ?? []).map((g) => [g.slug, g.name]));

  const active: { label: string; href: string }[] = [
    ...filters.genres
      .filter((g) => g !== locked?.genre)
      .map((g) => ({ label: genreName.get(g) ?? g, href: filtersHref(path, filters, { genres: filters.genres.filter((x) => x !== g) }) })),
    ...filters.tags
      .filter((t) => t !== locked?.tag)
      .map((t) => ({ label: `#${t}`, href: filtersHref(path, filters, { tags: filters.tags.filter((x) => x !== t) }) })),
    ...(filters.lang ? [{ label: `In ${languageLabel(filters.lang)}`, href: filtersHref(path, filters, { lang: null }) }] : []),
  ];

  return (
    <div>
      <form action={path} method="get" className="space-y-2 rounded-2xl border border-border bg-surface p-3 sm:p-4">
        {/* Hidden inputs carry the genre and tag selections the form itself does not show. */}
        {filters.tags.map((t) => (
          <input key={t} type="hidden" name="tag" value={t} />
        ))}
        {locked?.genre && <input type="hidden" name="genre" value={locked.genre} />}
        <div className="relative flex gap-2">
          <Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3 h-5 w-5 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Search stories, authors, tags"
            aria-label="Search"
            className={`${field} min-w-0 flex-1 pl-10`}
          />
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent-strong px-5 text-sm font-medium text-white shadow-[0_8px_24px_-12px_rgba(143,107,255,0.8)] transition hover:bg-[#9c7dff] disabled:opacity-50"><span className="sr-only sm:not-sr-only">Search</span><Search className="h-4 w-4 sm:hidden" /></button>
        </div>
        <details className="group" open={(filters.genres.filter((g) => g !== locked?.genre).length + (filters.status ? 1 : 0) + (filters.length ? 1 : 0) + (filters.updated ? 1 : 0) + (filters.mature ? 1 : 0) + (filters.lang ? 1 : 0)) > 0}>
          <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-sm font-medium text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="h-4 w-4" /> Filters and sort
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-4">
        {!locked?.genre && (
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Genres</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(genres ?? []).map((g) => (
                <label key={g.slug} className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ring-border-strong transition has-[:checked]:bg-accent/15 has-[:checked]:text-accent has-[:checked]:ring-accent/50">
                  <input type="checkbox" name="genre" value={g.slug} defaultChecked={filters.genres.includes(g.slug)} className="sr-only" />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <select name="status" defaultValue={filters.status ?? ""} aria-label="Status" className={field}>
            <option value="">Any status</option>
            {Object.entries(STATUSES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select name="length" defaultValue={filters.length ?? ""} aria-label="Length" className={field}>
            <option value="">Any length</option>
            {Object.entries(LENGTHS).map(([v, l]) => (
              <option key={v} value={v}>{l.label}</option>
            ))}
          </select>
          <select name="updated" defaultValue={filters.updated ?? ""} aria-label="Last updated" className={field}>
            <option value="">Updated any time</option>
            {Object.entries(UPDATED).map(([v, l]) => (
              <option key={v} value={v}>Updated: {l}</option>
            ))}
          </select>
          <select name="lang" defaultValue={filters.lang ?? ""} aria-label="Language" className={field}>
            <option value="">Any language</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>In {languageLabel(l.code)}</option>
            ))}
          </select>
          <select name="sort" defaultValue={filters.sort} aria-label="Sort" className={field}>
            {Object.entries(SORTS).map(([v, l]) => (
              <option key={v} value={v}>Sort: {l}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-2 text-sm text-muted">
            <input type="checkbox" name="mature" value="1" defaultChecked={filters.mature} /> Include mature
          </label>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-4 text-sm font-medium text-foreground transition hover:bg-surface-3 disabled:opacity-50">Apply</button>
        </div>
          </div>
        </details>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>
          {error ? "Search failed. Try again." : `${total.toLocaleString()} ${total === 1 ? "story" : "stories"}`}
        </span>
        {active.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            aria-label={`Remove filter ${a.label}`}
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-2 pl-3 text-foreground ring-1 ring-border-strong hover:ring-danger/60"
          >
            {a.label} <X className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>

      {hits.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted">
          No stories match. Try fewer filters or a different search.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-5 md:grid-cols-5 lg:grid-cols-6">
          {hits.map((s) => (
            <li key={s.id}>
              <StoryCard story={s} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-4 text-sm" aria-label="Pages">
          {filters.page > 1 ? (
            <Link href={filtersHref(path, filters, { page: filters.page - 1 })} className={btn.small}><ChevronLeft className="h-4 w-4" /> Previous</Link>
          ) : <span />}
          <span className="text-muted">Page {filters.page} of {pages}</span>
          {filters.page < pages ? (
            <Link href={filtersHref(path, filters, { page: filters.page + 1 })} className={btn.small}>Next <ChevronRight className="h-4 w-4" /></Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
