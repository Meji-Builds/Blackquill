"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownUp, GitBranch } from "lucide-react";

interface Row {
  id: string;
  number: number;
  title: string;
  published_at: string | null;
  hasChoice: boolean;
}

const SHOWN = 15;

/** The public chapter list: oldest or newest first, long lists folded, the reader's current chapter marked. */
export function ChapterIndex({ storyId, chapters, currentId }: { storyId: string; chapters: Row[]; currentId?: string }) {
  const [newestFirst, setNewestFirst] = useState(false);
  const [all, setAll] = useState(false);
  const ordered = newestFirst ? [...chapters].reverse() : chapters;
  const visible = all ? ordered : ordered.slice(0, SHOWN);

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-[28px] leading-tight font-semibold">
          Chapters <span className="font-sans text-base font-normal text-muted">{chapters.length}</span>
        </h2>
        {chapters.length > 1 && (
          <button
            onClick={() => setNewestFirst((n) => !n)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <ArrowDownUp className="h-4 w-4" /> {newestFirst ? "Newest first" : "Oldest first"}
          </button>
        )}
      </div>
      {chapters.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border-strong p-6 text-muted">
          The author has not published a chapter yet.
        </p>
      ) : (
        <ol className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          {visible.map((c) => (
            <li key={c.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/story/${storyId}/chapter/${c.number}`}
                className={`flex items-center gap-4 px-4 py-3.5 transition hover:bg-surface-2 ${c.id === currentId ? "bg-accent/5" : ""}`}
              >
                <span className="w-7 shrink-0 text-right text-sm text-muted tabular-nums">{c.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{c.title || `Chapter ${c.number}`}</span>
                  {c.id === currentId && <span className="text-xs font-medium text-accent">Where you left off</span>}
                </span>
                {c.hasChoice && (
                  <span title="This chapter has a choice" className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    <GitBranch className="h-3.5 w-3.5" /> Choice
                  </span>
                )}
                <span className="hidden shrink-0 text-xs text-muted tabular-nums sm:inline">
                  {c.published_at && new Date(c.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {!all && chapters.length > SHOWN && (
        <button onClick={() => setAll(true)} className="mt-3 w-full rounded-xl border border-border py-3 text-sm font-medium text-muted hover:bg-surface hover:text-foreground">
          Show all {chapters.length} chapters
        </button>
      )}
    </section>
  );
}
