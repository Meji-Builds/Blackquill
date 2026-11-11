"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionResult, Genre, StoryRow } from "@/lib/studio/types";
import { MAX_GENRES, RATINGS, STORY_STATUSES } from "@/lib/studio/types";
import { Cover } from "@/components/Cover";
import { LANGUAGES, languageLabel } from "@/lib/translation/languages";

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
  penName,
}: {
  action: Action;
  genres: Genre[];
  story?: Pick<
    StoryRow,
    "title" | "synopsis" | "rating" | "status" | "cover_url" | "language" | "allow_machine_translation" | "allow_community_translation"
  >;
  selectedGenres?: string[];
  tags?: string[];
  submitLabel: string;
  /** On a writer's first story: offer a pen name (the username is the default). */
  penName?: { username: string };
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
      {penName && (
        <div className="rounded-xl border border-accent/30 md:col-span-2 bg-accent/[0.06] p-4">
          <label className="block text-sm">
            Your pen name <span className="text-muted">(optional)</span>
            <input name="penName" maxLength={60} placeholder={penName.username} className={`${input} mt-1`} />
          </label>
          <p className="mt-1.5 text-xs text-muted">
            Your first story! Choose the name readers will see on your stories, or leave it empty to write as @{penName.username}.
            You can change it later in settings.
          </p>
        </div>
      )}
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

        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-medium">Language and translations</legend>
          <label className="block text-sm">
            Written in
            <select name="language" defaultValue={story?.language ?? "en"} className={`${input} mt-1`}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {languageLabel(l.code)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" name="allowMachine" defaultChecked={story?.allow_machine_translation ?? true} className="mt-0.5 h-4 w-4 accent-[#8f6bff]" />
            <span>
              Let readers machine-translate it
              <span className="block text-xs text-muted">Readers anywhere can read it in their own language, translated automatically and clearly labelled.</span>
            </span>
          </label>
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input type="checkbox" name="allowCommunity" defaultChecked={story?.allow_community_translation ?? true} className="mt-0.5 h-4 w-4 accent-[#8f6bff]" />
            <span>
              Accept volunteer translators
              <span className="block text-xs text-muted">Translators can ask to translate it, and you approve each one. Their translations are shown before machine ones.</span>
            </span>
          </label>
        </fieldset>

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
