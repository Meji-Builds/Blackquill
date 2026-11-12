"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveProgress } from "@/app/reader/actions";
import { logReadingEvent } from "@/app/discovery/actions";
import { minFinishSeconds } from "@/lib/discovery/viewer";
import { readingMinutes } from "@/lib/reader/text";
import { ReaderSettingsPanel } from "./ReaderSettingsPanel";
import { ChoiceBlock } from "./ChoiceBlock";
import { AlignLeft, ChevronLeft, ChevronRight, Images, Languages, List, Loader2, MessageCircle, Type, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { LanguagePanel } from "./LanguagePanel";
import { machineTranslate, setReadingLanguage } from "@/app/translation/actions";
import { language, languageLabel } from "@/lib/translation/languages";
import type { ReaderLanguages, ShownTranslation } from "@/lib/translation/resolve";
import { ChapterComments, ParagraphSheet, useComments } from "@/components/community/Comments";
import { FollowButton } from "@/components/community/FollowButton";
import { LikeButton } from "@/components/community/LikeButton";
import { ShareButton } from "@/components/community/ShareButton";
import { paragraphCounts } from "@/lib/community/types";
import type { ChoicePoint, ChoiceState } from "@/lib/choices/types";
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

/** How far down the chapter the reader is: 1 once the end of the chapter text is on screen (comments below don't count). */
function scrollMax(end: HTMLElement | null) {
  const docMax = document.documentElement.scrollHeight - window.innerHeight;
  if (!end) return docMax;
  const endAt = end.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
  return Math.max(0, Math.min(docMax, endAt));
}

function scrollRatio(end: HTMLElement | null) {
  const max = scrollMax(end);
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
  choice: ChoicePoint | null;
  choiceState: ChoiceState | null;
  panels: { id: string; caption: string; image_url: string }[];
  following: boolean;
  likes: { count: number; liked: boolean; own: boolean };
  languages: ReaderLanguages;
  shown: ShownTranslation | null;
}) {
  const { storyId, chapterId, signedIn } = props;
  const [settings, setSettings] = useState<ReaderSettings>(props.initialSettings);
  const [panel, setPanel] = useState(false);
  const [langPanel, setLangPanel] = useState(false);
  const router = useRouter();
  // The words on screen: the original or a translation. A machine translation not made yet is fetched after load.
  const [text, setText] = useState({ title: props.title, paragraphs: props.paragraphs });
  const [shown, setShown] = useState<ShownTranslation | null>(props.shown);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const pendingLang = shown?.kind === "pending" ? shown.language : null;
  const translate = useCallback(() => {
    if (!pendingLang) return;
    setTranslateError(null);
    machineTranslate(chapterId, pendingLang)
      .then((r) => {
        if (r.ok && r.text) {
          setText(r.text);
          setShown({ kind: "machine", language: pendingLang });
        } else setTranslateError(r.ok ? "The translation didn't work." : r.error);
      })
      .catch(() => setTranslateError("You seem to be offline. Showing the original."));
  }, [chapterId, pendingLang]);
  useEffect(() => {
    translate();
  }, [translate]);

  async function pickLanguage(lang: string | null) {
    setLangPanel(false);
    setSwitching(true);
    await setReadingLanguage(storyId, lang).catch(() => {});
    // Drop any ?lang= from a shared link so the new choice applies.
    router.replace(`/story/${storyId}/chapter/${props.number}`);
    router.refresh();
  }
  const [progress, setProgress] = useState(0);
  const lastSaved = useRef<number | null>(null);
  // Last measured position; saving reads this instead of measuring, so a save during navigation
  // records where the reader actually was, not the next page's layout.
  const ratio = useRef(props.initialScroll);
  const articleRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"text" | "comic">("text");
  const comicRef = useRef<HTMLOListElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  // With a choice point, the text after it stays hidden until the reader picks or skips.
  const [choiceResolved, setChoiceResolved] = useState(!props.choice || Boolean(props.choiceState?.picked));
  const gated = useRef(!choiceResolved);
  gated.current = !choiceResolved;
  const restored = useRef(false);
  useEffect(() => {
    setText({ title: props.title, paragraphs: props.paragraphs });
    setShown(props.shown);
    setSwitching(false);
  }, [props.title, props.paragraphs, props.shown]);
  const comments = useComments(chapterId);
  const counts = paragraphCounts(comments.comments);
  // The paragraph the reader tapped (shows its comment button) and the one whose discussion is open.
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState<number | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const loginHref = `/login?next=/story/${storyId}/chapter/${props.number}`;

  // The device's saved settings win over the ones the page was rendered with. They differ for readers who saved
  // settings before they were kept in a cookie, and for pages saved offline before the reader changed settings.
  useEffect(() => {
    const stored = readStoredSettings();
    if (!stored) return;
    const s = parseSettings(stored);
    if (JSON.stringify(s) === JSON.stringify(props.initialSettings)) return;
    setSettings(s);
    if (!props.hasSettingsCookie) storeSettings(s);
  }, [props.hasSettingsCookie, props.initialSettings]);

  function update(next: ReaderSettings) {
    setSettings(next);
    storeSettings(next);
  }

  const persist = useCallback(() => {
    if (!signedIn) return;
    const r = Math.round(ratio.current * 1000) / 1000;
    if (lastSaved.current !== null && Math.abs(r - lastSaved.current) < 0.01) return;
    lastSaved.current = r;
    saveProgress(storyId, chapterId, r).catch(() => {
      lastSaved.current = null; // offline: try again on the next save
    });
  }, [signedIn, storyId, chapterId]);

  // Restore the saved position once layout (and the reader's font settings) have settled.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const target = props.initialScroll;
    requestAnimationFrame(() => {
      if (target > 0.01 && target < 0.99) {
        const max = scrollMax(endRef.current);
        window.scrollTo({ top: target * max });
      }
      // Measure rather than assume: the reader may already have scrolled while the page was starting up.
      ratio.current = target > 0.01 && target < 0.99 ? target : scrollRatio(endRef.current);
      lastSaved.current = target > 0 ? target : null;
      // Opening a chapter records it as the current one even before scrolling.
      if (target === 0) persist();
    });
  }, [props.initialScroll, persist]);

  useEffect(() => {
    const onScroll = () => {
      ratio.current = scrollRatio(endRef.current);
      setProgress(ratio.current);
    };
    const timer = setInterval(persist, SAVE_EVERY_MS);
    const onHide = () => document.visibilityState === "hidden" && persist();
    setProgress(scrollRatio(endRef.current));
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      persist();
    };
  }, [persist]);

  // Discovery: record the open, then a finish once the reader reaches the end after a believable time.
  // The server re-checks both; "too fast" just means try again a little later.
  useEffect(() => {
    const openedAt = Date.now();
    const needMs = minFinishSeconds(props.wordCount) * 1000;
    let finished = false;
    let inFlight = false;
    logReadingEvent(storyId, chapterId, "open").catch(() => {});
    const tryFinish = () => {
      // "Reached the end" means the last lines of the chapter text are on screen.
      // In comic view the end of the chapter is the last panel, not the (hidden) text.
      const endEl = viewRef.current === "comic" ? comicRef.current : articleRef.current;
      const end = endEl?.getBoundingClientRect().bottom ?? Infinity;
      if (gated.current) return; // the end of the visible text is not the end of the chapter yet
      if (finished || inFlight || end > window.innerHeight + 40 || Date.now() - openedAt < needMs) return;
      inFlight = true;
      logReadingEvent(storyId, chapterId, "finish")
        .then((r) => {
          if (r === "finish" || r === "duplicate" || r === "author" || r === "chapter not public") finished = true;
        })
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    };
    const timer = setInterval(tryFinish, 5000);
    window.addEventListener("scroll", tryFinish, { passive: true });
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", tryFinish);
    };
  }, [storyId, chapterId, props.wordCount]);

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
  // Where the choice sits: after its paragraph, or after the last one if the chapter got shorter.
  const choiceAt = props.choice
    ? Math.min(props.choice.anchor, text.paragraphs.length - 1)
    : text.paragraphs.length - 1;
  const texture = textureImage(settings.texture, t.dark);

  // Tapping a paragraph (without selecting text) offers to comment on it; paragraphs with comments show a count.
  const paragraph = (text: string, i: number) => {
    const n = counts.get(i) ?? 0;
    const active = selected === i;
    return (
      <div key={i} className="group relative">
        <p
          data-p={i}
          onClick={() => {
            if (window.getSelection()?.toString()) return;
            setSelected(active ? null : i);
          }}
          className="-mx-2 cursor-text rounded-md px-2 whitespace-pre-line transition-colors"
          style={active ? { background: t.dark ? "rgba(182,156,255,0.12)" : "rgba(143,107,255,0.10)" } : undefined}
        >
          {text}
          {n > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSheet(i);
              }}
              aria-label={`${n} ${n === 1 ? "comment" : "comments"} on this paragraph`}
              className="relative -top-[0.1em] ml-1.5 inline-flex h-[1.5em] min-w-[1.9em] items-center justify-center gap-0.5 rounded-full px-1.5 align-middle font-sans text-[0.62em] font-semibold"
              style={{ background: t.dark ? "rgba(182,156,255,0.16)" : "rgba(143,107,255,0.14)", color: t.dark ? "#cbb8ff" : "#5b3fd6" }}
            >
              <MessageCircle className="h-[1.1em] w-[1.1em]" /> {n}
            </button>
          )}
        </p>
        {active && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSheet(i);
                setSelected(null);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--accent-strong)] px-4 font-sans text-sm font-medium text-white shadow-lg"
            >
              <MessageCircle className="h-4 w-4" /> {n > 0 ? `View ${n} ${n === 1 ? "comment" : "comments"}` : "Comment"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const nav = (
    <nav className="flex items-center justify-between gap-3 text-sm">
      {props.prevNumber ? (
        <Link href={`/story/${storyId}/chapter/${props.prevNumber}`} className="inline-flex h-11 items-center gap-1 rounded-lg border px-4 font-medium" style={{ borderColor: t.border }}>
          <ChevronLeft className="h-4 w-4" /> Previous
        </Link>
      ) : (
        <span />
      )}
      <Link href={`/story/${storyId}`} style={{ color: t.muted }} className="inline-flex items-center gap-1.5 hover:underline">
        <List className="h-4 w-4" /> Contents
      </Link>
      {props.nextNumber ? (
        <Link href={`/story/${storyId}/chapter/${props.nextNumber}`} className="inline-flex h-11 items-center gap-1 rounded-lg bg-[var(--accent-strong)] px-5 font-medium text-white">
          Next <ChevronRight className="h-4 w-4" />
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
              {text.title}
            </h1>
            <p className="mt-1 text-xs" style={{ color: t.muted }}>
              {props.wordCount.toLocaleString()} words · about {readingMinutes(props.wordCount)} min
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setLangPanel((p) => !p)}
              aria-expanded={langPanel}
              aria-label={`Reading language: ${languageLabel(props.languages.chosen ?? props.languages.original)}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium uppercase"
              style={{ borderColor: t.border }}
            >
              {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
              {(props.languages.chosen ?? props.languages.original).split("-")[0]}
            </button>
            <button
              onClick={() => setPanel((p) => !p)}
              aria-expanded={panel}
              aria-label="Reading settings"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium"
              style={{ borderColor: t.border }}
            >
              <Type className="h-4 w-4" /> Aa
            </button>
          </div>
        </div>
        {shown && (
          <TranslationNote
            shown={shown}
            original={props.languages.original}
            error={translateError}
            onRetry={translate}
            onOriginal={() => pickLanguage(null)}
            muted={t.muted}
            border={t.border}
          />
        )}
        {langPanel && (
          <LanguagePanel languages={props.languages} storyId={storyId} onPick={pickLanguage} onClose={() => setLangPanel(false)} />
        )}
        {panel && <ReaderSettingsPanel settings={settings} onChange={update} onClose={() => setPanel(false)} />}

        {props.panels.length > 0 && (
          <div role="tablist" aria-label="Reading mode" className="mt-6 inline-grid grid-cols-2 rounded-xl p-1 ring-1" style={{ boxShadow: `inset 0 0 0 1px ${t.border}` }}>
            {(["text", "comic"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition"
                style={view === v ? { background: "var(--accent-strong)", color: "#fff" } : { color: t.muted }}
              >
                {v === "text" ? <AlignLeft className="h-4 w-4" /> : <Images className="h-4 w-4" />}
                {v === "text" ? "Text" : `Comic · ${props.panels.length}`}
              </button>
            ))}
          </div>
        )}

        {view === "comic" && (
          <ol ref={comicRef} className="mt-8 space-y-8">
            {props.panels.map((p, i) => (
              <li key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- approved panels come from storage */}
                <img src={p.image_url} alt={p.caption || `Panel ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} className="w-full rounded-xl" />
                {p.caption && (
                  <p className="mt-3 text-center font-serif text-[15px] italic" style={{ color: t.muted }}>
                    {p.caption}
                  </p>
                )}
              </li>
            ))}
            <li className="text-center">
              <button onClick={() => setView("text")} className="text-sm underline" style={{ color: t.muted }}>
                Read the full chapter text
              </button>
            </li>
          </ol>
        )}

        <article
          hidden={view === "comic"}
          ref={articleRef}
          lang={shown && shown.kind !== "pending" && shown.kind !== "missing" ? shown.language : props.languages.original}
          dir={language(shown && shown.kind !== "pending" && shown.kind !== "missing" ? shown.language : props.languages.original)?.rtl ? "rtl" : "ltr"}
          className="mt-10 space-y-[1em]"
          style={
            {
              fontFamily: FONTS[settings.font].stack,
              fontSize: settings.size,
              lineHeight: settings.lineHeight,
              "--reader-size": `${settings.size}px`,
              "--reader-lh": settings.lineHeight,
            } as React.CSSProperties
          }
        >
          {text.paragraphs.slice(0, choiceAt + 1).map((p, i) => paragraph(p, i))}
          {props.choice && (
            <ChoiceBlock
              choice={props.choice}
              initial={props.choiceState}
              palette={t}
              font={FONTS[settings.font].stack}
              onResolved={() => setChoiceResolved(true)}
            />
          )}
          {choiceResolved &&
            text.paragraphs.slice(choiceAt + 1).map((p, i) => paragraph(p, choiceAt + 1 + i))}
        </article>

        <div ref={endRef} aria-hidden="true" />
        <div className="mt-14 border-t pt-6" style={{ borderColor: t.border }}>
          {!props.nextNumber && (
            <div className="mb-8 rounded-2xl border px-5 py-5 text-center" style={{ borderColor: t.border }}>
              <p className="font-medium">You&apos;re all caught up.</p>
              <p className="mt-1 text-sm" style={{ color: t.muted }}>
                Follow the story to hear when the next chapter is out.
              </p>
              <FollowButton storyId={storyId} initial={props.following} signedIn={signedIn} loginHref={loginHref} className="mt-4" />
            </div>
          )}
          {nav}
          <div className="mt-6 flex flex-wrap justify-center gap-2" style={{ color: t.muted }}>
            <LikeButton
              target={{ chapterId }}
              initialCount={props.likes.count}
              initialLiked={props.likes.liked}
              own={props.likes.own}
              signedIn={signedIn}
              loginHref={loginHref}
              size="lg"
              label="Like this chapter"
            />
            <ShareButton
              path={`/story/${storyId}/chapter/${props.number}`}
              title={`${props.storyTitle} · Chapter ${props.number}`}
              text={props.title}
              className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium"
              style={{ borderColor: t.border, color: t.muted }}
            />
          </div>
          {!signedIn && (
            <p className="mt-6 text-center text-sm" style={{ color: t.muted }}>
              <Link href={`/login?next=/story/${storyId}/chapter/${props.number}`} className="underline">
                Sign in
              </Link>{" "}
              to save your place across devices.
            </p>
          )}
        </div>

        <ChapterComments
          api={comments}
          chapterId={chapterId}
          signedIn={signedIn}
          loginHref={loginHref}
          t={t}
          onOpenParagraph={setSheet}
        />
        {sheet !== null && (
          <ParagraphSheet
            api={comments}
            chapterId={chapterId}
            signedIn={signedIn}
            loginHref={loginHref}
            t={t}
            index={sheet}
            excerpt={text.paragraphs[sheet] ?? ""}
            onClose={closeSheet}
          />
        )}
      </div>
    </div>
  );
}

/** What the reader is looking at when it isn't the original: who translated it, or why it's the original. */
function TranslationNote({
  shown,
  original,
  error,
  onRetry,
  onOriginal,
  muted,
  border,
}: {
  shown: ShownTranslation;
  original: string;
  error: string | null;
  onRetry: () => void;
  onOriginal: () => void;
  muted: string;
  border: string;
}) {
  const target = language(shown.language)?.native ?? shown.language;
  const from = language(original)?.name ?? original;
  const link = "font-medium underline underline-offset-2";
  let body: React.ReactNode;
  if (shown.kind === "community") {
    body = (
      <>
        <Users className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Translated from {from} by{" "}
          {shown.translatorUsername ? (
            <Link href={`/author/${shown.translatorUsername}`} className={link}>
              {shown.translator}
            </Link>
          ) : (
            "a volunteer"
          )}
          .{shown.stale && " The writer has edited this chapter since, so small details may differ."}{" "}
          <button onClick={onOriginal} className={link}>
            Show original
          </button>
        </span>
      </>
    );
  } else if (shown.kind === "machine") {
    body = (
      <>
        <Languages className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Machine-translated from {from} into {target}; it may miss nuance.{" "}
          <button onClick={onOriginal} className={link}>
            Show original
          </button>
        </span>
      </>
    );
  } else if (shown.kind === "pending") {
    body = error ? (
      <span>
        {error}{" "}
        <button onClick={onRetry} className={link}>
          Try again
        </button>{" "}
        ·{" "}
        <button onClick={onOriginal} className={link}>
          Read the original
        </button>
      </span>
    ) : (
      <>
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
        <span role="status">Translating this chapter into {target}… The original is shown until it&apos;s ready.</span>
      </>
    );
  } else {
    body = (
      <span>
        This chapter isn&apos;t translated into {target} yet, so you&apos;re reading the {from} original.{" "}
        <button onClick={onOriginal} className={link}>
          Always show the original
        </button>
      </span>
    );
  }
  return (
    <p className="mt-5 flex gap-2 rounded-xl border px-3.5 py-2.5 text-sm" style={{ borderColor: border, color: muted }}>
      {body}
    </p>
  );
}
