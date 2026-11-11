"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteChoicePoint, saveChoicePoint } from "@/app/studio/actions";
import { CHOICE_LIMITS, type ChoicePoint } from "@/lib/choices/types";

interface Draft {
  anchor: number;
  prompt: string;
  options: { label: string; branch: string }[];
}

const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

function snippet(p: string | undefined) {
  if (!p) return "";
  const t = p.replace(/\s+/g, " ").trim();
  return t.length > 90 ? `…${t.slice(-90)}` : t;
}

function toDraft(c: ChoicePoint): Draft {
  return { anchor: c.anchor, prompt: c.prompt, options: c.options.map((o) => ({ label: o.label, branch: o.branch })) };
}

/**
 * One interactive choice per chapter: a question after a chosen paragraph, with 2 or 3 options that each lead to a
 * short branch scene before the reader rejoins the main text.
 */
export function ChoicePointEditor({
  chapterId,
  initial,
  paragraphs,
  cursorParagraph,
}: {
  chapterId: string;
  initial: ChoicePoint | null;
  paragraphs: string[];
  cursorParagraph: number | null;
}) {
  const [saved, setSaved] = useState<Draft | null>(initial ? toDraft(initial) : null);
  const [draft, setDraft] = useState<Draft | null>(initial ? toDraft(initial) : null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // Warn before leaving with an unsaved choice.
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Without a cursor yet, new choices default to after the last paragraph.
  const lastParagraph = Math.max(0, paragraphs.length - 1);
  const cursor = cursorParagraph === null ? lastParagraph : Math.min(cursorParagraph, lastParagraph);

  function update(patch: Partial<Draft>) {
    setMsg(null);
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }
  function updateOption(i: number, patch: Partial<Draft["options"][number]>) {
    setMsg(null);
    setDraft((d) => (d ? { ...d, options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) } : d));
  }

  function problems(d: Draft): string | null {
    if (!d.prompt.trim()) return "Write the question readers will answer.";
    for (const [i, o] of d.options.entries()) {
      if (!o.label.trim()) return `Option ${i + 1} needs a label.`;
      if (!o.branch.trim()) return `Option ${i + 1} needs its branch scene.`;
    }
    return null;
  }

  function save() {
    if (!draft) return;
    const problem = problems(draft);
    if (problem) return setMsg({ ok: false, text: problem });
    start(async () => {
      const r = await saveChoicePoint(chapterId, draft);
      if (r.ok) setSaved(draft);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error });
    });
  }

  function remove() {
    if (!saved) {
      setDraft(null);
      return;
    }
    if (!window.confirm("Remove this choice? Readers' picks for it are deleted too.")) return;
    start(async () => {
      const r = await deleteChoicePoint(chapterId);
      if (r.ok) {
        setSaved(null);
        setDraft(null);
      }
      setMsg(r.ok ? { ok: true, text: r.message ?? "Removed." } : { ok: false, text: r.error });
    });
  }

  if (!draft) {
    return (
      <section className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="font-serif text-xl">Choice point</h2>
        <p className="mt-1 text-sm text-muted">
          Let readers choose what happens next. Put your cursor in a paragraph, then add a choice after it. Each
          option leads to a short scene, and every path rejoins the main story.
        </p>
        <button
          disabled={paragraphs.length === 0}
          onClick={() =>
            setDraft({ anchor: cursor, prompt: "", options: [{ label: "", branch: "" }, { label: "", branch: "" }] })
          }
          className="mt-4 rounded-md border border-accent/50 px-4 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          + Add a choice after paragraph {cursor + 1}
        </button>
        {paragraphs.length === 0 && <p className="mt-2 text-xs text-muted">Write the chapter first.</p>}
        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-300" : "text-danger"}`}>{msg.text}</p>}
      </section>
    );
  }

  const beyondEnd = draft.anchor >= paragraphs.length;

  return (
    <section className="mt-6 rounded-lg border border-accent/30 bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl">Choice point</h2>
        {dirty && <span className="text-xs text-amber-300">Unsaved changes</span>}
      </div>

      <div className="mt-3 rounded-md border border-border bg-background/60 p-3 text-sm">
        <p className="text-muted">
          Appears after paragraph {Math.min(draft.anchor, paragraphs.length - 1) + 1}
          {beyondEnd && " (that paragraph no longer exists, so it shows at the end)"}:
        </p>
        <p className="mt-1 font-serif italic">{snippet(paragraphs[Math.min(draft.anchor, paragraphs.length - 1)])}</p>
        {cursorParagraph !== null && cursor !== draft.anchor && (
          <button onClick={() => update({ anchor: cursor })} className="mt-2 text-xs text-accent hover:underline">
            Move it after paragraph {cursor + 1} (where your cursor is)
          </button>
        )}
      </div>

      <label className="mt-4 block text-sm">
        Question
        <input
          value={draft.prompt}
          maxLength={CHOICE_LIMITS.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder="The door has no handle. What does Ama do?"
          className={`mt-1 ${field}`}
        />
      </label>

      <div className="mt-4 space-y-4">
        {draft.options.map((o, i) => (
          <fieldset key={i} className="rounded-md border border-border p-3">
            <legend className="px-1 text-xs uppercase tracking-wider text-muted">Option {i + 1}</legend>
            <input
              value={o.label}
              maxLength={CHOICE_LIMITS.label}
              onChange={(e) => updateOption(i, { label: e.target.value })}
              placeholder={["Open the door", "Go back up the stairs", "Call out"][i]}
              aria-label={`Option ${i + 1} label`}
              className={field}
            />
            <textarea
              value={o.branch}
              maxLength={CHOICE_LIMITS.branch}
              onChange={(e) => updateOption(i, { branch: e.target.value })}
              placeholder="The short scene readers see if they pick this. Leave a blank line between paragraphs."
              aria-label={`Option ${i + 1} branch scene`}
              rows={5}
              className={`mt-2 font-serif leading-relaxed ${field}`}
            />
            {draft.options.length > CHOICE_LIMITS.minOptions && (
              <button
                onClick={() => update({ options: draft.options.filter((_, j) => j !== i) })}
                className="mt-1 text-xs text-muted hover:text-danger"
              >
                Remove option {i + 1}
              </button>
            )}
          </fieldset>
        ))}
      </div>
      {draft.options.length < CHOICE_LIMITS.maxOptions && (
        <button
          onClick={() => update({ options: [...draft.options, { label: "", branch: "" }] })}
          className="mt-3 text-sm text-accent hover:underline"
        >
          + Add a third option
        </button>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-md bg-accent-strong px-4 py-2 text-sm font-medium text-white hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save choice"}
        </button>
        <button onClick={remove} disabled={pending} className="text-sm text-muted hover:text-danger">
          {saved ? "Remove choice" : "Cancel"}
        </button>
        {msg && <p className={`text-sm ${msg.ok ? "text-emerald-300" : "text-danger"}`}>{msg.text}</p>}
      </div>
    </section>
  );
}
