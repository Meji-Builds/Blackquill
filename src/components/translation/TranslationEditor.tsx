"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, Loader2, Sparkles } from "lucide-react";
import { machineTranslate, saveCommunityTranslation } from "@/app/translation/actions";
import { language, languageLabel, splitParagraphs } from "@/lib/translation/languages";
import { btn, input } from "@/components/ui/styles";

const AUTOSAVE_MS = 2500;

export function TranslationEditor(props: {
  storyId: string;
  storyTitle: string;
  from: string;
  to: string;
  chapter: { id: string; number: number; title: string; body: string };
  initial: { title: string; body: string; published: boolean; savedAt: string; stale: boolean } | null;
  lockedBy: string | null;
  prev: number | null;
  next: number | null;
  machine: boolean;
}) {
  const { storyId, to, chapter } = props;
  const [title, setTitle] = useState(props.initial?.title ?? "");
  const [body, setBody] = useState(props.initial?.body ?? "");
  const [published, setPublished] = useState(props.initial?.published ?? false);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; text?: string }>(
    props.initial ? { kind: "saved", text: `Saved ${new Date(props.initial.savedAt).toLocaleString()}` } : { kind: "idle" },
  );
  const [drafting, setDrafting] = useState(false);
  const [tab, setTab] = useState<"original" | "translation">("translation");
  const dirty = useRef(false);
  const latest = useRef({ title, body, published });
  latest.current = { title, body, published };

  const originalParas = splitParagraphs(chapter.body);
  const mineParas = splitParagraphs(body);
  const rtl = language(to)?.rtl;
  const fromRtl = language(props.from)?.rtl;

  const save = useCallback(
    async (publish?: boolean) => {
      const v = latest.current;
      const nextPublished = publish ?? v.published;
      setStatus({ kind: "saving" });
      const r = await saveCommunityTranslation({ chapterId: chapter.id, language: to, title: v.title, body: v.body, publish: nextPublished }).catch(() => ({
        ok: false as const,
        error: "You seem to be offline. Your text is still here; it will save when you reconnect.",
      }));
      if (!r.ok) return setStatus({ kind: "error", text: r.error });
      dirty.current = false;
      setPublished(nextPublished);
      setStatus({
        kind: "saved",
        text: publish === true ? "Published. Readers can now read this chapter in " + (language(to)?.native ?? to) + "." : publish === false ? "Unpublished. Readers no longer see it." : "Saved",
      });
    },
    [chapter.id, to],
  );

  // Autosave a short while after typing stops.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [title, body, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function edit(fn: () => void) {
    dirty.current = true;
    fn();
  }

  async function machineDraft() {
    if (body.trim() && !confirm("Replace your current text with a machine draft?")) return;
    setDrafting(true);
    const r = await machineTranslate(chapter.id, to, { forDraft: true }).catch(() => ({ ok: false as const, error: "You seem to be offline.", text: undefined }));
    setDrafting(false);
    if (!r.ok || !r.text) return setStatus({ kind: "error", text: r.ok ? "No draft came back." : r.error });
    edit(() => {
      setTitle(r.text!.title);
      setBody(r.text!.paragraphs.join("\n\n"));
    });
  }

  if (props.lockedBy) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-12 text-center">
        <h1 className="font-display text-3xl font-semibold">Chapter {chapter.number} is taken</h1>
        <p className="mt-2 text-muted">
          {props.lockedBy} is translating this chapter into {languageLabel(to)}. Pick another chapter so you don&apos;t duplicate each other&apos;s work.
        </p>
        <Link href={`/translate/${storyId}/${to}`} className={`${btn.secondary} mt-6`}>
          Back to chapters
        </Link>
      </div>
    );
  }

  const paneTitle = "mb-2 text-xs font-semibold tracking-wider text-muted uppercase";
  const aligned = !body.trim() || mineParas.length === originalParas.length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/translate/${storyId}/${to}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> {props.storyTitle}
          </Link>
          <h1 className="font-display text-[30px] leading-tight font-semibold">
            Chapter {chapter.number} <span className="text-muted">· {languageLabel(to)}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {props.prev && (
            <Link href={`/translate/${storyId}/${to}/${props.prev}`} aria-label="Previous chapter" className={btn.icon}>
              <ChevronLeft className="h-5 w-5" />
            </Link>
          )}
          {props.next && (
            <Link href={`/translate/${storyId}/${to}/${props.next}`} aria-label="Next chapter" className={btn.icon}>
              <ChevronRight className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      {props.initial?.stale && (
        <p className="mt-4 flex gap-2 rounded-xl bg-warning/10 px-3.5 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          The writer edited this chapter after you translated it. Compare it with the original and update your translation.
        </p>
      )}

      <div role="tablist" aria-label="Show" className="mt-5 grid grid-cols-2 rounded-xl border border-border p-1 lg:hidden">
        {(["original", "translation"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`h-9 rounded-lg text-sm font-medium ${tab === v ? "bg-accent-strong text-white" : "text-muted"}`}>
            {v === "original" ? `Original (${language(props.from)?.native ?? props.from})` : `Translation (${language(to)?.native ?? to})`}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <section className={`${tab === "original" ? "" : "hidden"} lg:block`} aria-label="Original">
          <p className={paneTitle}>Original · {languageLabel(props.from)}</p>
          <div className="rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto" lang={props.from} dir={fromRtl ? "rtl" : "ltr"}>
            <h2 className="font-serif text-xl font-semibold">{chapter.title || `Chapter ${chapter.number}`}</h2>
            <ol className="mt-4 space-y-4 font-serif text-[16px] leading-relaxed">
              {originalParas.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-5 shrink-0 pt-1 text-right font-sans text-[11px] text-muted tabular-nums" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="whitespace-pre-line">{p}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${tab === "translation" ? "" : "hidden"} lg:block`} aria-label="Translation">
          <p className={paneTitle}>Your translation · {languageLabel(to)}</p>
          <label className="block text-sm">
            Chapter title
            <input
              value={title}
              onChange={(e) => edit(() => setTitle(e.target.value))}
              placeholder={chapter.title}
              maxLength={300}
              className={`${input} mt-1`}
              lang={to}
              dir={rtl ? "rtl" : "ltr"}
            />
          </label>
          <label className="mt-4 block text-sm">
            Chapter text
            <textarea
              value={body}
              onChange={(e) => edit(() => setBody(e.target.value))}
              rows={22}
              lang={to}
              dir={rtl ? "rtl" : "ltr"}
              placeholder="Translate paragraph by paragraph, leaving a blank line between paragraphs like the original."
              className="mt-1 w-full rounded-xl border border-border-strong bg-surface px-4 py-3 font-serif text-[16px] leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <p className={`mt-1 text-xs ${aligned ? "text-muted" : "text-warning"}`}>
            {mineParas.length} of {originalParas.length} paragraphs
            {!aligned && " · keep one paragraph for each in the original, so readers' paragraph comments line up"}
          </p>
          {props.machine && (
            <button onClick={machineDraft} disabled={drafting} className={`${btn.small} mt-3`}>
              {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {drafting ? "Drafting…" : "Start from a machine draft"}
            </button>
          )}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <span role="status" className={`mr-auto text-sm ${status.kind === "error" ? "text-danger" : "text-muted"}`}>
            {status.kind === "saving" ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</span>
            ) : (
              status.text ?? (published ? "Published" : "Not saved yet")
            )}
          </span>
          {published && (
            <Link href={`/story/${storyId}/chapter/${chapter.number}?lang=${to}`} target="_blank" className={btn.small}>
              <Eye className="h-4 w-4" /> View
            </Link>
          )}
          {published ? (
            <button onClick={() => save(false)} className={btn.small}>
              Unpublish
            </button>
          ) : (
            <button onClick={() => save()} className={btn.small}>
              Save draft
            </button>
          )}
          {!published && (
            <button onClick={() => save(true)} disabled={!body.trim()} className={`${btn.primary} h-9`}>
              Publish chapter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
