"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionResult, Genre, StoryRow } from "@/lib/studio/types";
import { MAX_GENRES, RATINGS, STORY_STATUSES } from "@/lib/studio/types";
import { Cover } from "@/components/Cover";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

const input =
  "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent";

export function StoryForm({
  action,
  genres,
  story,
  selectedGenres = [],
  tags = [],
  submitLabel,
}: {
  action: Action;
  genres: Genre[];
  story?: Pick<StoryRow, "title" | "synopsis" | "rating" | "status" | "cover_url">;
  selectedGenres?: string[];
  tags?: string[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [picked, setPicked] = useState<string[]>(selectedGenres);
  const [preview, setPreview] = useState<string | null>(null);
  // Status can change outside this form ("Publish story"), so it follows the server value;
  // a stale default here would quietly unpublish the story on the next save.
  const serverStatus = story?.status ?? "draft";
  const [status, setStatus] = useState(serverStatus);
  useEffect(() => setStatus(serverStatus), [serverStatus]);

  function toggleGenre(slug: string) {
    setPicked((p) => (p.includes(slug) ? p.filter((g) => g !== slug) : p.length < MAX_GENRES ? [...p, slug] : p));
  }

  return (
    <form action={formAction} className="grid gap-8 md:grid-cols-[180px_1fr]">
      <div>
        <Cover url={preview ?? story?.cover_url ?? null} title={story?.title ?? "Your cover"} className="w-full" />
        <label className="mt-3 block text-sm">
          <span className="text-muted">Cover (JPG, PNG or WebP, 2 MB max, 2:3)</span>
          <input
            type="file"
            name="cover"
            accept="image/jpeg,image/png,image/webp"
            className="mt-1 block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-foreground"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
        </label>
        {story?.cover_url && (
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" name="removeCover" /> Remove current cover
          </label>
        )}
      </div>

      <div className="space-y-5">
        <label className="block text-sm">
          Title
          <input name="title" required maxLength={200} defaultValue={story?.title} className={input} />
        </label>

        <label className="block text-sm">
          Synopsis
          <textarea
            name="synopsis"
            rows={6}
            maxLength={5000}
            defaultValue={story?.synopsis}
            className={`${input} font-serif leading-relaxed`}
            placeholder="What is the story about? This is what readers see first."
          />
        </label>

        <fieldset>
          <legend className="text-sm">
            Genres <span className="text-muted">(up to {MAX_GENRES})</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {genres.map((g) => {
              const on = picked.includes(g.slug);
              return (
                <label
                  key={g.slug}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
                    on ? "border-accent bg-accent/15 text-foreground" : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="genres"
                    value={g.slug}
                    checked={on}
                    onChange={() => toggleGenre(g.slug)}
                    className="sr-only"
                  />
                  {g.name}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="block text-sm">
          Tags <span className="text-muted">(comma separated, up to 15)</span>
          <input name="tags" defaultValue={tags.join(", ")} className={input} placeholder="slow burn, found family, magic school" />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm">
            Content rating
            <select name="rating" defaultValue={story?.rating ?? "everyone"} className={input}>
              {RATINGS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}: {r.hint}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Status
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className={input}
            >
              {STORY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent-strong px-5 text-sm font-medium text-white shadow-[0_8px_24px_-12px_rgba(143,107,255,0.8)] transition hover:bg-[#9c7dff] disabled:opacity-50"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
          {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
          {state?.ok && state.message && <p className="text-sm text-emerald-300">{state.message}</p>}
        </div>
      </div>
    </form>
  );
}
