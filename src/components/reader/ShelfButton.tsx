"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setStoryShelves } from "@/app/reader/actions";
import { BookmarkCheck, BookmarkPlus, Check, ChevronDown } from "lucide-react";
import { btn } from "@/components/ui/styles";

export interface ShelfOption {
  id: string;
  name: string;
  kind: string;
  on: boolean;
}

const DEFAULTS = ["reading", "plan_to_read", "completed"];

export function ShelfButton({ storyId, shelves }: { storyId: string; shelves: ShelfOption[] }) {
  const [items, setItems] = useState(shelves);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setItems(shelves), [shelves]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function toggle(id: string) {
    const target = items.find((s) => s.id === id)!;
    const isDefault = DEFAULTS.includes(target.kind);
    const next = items.map((s) => {
      if (s.id === id) return { ...s, on: !s.on };
      // Picking one of Reading / Plan to Read / Completed clears the other two.
      if (isDefault && !target.on && DEFAULTS.includes(s.kind)) return { ...s, on: false };
      return s;
    });
    const before = items;
    setItems(next);
    setError(null);
    start(async () => {
      const r = await setStoryShelves(storyId, next.filter((s) => s.on).map((s) => s.id));
      if (!r.ok) {
        setItems(before);
        setError(r.error);
      }
    });
  }

  const current = items.filter((s) => s.on);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${btn.secondary} w-full ${current.length ? "border-accent/50 text-accent" : ""}`}
      >
        {current.length ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
        <span className="max-w-[9rem] truncate">{current.length ? current.map((s) => s.name).join(", ") : "Library"}</span>
        <ChevronDown className={`h-4 w-4 opacity-60 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-20 mt-2 w-64 rounded-2xl border border-border bg-surface-2 p-1.5 shadow-2xl shadow-black/60">
          {items.map((s, i) => {
            const isDefault = DEFAULTS.includes(s.kind);
            return (
              <div key={s.id}>
                {i > 0 && DEFAULTS.includes(items[i - 1].kind) && !isDefault && <div className="my-1.5 h-px bg-border" />}
                <button
                  role="menuitemcheckbox"
                  aria-checked={s.on}
                  disabled={pending}
                  onClick={() => toggle(s.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-3"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border ${isDefault ? "rounded-full" : "rounded-md"} ${
                      s.on ? "border-accent bg-accent text-background" : "border-border-strong"
                    }`}
                  >
                    {s.on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  {s.name}
                </button>
              </div>
            );
          })}
          {error && <p className="px-3 py-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
