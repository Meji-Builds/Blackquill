"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setStoryShelves } from "@/app/reader/actions";

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
  const label = current.length === 0 ? "Add to library" : current.map((s) => s.name).join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`max-w-xs truncate rounded-md border px-4 py-2 ${
          current.length ? "border-accent/50 text-accent" : "border-border"
        } hover:bg-surface-2`}
      >
        {current.length ? "✓ " : "+ "}
        {label}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-60 rounded-md border border-border bg-surface p-1 shadow-xl">
          {items.map((s, i) => (
            <div key={s.id}>
              {i > 0 && DEFAULTS.includes(items[i - 1].kind) && !DEFAULTS.includes(s.kind) && (
                <div className="my-1 h-px bg-border" />
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm hover:bg-surface-2">
                <input
                  type={DEFAULTS.includes(s.kind) ? "radio" : "checkbox"}
                  name={DEFAULTS.includes(s.kind) ? `status-${storyId}` : undefined}
                  checked={s.on}
                  disabled={pending}
                  onClick={() => DEFAULTS.includes(s.kind) && s.on && toggle(s.id)}
                  onChange={() => !(DEFAULTS.includes(s.kind) && s.on) && toggle(s.id)}
                  className="accent-[var(--accent-strong)]"
                />
                {s.name}
              </label>
            </div>
          ))}
          {error && <p className="px-3 py-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
