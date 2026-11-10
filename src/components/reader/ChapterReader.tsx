"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveProgress } from "@/app/reader/actions";
import { readingMinutes } from "@/lib/reader/text";
import { ReaderSettingsPanel } from "./ReaderSettingsPanel";
import {
  FONTS,
  WIDTHS,
  palette,
  parseSettings,
  readStoredSettings,
  storeSettings,
  textureImage,
  type ReaderSettings,
} from "./settings";
import "@fontsource/literata/400.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/lora/400.css";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/opendyslexic/400.css";

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
  initialSettings: ReaderSettings;
  hasSettingsCookie: boolean;
}) {
  const { storyId, chapterId, signedIn } = props;
  const [settings, setSettings] = useState<ReaderSettings>(props.initialSettings);
  const [panel, setPanel] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastSaved = useRef<number | null>(null);
  // Last measured position; saving reads this instead of measuring, so a save during navigation
  // records where the reader actually was, not the next page's layout.
  const ratio = useRef(props.initialScroll);
  const restored = useRef(false);

  // Readers who saved settings before they were kept in a cookie: pick them up once.
  useEffect(() => {
    if (props.hasSettingsCookie) return;
    const stored = readStoredSettings();
    if (stored) {
      const s = parseSettings(stored);
      setSettings(s);
      storeSettings(s);
    }
  }, [props.hasSettingsCookie]);

  function update(next: ReaderSettings) {
    setSettings(next);
    storeSettings(next);
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

  const t = palette(settings);
  const texture = textureImage(settings.texture, t.dark);

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
    <div
      style={{ backgroundColor: t.bg, backgroundImage: texture, color: t.fg }}
      className="min-h-[calc(100vh-3.5rem)]"
    >
      {settings.brightness < 100 && (
        // Dims the whole screen like a brightness control; clicks pass through.
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-40 bg-black"
          style={{ opacity: (100 - settings.brightness) / 100 }}
        />
      )}
      <div className="sticky top-14 z-10 h-0.5" style={{ background: t.border }}>
        <div className="h-full bg-[var(--accent-strong)]" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="mx-auto px-5 pt-8 pb-20" style={{ maxWidth: WIDTHS[settings.width] }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href={`/story/${storyId}`} className="text-sm hover:underline" style={{ color: t.muted }}>
              {props.storyTitle}
            </Link>
            <h1 className="mt-1 text-3xl" style={{ fontFamily: FONTS[settings.font].stack }}>
              <span className="block text-base" style={{ color: t.muted }}>
                Chapter {props.number}
              </span>
              {props.title}
            </h1>
            <p className="mt-1 text-xs" style={{ color: t.muted }}>
              {props.wordCount.toLocaleString()} words · about {readingMinutes(props.wordCount)} min
            </p>
          </div>
          <button
            onClick={() => setPanel((p) => !p)}
            aria-expanded={panel}
            aria-label="Reading settings"
            className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: t.border }}
          >
            Aa
          </button>
        </div>
        {panel && <ReaderSettingsPanel settings={settings} onChange={update} onClose={() => setPanel(false)} />}

        <article
          className="mt-10 space-y-[1em]"
          style={{ fontFamily: FONTS[settings.font].stack, fontSize: settings.size, lineHeight: settings.lineHeight }}
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
