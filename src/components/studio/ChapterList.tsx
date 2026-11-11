"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createChapter, deleteChapter, reorderChapters } from "@/app/studio/actions";
import { StatusBadge } from "./StatusBadge";
import type { ChapterRow } from "@/lib/studio/types";

type Item = Omit<ChapterRow, "body"> & { choice_points?: { id: string } | null };

function when(c: Item) {
  if (c.status === "scheduled" && c.publish_at) return `Publishes ${new Date(c.publish_at).toLocaleString()}`;
  if (c.status === "published" && c.published_at) return `Published ${new Date(c.published_at).toLocaleDateString()}`;
  return `Edited ${new Date(c.updated_at).toLocaleDateString()}`;
}

export function ChapterList({ storyId, chapters }: { storyId: string; chapters: Item[] }) {
  const [items, setItems] = useState(chapters);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setItems(chapters), [chapters]);

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    const before = items;
    setItems(next.map((c, i) => ({ ...c, number: i + 1 })));
    setError(null);
    start(async () => {
      const r = await reorderChapters(storyId, next.map((c) => c.id));
      if (!r.ok) {
        setItems(before);
        setError(r.error);
      }
    });
  }

  function remove(c: Item) {
    const label = c.title || `Chapter ${c.number}`;
    if (!window.confirm(`Delete "${label}"? Later chapters move up one number. This cannot be undone.`)) return;
    setError(null);
    start(async () => {
      const r = await deleteChapter(c.id);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Chapters</h2>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createChapter(storyId);
              if (r && !r.ok) setError(r.error);
            })
          }
          className="rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-60"
        >
          New chapter
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {items.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-sm text-muted">
          No chapters yet. Start with chapter 1.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
          {items.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 shrink-0 text-right font-mono text-sm text-muted">{c.number}</span>
              <Link href={`/studio/${storyId}/chapters/${c.id}`} className="min-w-0 flex-1 hover:text-accent">
                <span className="block truncate">{c.title || <em className="text-muted">Untitled</em>}</span>
                <span className="text-xs text-muted">
                  {c.word_count.toLocaleString()} words · {when(c)}
                </span>
              </Link>
              {c.choice_points && (
                <span className="hidden rounded-full border border-accent/40 px-2 py-0.5 text-xs text-accent sm:inline">
                  Choice
                </span>
              )}
              <StatusBadge status={c.status} />
              <div className="flex shrink-0 gap-1">
                <button
                  aria-label={`Move chapter ${c.number} up`}
                  disabled={pending || i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded px-2 py-1 text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  aria-label={`Move chapter ${c.number} down`}
                  disabled={pending || i === items.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded px-2 py-1 text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  aria-label={`Delete chapter ${c.number}`}
                  disabled={pending}
                  onClick={() => remove(c)}
                  className="rounded px-2 py-1 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
