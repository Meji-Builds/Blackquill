"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, GitBranch, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { btn } from "@/components/ui/styles";
import { createChapter, deleteChapter, reorderChapters } from "@/app/studio/actions";
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
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-[28px] leading-tight font-semibold">
          Chapters <span className="font-sans text-base font-normal text-muted">{items.length}</span>
        </h2>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createChapter(storyId);
              if (r && !r.ok) setError(r.error);
            })
          }
          className={btn.primary}
        >
          <Plus className="h-4 w-4" /> New chapter
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border-strong p-8 text-center text-muted">
          No chapters yet. Start with chapter 1.
        </p>
      ) : (
        <ol className="mt-4 rounded-2xl border border-border bg-surface">
          {items.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 border-b border-border py-2 pr-2 pl-4 last:border-b-0">
              <span className="w-6 shrink-0 text-right text-sm text-muted tabular-nums">{c.number}</span>
              <Link href={`/studio/${storyId}/chapters/${c.id}`} className="min-w-0 flex-1 py-1.5 hover:text-accent">
                <span className="block truncate text-[15px] font-medium">
                  {c.title || <em className="font-normal text-muted">Untitled</em>}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <StatusDot status={c.status} />
                  <span>{c.word_count.toLocaleString()} words</span>
                  <span className="hidden sm:inline">· {when(c)}</span>
                  {c.choice_points && (
                    <span className="inline-flex items-center gap-1 text-accent">
                      · <GitBranch className="h-3 w-3" /> Choice
                    </span>
                  )}
                </span>
              </Link>
              <RowMenu
                disabled={pending}
                canUp={i > 0}
                canDown={i < items.length - 1}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                onDelete={() => remove(c)}
                label={c.title || `Chapter ${c.number}`}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone = status === "published" ? "bg-success" : status === "scheduled" ? "bg-warning" : "bg-muted";
  const text = status === "published" ? "Published" : status === "scheduled" ? "Scheduled" : "Draft";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} /> {text}
    </span>
  );
}

/** One "more" button per row instead of three tiny ones; the actions get full-size, labelled targets. */
function RowMenu({
  label,
  disabled,
  canUp,
  canDown,
  onUp,
  onDown,
  onDelete,
}: {
  label: string;
  disabled: boolean;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDownEv = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDownEv);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDownEv);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const item =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-3 disabled:pointer-events-none disabled:opacity-40";
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={btn.icon}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-border bg-surface-2 p-1.5 shadow-2xl shadow-black/60">
          <button role="menuitem" disabled={!canUp} onClick={run(onUp)} className={item}>
            <ArrowUp className="h-4 w-4 text-muted" /> Move up
          </button>
          <button role="menuitem" disabled={!canDown} onClick={run(onDown)} className={item}>
            <ArrowDown className="h-4 w-4 text-muted" /> Move down
          </button>
          <div className="my-1 h-px bg-border" />
          <button role="menuitem" onClick={run(onDelete)} className={`${item} text-danger hover:bg-danger/10`}>
            <Trash2 className="h-4 w-4" /> Delete chapter
          </button>
        </div>
      )}
    </div>
  );
}
