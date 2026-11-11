"use client";

/* eslint-disable @next/next/no-img-element -- generated panels come from storage */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Brush, Check, Image as ImageIcon, ImagePlus, Images, Info, Loader2, RefreshCw, Scissors, X } from "lucide-react";
import { BackLink } from "@/components/ui/BackLink";
import { btn, card, textarea } from "@/components/ui/styles";
import { COMIC_STYLES } from "@/lib/comics/styles";
import {
  generatePanel,
  reviewPanel,
  setChapterStyle,
  splitIntoScenes,
  updatePanelText,
  uploadReference,
} from "@/app/studio/comics/actions";

export interface StudioPanel {
  id: string;
  scene_index: number;
  prompt: string;
  caption: string;
  style: string;
  image_url: string | null;
  status: "pending" | "approved" | "rejected";
  error: string | null;
  reference_image_url: string | null;
}

interface Budget {
  enabled: boolean;
  cap: number;
  used: number;
}

const STATUS = {
  pending: { label: "Awaiting review", tone: "bg-warning/10 text-warning ring-warning/30" },
  approved: { label: "Approved", tone: "bg-success/10 text-success ring-success/30" },
  rejected: { label: "Rejected", tone: "bg-danger/10 text-danger ring-danger/30" },
} as const;

export function ComicStudio({
  storyId,
  chapter,
  panels: initial,
  budget: initialBudget,
  provider,
}: {
  storyId: string;
  chapter: { id: string; number: number; title: string; storyTitle: string };
  panels: StudioPanel[];
  budget: Budget;
  provider: "openai" | "demo";
}) {
  const router = useRouter();
  const [panels, setPanels] = useState(initial);
  const [budget, setBudget] = useState(initialBudget);
  const [style, setStyle] = useState(initial[0]?.style ?? "webtoon");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [batch, setBatch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setPanels(initial), [initial]);
  useEffect(() => setBudget(initialBudget), [initialBudget]);

  const remaining = Math.max(0, budget.cap - budget.used);
  const approved = panels.filter((p) => p.status === "approved").length;
  const hasReference = panels.some((p) => p.reference_image_url);

  if (!budget.enabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-12">
        <BackLink href={`/studio/${storyId}/chapters/${chapter.id}`}>Chapter {chapter.number}</BackLink>
        <div className={`${card} mt-4 p-8 text-center`}>
          <Images className="mx-auto h-10 w-10 text-accent" strokeWidth={1.5} />
          <h1 className="mt-4 font-display text-3xl font-semibold">Comic panels are for featured stories</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">
            While comic panels are being tested, they are switched on for a handful of featured stories. When this
            story is featured, you will be able to turn each chapter into illustrated panels here.
          </p>
        </div>
      </div>
    );
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error ?? "Something went wrong." });
      router.refresh();
    });

  async function generate(p: StudioPanel) {
    setBusy((b) => ({ ...b, [p.id]: true }));
    setMsg(null);
    const r = await generatePanel(p.id);
    setBusy((b) => ({ ...b, [p.id]: false }));
    if (typeof r.remaining === "number") setBudget((b) => ({ ...b, used: b.cap - r.remaining! }));
    setPanels((list) =>
      list.map((x) => (x.id === p.id ? { ...x, image_url: r.imageUrl ?? x.image_url, status: r.ok ? "pending" : x.status, error: r.ok ? null : r.error ?? null } : x)),
    );
    return r.ok;
  }

  async function generateMissing() {
    setBatch(true);
    for (const p of panels.filter((x) => !x.image_url || x.status === "rejected")) {
      if (budget.cap - budget.used <= 0) break;
      const ok = await generate(p);
      if (!ok) break;
    }
    setBatch(false);
    router.refresh();
  }

  async function review(p: StudioPanel, decision: StudioPanel["status"]) {
    setPanels((list) => list.map((x) => (x.id === p.id ? { ...x, status: decision } : x)));
    const r = await reviewPanel(p.id, decision);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error });
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-16">
      <BackLink href={`/studio/${storyId}/chapters/${chapter.id}`}>Chapter {chapter.number}</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{chapter.storyTitle}</p>
          <h1 className="font-display text-[36px] leading-tight font-semibold">Comic panels</h1>
          <p className="text-sm text-muted">
            Chapter {chapter.number}
            {chapter.title ? `: ${chapter.title}` : ""} · {approved} of {panels.length} approved
          </p>
        </div>
        <div className="min-w-56 rounded-xl bg-surface-2 p-3 ring-1 ring-border">
          <div className="flex justify-between text-xs text-muted">
            <span>Generations left</span>
            <span className="tabular-nums">
              {remaining} of {budget.cap}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(remaining / Math.max(1, budget.cap)) * 100}%` }} />
          </div>
        </div>
      </div>

      {provider === "demo" && (
        <p className="mt-5 flex gap-2 rounded-xl border border-border bg-surface p-3 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          Demo mode: panels are drawn by a built-in generator. Add an OpenAI API key to the server to generate real
          illustrations with the same workflow.
        </p>
      )}

      <section className={`${card} mt-6 space-y-5 p-5`}>
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">Style</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COMIC_STYLES.map((s) => (
              <button
                key={s.id}
                disabled={pending}
                aria-pressed={style === s.id}
                onClick={() => {
                  setStyle(s.id);
                  if (panels.length) run(() => setChapterStyle(chapter.id, s.id));
                }}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 transition ${
                  style === s.id ? "bg-accent/15 text-foreground ring-accent/50" : "text-muted ring-border-strong hover:text-foreground"
                }`}
              >
                <span className="flex">
                  {s.palette.map((c) => (
                    <span key={c} className="-ml-1 h-3.5 w-3.5 rounded-full ring-2 ring-surface first:ml-0" style={{ background: c }} />
                  ))}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const form = new FormData();
              form.set("reference", f);
              run(() => uploadReference(chapter.id, form));
              e.target.value = "";
            }}
          />
          <button disabled={pending || panels.length === 0} onClick={() => fileRef.current?.click()} className={btn.small}>
            <ImagePlus className="h-4 w-4" /> {hasReference ? "Replace reference image" : "Add a reference image"}
          </button>
          {hasReference && (
            <button disabled={pending} onClick={() => run(() => uploadReference(chapter.id, new FormData()))} className="text-sm text-muted hover:text-danger">
              Remove reference
            </button>
          )}
          <span className="text-xs text-muted">Optional: a character sheet or artwork for the panels to match.</span>
        </div>
      </section>

      {panels.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border-strong p-10 text-center">
          <Scissors className="mx-auto h-10 w-10 text-accent" strokeWidth={1.5} />
          <h2 className="mt-4 font-display text-2xl font-semibold">Split this chapter into scenes</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            We&apos;ll pick 3 to 8 key moments and draft a picture prompt for each. You can edit every prompt before
            anything is generated.
          </p>
          <button disabled={pending} onClick={() => run(() => splitIntoScenes(chapter.id, style))} className={`${btn.primary} mt-6`}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />} Split into scenes
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button disabled={batch || pending || remaining === 0} onClick={generateMissing} className={btn.primary}>
              {batch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brush className="h-4 w-4" />}
              {batch ? "Generating…" : "Generate all missing panels"}
            </button>
            <button
              disabled={batch || pending}
              onClick={() => {
                if (window.confirm("Split the chapter again? This replaces every panel, including approved ones. Generations already used still count."))
                  run(() => splitIntoScenes(chapter.id, style));
              }}
              className={btn.ghost}
            >
              <Scissors className="h-4 w-4" /> Split again
            </button>
            {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
          </div>

          <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {panels.map((p) => (
              <PanelCard
                key={p.id}
                panel={p}
                busy={Boolean(busy[p.id]) || batch}
                canGenerate={remaining > 0}
                onGenerate={() => generate(p).then(() => router.refresh())}
                onReview={(d) => review(p, d)}
                onSave={async (fields) => {
                  const r = await updatePanelText(p.id, fields);
                  if (!r.ok) setMsg({ ok: false, text: r.error });
                  else setPanels((list) => list.map((x) => (x.id === p.id ? { ...x, ...fields } : x)));
                }}
              />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function PanelCard({
  panel: p,
  busy,
  canGenerate,
  onGenerate,
  onReview,
  onSave,
}: {
  panel: StudioPanel;
  busy: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onReview: (d: StudioPanel["status"]) => void;
  onSave: (f: { prompt?: string; caption?: string }) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState(p.prompt);
  const [caption, setCaption] = useState(p.caption);
  useEffect(() => setPrompt(p.prompt), [p.prompt]);
  useEffect(() => setCaption(p.caption), [p.caption]);
  const status = STATUS[p.status];

  return (
    <li className={`${card} flex flex-col overflow-hidden`}>
      <div className="relative aspect-[2/3] bg-surface-2">
        {p.image_url ? (
          <img src={p.image_url} alt={`Panel ${p.scene_index + 1}: ${p.caption}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted">
            <ImageIcon className="h-8 w-8 opacity-50" strokeWidth={1.5} />
            Not generated yet
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          Scene {p.scene_index + 1}
        </span>
        {p.image_url && (
          <span className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-medium ring-1 backdrop-blur ${status.tone}`}>
            {status.label}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <label className="block text-xs font-semibold tracking-wider text-muted uppercase">
          Caption
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => caption !== p.caption && onSave({ caption })}
            rows={2}
            maxLength={300}
            className={`${textarea} mt-1.5 font-serif text-sm font-normal tracking-normal normal-case`}
          />
        </label>
        <label className="block text-xs font-semibold tracking-wider text-muted uppercase">
          Picture prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={() => prompt.trim() && prompt !== p.prompt && onSave({ prompt })}
            rows={4}
            maxLength={1000}
            className={`${textarea} mt-1.5 text-sm font-normal tracking-normal normal-case`}
          />
        </label>
        {p.error && (
          <p className="flex gap-2 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" /> {p.error}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2">
          <button disabled={busy || !canGenerate} onClick={onGenerate} className={btn.small} title={canGenerate ? undefined : "No generations left for this chapter"}>
            {p.image_url ? <RefreshCw className="h-4 w-4" /> : <Brush className="h-4 w-4" />}
            {p.image_url ? "Regenerate" : "Generate"}
          </button>
          {p.image_url && p.status !== "approved" && (
            <button disabled={busy} onClick={() => onReview("approved")} className={`${btn.small} border-success/40 text-success`}>
              <Check className="h-4 w-4" /> Approve
            </button>
          )}
          {p.image_url && p.status === "approved" && (
            <button disabled={busy} onClick={() => onReview("pending")} className={btn.small}>
              Unapprove
            </button>
          )}
          {p.image_url && p.status === "pending" && (
            <button disabled={busy} onClick={() => onReview("rejected")} className={`${btn.small} text-danger`}>
              <X className="h-4 w-4" /> Reject
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
