import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StoryCard } from "./StoryCard";
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
  ];

  return (
    <div>
      <form action={path} method="get" className="space-y-3 rounded-lg border border-border bg-surface/50 p-4">
        {/* Hidden inputs carry the genre and tag selections the form itself does not show. */}
        {filters.tags.map((t) => (
          <input key={t} type="hidden" name="tag" value={t} />
        ))}
        {locked?.genre && <input type="hidden" name="genre" value={locked.genre} />}
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Search titles, synopses, authors and tags"
            aria-label="Search"
            className={`${field} min-w-0 flex-1`}
          />
          <button className="rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-white hover:bg-accent">Search</button>
        </div>
        {!locked?.genre && (
          <details open={filters.genres.length > 0}>
            <summary className="cursor-pointer text-sm text-muted">Genres</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {(genres ?? []).map((g) => (
                <label key={g.slug} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/15">
                  <input type="checkbox" name="genre" value={g.slug} defaultChecked={filters.genres.includes(g.slug)} className="sr-only" />
                  {g.name}
                </label>
              ))}
            </div>
          </details>
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
          <select name="sort" defaultValue={filters.sort} aria-label="Sort" className={field}>
            {Object.entries(SORTS).map(([v, l]) => (
              <option key={v} value={v}>Sort: {l}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-2 text-sm text-muted">
            <input type="checkbox" name="mature" value="1" defaultChecked={filters.mature} /> Include mature
          </label>
          <button className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">Apply</button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>
          {error ? "Search failed. Try again." : `${total.toLocaleString()} ${total === 1 ? "story" : "stories"}`}
        </span>
        {active.map((a) => (
          <Link key={a.href + a.label} href={a.href} className="rounded-full border border-border px-3 py-0.5 hover:border-danger hover:text-danger">
            {a.label} ✕
          </Link>
        ))}
      </div>

      {hits.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted">
          No stories match. Try fewer filters or a different search.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
            <Link href={filtersHref(path, filters, { page: filters.page - 1 })} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">← Previous</Link>
          ) : <span />}
          <span className="text-muted">Page {filters.page} of {pages}</span>
          {filters.page < pages ? (
            <Link href={filtersHref(path, filters, { page: filters.page + 1 })} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">Next →</Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
