"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveProgress } from "@/app/reader/actions";
import { readingMinutes } from "@/lib/reader/text";
import {
  DEFAULT_SETTINGS,
  LINE_HEIGHTS,
  SIZES,
  THEMES,
  WIDTHS,
  loadSettings,
  storeSettings,
  type ReaderSettings,
} from "./settings";

const SAVE_EVERY_MS = 3000;

function scrollRatio() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
}

export function ChapterReader(props: {
  storyId: string;
  storyTitle: string;
  chapterId: string;
  number: number;
  title: string;
  paragraphs: string[];
  wordCount: number;
  prevNumber: number | null;
  nextNumber: number | null;
  signedIn: boolean;
  initialScroll: number;
}) {
  const { storyId, chapterId, signedIn } = props;
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [panel, setPanel] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastSaved = useRef<number | null>(null);
  // Last measured position; saving reads this instead of measuring, so a save during navigation
  // records where the reader actually was, not the next page's layout.
  const ratio = useRef(props.initialScroll);
  const restored = useRef(false);

  useEffect(() => setSettings(loadSettings()), []);

  function update(patch: Partial<ReaderSettings>) {
    setSettings((s) => {
      const next = { ...s, ...patch };
      storeSettings(next);
      return next;
    });
  }

  const persist = useCallback(() => {
    if (!signedIn) return;
    const r = Math.round(ratio.current * 1000) / 1000;
    if (lastSaved.current !== null && Math.abs(r - lastSaved.current) < 0.01) return;
    lastSaved.current = r;
    void saveProgress(storyId, chapterId, r);
  }, [signedIn, storyId, chapterId]);

  // Restore the saved position once layout (and the reader's font settings) have settled.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const target = props.initialScroll;
    requestAnimationFrame(() => {
      if (target > 0.01 && target < 0.99) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: target * max });
      }
      ratio.current = target;
      lastSaved.current = target > 0 ? target : null;
      // Opening a chapter records it as the current one even before scrolling.
      if (target === 0) persist();
    });
  }, [props.initialScroll, persist]);

  useEffect(() => {
    const onScroll = () => {
      ratio.current = scrollRatio();
      setProgress(ratio.current);
    };
    const timer = setInterval(persist, SAVE_EVERY_MS);
    const onHide = () => document.visibilityState === "hidden" && persist();
    setProgress(scrollRatio());
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      persist();
    };
  }, [persist]);

  // Arrow keys move between chapters when no field has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft" && props.prevNumber) window.location.href = `/story/${storyId}/chapter/${props.prevNumber}`;
      if (e.key === "ArrowRight" && props.nextNumber) window.location.href = `/story/${storyId}/chapter/${props.nextNumber}`;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.prevNumber, props.nextNumber, storyId]);

  const t = THEMES[settings.theme];
  const pill = (on: boolean) =>
    `rounded-md border px-3 py-1.5 text-sm ${on ? "border-[var(--accent-strong)] font-medium" : ""}`;

  const nav = (
    <nav className="flex items-center justify-between gap-3 text-sm">
      {props.prevNumber ? (
        <Link href={`/story/${storyId}/chapter/${props.prevNumber}`} className="rounded-md border px-4 py-2" style={{ borderColor: t.border }}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <Link href={`/story/${storyId}`} style={{ color: t.muted }} className="hover:underline">
        Contents
      </Link>
      {props.nextNumber ? (
        <Link href={`/story/${storyId}/chapter/${props.nextNumber}`} className="rounded-md border px-4 py-2" style={{ borderColor: t.border }}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );

  return (
    <div style={{ background: t.bg, color: t.fg }} className="min-h-[calc(100vh-3.5rem)]">
      <div className="sticky top-14 z-10 h-0.5" style={{ background: t.border }}>
        <div className="h-full bg-[var(--accent-strong)]" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="mx-auto px-5 pt-8 pb-20" style={{ maxWidth: WIDTHS[settings.width] }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href={`/story/${storyId}`} className="text-sm hover:underline" style={{ color: t.muted }}>
              {props.storyTitle}
            </Link>
            <h1 className="mt-1 font-serif text-3xl">
              <span className="block text-base" style={{ color: t.muted }}>
                Chapter {props.number}
              </span>
              {props.title}
            </h1>
            <p className="mt-1 text-xs" style={{ color: t.muted }}>
              {props.wordCount.toLocaleString()} words · about {readingMinutes(props.wordCount)} min
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setPanel((p) => !p)}
              aria-expanded={panel}
              className="rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: t.border }}
            >
              Aa
            </button>
            {panel && (
              <div
                className="absolute right-0 z-20 mt-2 w-72 space-y-4 rounded-lg border p-4 shadow-xl"
                style={{ background: t.bg, borderColor: t.border, color: t.fg }}
                role="dialog"
                aria-label="Reading settings"
              >
                <fieldset>
                  <legend className="mb-2 text-xs uppercase tracking-wider" style={{ color: t.muted }}>Theme</legend>
                  <div className="flex gap-2">
                    {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => update({ theme: k })}
                        className={pill(settings.theme === k)}
                        style={{ background: THEMES[k].bg, color: THEMES[k].fg, borderColor: settings.theme === k ? undefined : THEMES[k].border }}
                        aria-pressed={settings.theme === k}
                      >
                        {THEMES[k].label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-xs uppercase tracking-wider" style={{ color: t.muted }}>Font</legend>
                  <div className="flex gap-2">
                    <button onClick={() => update({ font: "serif" })} className={`${pill(settings.font === "serif")} font-serif`} style={{ borderColor: settings.font === "serif" ? undefined : t.border }} aria-pressed={settings.font === "serif"}>Serif</button>
                    <button onClick={() => update({ font: "sans" })} className={`${pill(settings.font === "sans")} font-sans`} style={{ borderColor: settings.font === "sans" ? undefined : t.border }} aria-pressed={settings.font === "sans"}>Sans</button>
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-xs uppercase tracking-wider" style={{ color: t.muted }}>Size</legend>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label="Smaller text"
                      disabled={settings.size === SIZES[0]}
                      onClick={() => update({ size: SIZES[Math.max(0, SIZES.indexOf(settings.size) - 1)] })}
                      className="rounded-md border px-3 py-1 disabled:opacity-40"
                      style={{ borderColor: t.border }}
                    >
                      A−
                    </button>
                    <span className="w-12 text-center text-sm">{settings.size}px</span>
                    <button
                      aria-label="Larger text"
                      disabled={settings.size === SIZES[SIZES.length - 1]}
                      onClick={() => update({ size: SIZES[Math.min(SIZES.length - 1, SIZES.indexOf(settings.size) + 1)] })}
                      className="rounded-md border px-3 py-1 disabled:opacity-40"
                      style={{ borderColor: t.border }}
                    >
                      A+
                    </button>
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-xs uppercase tracking-wider" style={{ color: t.muted }}>Spacing</legend>
                  <div className="flex gap-2">
                    {LINE_HEIGHTS.map((lh, i) => (
                      <button key={lh} onClick={() => update({ lineHeight: lh })} className={pill(settings.lineHeight === lh)} style={{ borderColor: settings.lineHeight === lh ? undefined : t.border }} aria-pressed={settings.lineHeight === lh}>
                        {["Tight", "Normal", "Loose"][i]}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-xs uppercase tracking-wider" style={{ color: t.muted }}>Width</legend>
                  <div className="flex gap-2">
                    {(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map((w) => (
                      <button key={w} onClick={() => update({ width: w })} className={`${pill(settings.width === w)} capitalize`} style={{ borderColor: settings.width === w ? undefined : t.border }} aria-pressed={settings.width === w}>
                        {w}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          </div>
        </div>

        <article
          className={`mt-10 space-y-[1em] ${settings.font === "serif" ? "font-serif" : "font-sans"}`}
          style={{ fontSize: settings.size, lineHeight: settings.lineHeight }}
        >
          {props.paragraphs.map((p, i) => (
            <p key={i} data-p={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </article>

        <div className="mt-14 border-t pt-6" style={{ borderColor: t.border }}>
          {!props.nextNumber && (
            <p className="mb-6 text-center text-sm" style={{ color: t.muted }}>
              You are caught up. New chapters will appear here.
            </p>
          )}
          {nav}
          {!signedIn && (
            <p className="mt-6 text-center text-sm" style={{ color: t.muted }}>
              <Link href={`/login?next=/story/${storyId}/chapter/${props.number}`} className="underline">
                Sign in
              </Link>{" "}
              to save your place across devices.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
