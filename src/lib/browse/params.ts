// Turns browse URL parameters into search_stories() arguments, and back into links.
import { isLanguage } from "../translation/languages.ts";

export const PAGE_SIZE = 24;

export const LENGTHS = {
  short: { label: "Under 20k words", min: null, max: 20_000 },
  medium: { label: "20k to 100k", min: 20_000, max: 100_000 },
  long: { label: "100k to 500k", min: 100_000, max: 500_000 },
  epic: { label: "500k and up", min: 500_000, max: null },
} as const;

export const UPDATED = {
  "7": "Past week",
  "30": "Past month",
  "90": "Past 3 months",
  "365": "Past year",
} as const;

export const SORTS = {
  relevance: "Best match",
  updated: "Recently updated",
  newest: "Newest",
  words: "Longest",
  title: "Title A to Z",
} as const;

export const STATUSES = { ongoing: "Ongoing", completed: "Completed", hiatus: "On hiatus" } as const;

export type Sort = keyof typeof SORTS;

export interface BrowseFilters {
  q: string;
  genres: string[];
  tags: string[];
  status: keyof typeof STATUSES | null;
  length: keyof typeof LENGTHS | null;
  updated: keyof typeof UPDATED | null;
  sort: Sort;
  mature: boolean;
  /** Written in, or translated by volunteers into, this language. */
  lang: string | null;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? [v] : [])
    .flatMap((x) => x.split(","))
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[a-z0-9-]{1,40}$/.test(x));

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(raw: RawParams): BrowseFilters {
  const q = one(raw.q).trim().slice(0, 100);
  const status = one(raw.status);
  const length = one(raw.length);
  const updated = one(raw.updated);
  const sort = one(raw.sort);
  const page = Number.parseInt(one(raw.page), 10);
  return {
    q,
    genres: [...new Set(list(raw.genre))].slice(0, 10),
    tags: [...new Set(list(raw.tag))].slice(0, 10),
    status: status in STATUSES ? (status as BrowseFilters["status"]) : null,
    length: length in LENGTHS ? (length as BrowseFilters["length"]) : null,
    updated: updated in UPDATED ? (updated as BrowseFilters["updated"]) : null,
    sort: sort in SORTS ? (sort as Sort) : q ? "relevance" : "updated",
    mature: one(raw.mature) === "1",
    lang: isLanguage(one(raw.lang)) ? one(raw.lang) : null,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

export function toRpcArgs(f: BrowseFilters) {
  const len = f.length ? LENGTHS[f.length] : null;
  return {
    p_query: f.q || null,
    p_genres: f.genres.length ? f.genres : null,
    p_tags: f.tags.length ? f.tags : null,
    p_status: f.status,
    p_min_words: len?.min ?? null,
    p_max_words: len?.max ?? null,
    p_updated_within_days: f.updated ? Number(f.updated) : null,
    p_include_mature: f.mature,
    p_sort: f.sort,
    p_language: f.lang,
    p_limit: PAGE_SIZE,
    p_offset: (f.page - 1) * PAGE_SIZE,
  };
}

/** Builds a URL for the same filters with some changed. Omits defaults to keep links short. */
export function filtersHref(path: string, f: BrowseFilters, patch: Partial<BrowseFilters> = {}) {
  const n = { ...f, page: 1, ...patch };
  const p = new URLSearchParams();
  if (n.q) p.set("q", n.q);
  n.genres.forEach((g) => p.append("genre", g));
  n.tags.forEach((t) => p.append("tag", t));
  if (n.status) p.set("status", n.status);
  if (n.length) p.set("length", n.length);
  if (n.updated) p.set("updated", n.updated);
  if (n.sort !== (n.q ? "relevance" : "updated")) p.set("sort", n.sort);
  if (n.mature) p.set("mature", "1");
  if (n.lang) p.set("lang", n.lang);
  if (n.page > 1) p.set("page", String(n.page));
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

export interface StoryHit {
  id: string;
  title: string;
  cover_url: string | null;
  synopsis: string;
  status: string;
  rating: string;
  word_count: number;
  last_chapter_at: string | null;
  published_at: string | null;
  author_username: string;
  author_name: string | null;
  chapter_count: number;
  genres: string[];
  rank: number;
  total_count: number;
}

/**
 * A GET form submits every field, including empty ones ("?q=&length="). Returns the clean URL when the
 * request carried empty or default values, so callers can redirect to it.
 */
export function canonicalHref(path: string, raw: RawParams, f: BrowseFilters, locked: Partial<BrowseFilters> = {}) {
  const hasNoise = Object.values(raw).some((v) => (Array.isArray(v) ? v.some((x) => x === "") : v === ""));
  if (!hasNoise) return null;
  const clean = { ...f };
  // A genre or tag page's own filter lives in its path, not the query string.
  if (locked.genres) clean.genres = f.genres.filter((g) => !locked.genres!.includes(g));
  if (locked.tags) clean.tags = f.tags.filter((t) => !locked.tags!.includes(t));
  return filtersHref(path, clean, { page: f.page });
}
