export type StoryStatus = "draft" | "ongoing" | "completed" | "hiatus";
export type ContentRating = "everyone" | "teen" | "mature";
export type ChapterStatus = "draft" | "scheduled" | "published";

export const STORY_STATUSES: { value: StoryStatus; label: string }[] = [
  { value: "draft", label: "Draft (hidden)" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "hiatus", label: "On hiatus" },
];

export const RATINGS: { value: ContentRating; label: string; hint: string }[] = [
  { value: "everyone", label: "Everyone", hint: "Suitable for all readers" },
  { value: "teen", label: "Teen", hint: "Mild violence, language or themes" },
  { value: "mature", label: "Mature", hint: "Hidden from readers by default" },
];

export interface Genre {
  id: number;
  slug: string;
  name: string;
}

export interface StoryRow {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  synopsis: string;
  status: StoryStatus;
  rating: ContentRating;
  published_at: string | null;
  updated_at: string;
  last_chapter_at: string | null;
  word_count: number;
}

export interface ChapterRow {
  id: string;
  story_id: string;
  number: number;
  title: string;
  body: string;
  word_count: number;
  status: ChapterStatus;
  publish_at: string | null;
  published_at: string | null;
  updated_at: string;
}

export type ActionResult = { ok: true; message?: string; updatedAt?: string } | { ok: false; error: string };

export const MAX_GENRES = 3;
export const MAX_TAGS = 15;
export const MAX_COVER_BYTES = 2 * 1024 * 1024;
