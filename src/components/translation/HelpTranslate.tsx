"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Languages, Loader2, X } from "lucide-react";
import { askToTranslate } from "@/app/translation/actions";
import { LANGUAGES, languageLabel } from "@/lib/translation/languages";
import { btn } from "@/components/ui/styles";

export interface MyTranslatorRow {
  language: string;
  status: "requested" | "invited" | "approved" | "declined";
}

/** "Help translate" on a story page: ask the writer to let you translate it into one of your languages. */
export function HelpTranslate({
  storyId,
  storyTitle,
  original,
  signedIn,
  mine,
  myLanguages,
}: {
  storyId: string;
  storyTitle: string;
  original: string;
  signedIn: boolean;
  mine: MyTranslatorRow[];
  myLanguages: string[];
}) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(myLanguages.find((l) => l !== original) ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const approved = mine.filter((m) => m.status === "approved");
  const pending = mine.filter((m) => m.status === "requested");
  const invited = mine.filter((m) => m.status === "invited");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lang) return setError("Pick the language you'll translate into.");
    setBusy(true);
    setError(null);
    const r = await askToTranslate(storyId, lang, message).catch(() => ({ ok: false as const, error: "You seem to be offline." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSent(lang);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {approved.map((m) => (
        <Link key={m.language} href={`/translate/${storyId}/${m.language}`} className={btn.small}>
          <Languages className="h-4 w-4" /> Translate into {languageLabel(m.language)}
        </Link>
      ))}
      {invited.length > 0 && (
        <Link href="/translate" className={`${btn.small} border-accent/50 text-accent`}>
          You&apos;re invited to translate: answer
        </Link>
      )}
      {pending.map((m) => (
        <span key={m.language} className="text-sm text-muted">
          Asked to translate into {languageLabel(m.language)}; waiting for the writer.
        </span>
      ))}
      {signedIn ? (
        <button onClick={() => setOpen(true)} className={btn.small}>
          <Languages className="h-4 w-4" /> Help translate
        </button>
      ) : (
        <Link href={`/login?next=/story/${storyId}%23translate`} className={btn.small}>
          <Languages className="h-4 w-4" /> Help translate
        </Link>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="translate-title" className="relative w-full max-w-md rounded-t-3xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
            <button onClick={() => setOpen(false)} aria-label="Close" className="absolute top-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2">
              <X className="h-5 w-5" />
            </button>
            {sent ? (
              <div className="py-4 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="h-6 w-6" />
                </span>
                <h2 id="translate-title" className="mt-4 text-lg font-semibold">Request sent</h2>
                <p className="mt-1 text-sm text-muted">
                  The writer of {storyTitle} will see your offer to translate it into {languageLabel(sent)}. We&apos;ll notify you when they answer.
                </p>
                <button onClick={() => window.location.reload()} className={`${btn.primary} mt-6`}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 id="translate-title" className="text-lg font-semibold">Translate {storyTitle}</h2>
                <p className="mt-1 text-sm text-muted">
                  It&apos;s written in {languageLabel(original)}. Offer to translate it; once the writer approves, you get a translation desk with
                  the original beside your draft. Readers see your name on every chapter you translate.
                </p>
                <label className="mt-4 block text-sm font-medium">
                  Translate into
                  <select value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-border-strong bg-background px-3 text-[15px]">
                    <option value="">Choose a language</option>
                    {LANGUAGES.filter((l) => l.code !== original).map((l) => (
                      <option key={l.code} value={l.code}>
                        {languageLabel(l.code)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block text-sm font-medium">
                  A note to the writer <span className="font-normal text-muted">(optional)</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Your experience, why you love the story…"
                    className="mt-1 w-full rounded-lg border border-border-strong bg-background px-3 py-2.5 text-[15px]"
                  />
                </label>
                {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)} className={btn.ghost}>
                    Cancel
                  </button>
                  <button disabled={busy} className={btn.primary}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Sending…" : "Send request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
