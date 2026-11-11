"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { setTranslatorLanguages } from "@/app/translation/actions";
import { LANGUAGES, languageLabel } from "@/lib/translation/languages";

/** Pick the languages you translate into; saved as you go. */
export function TranslatorLanguages({ initial }: { initial: string[] }) {
  const [langs, setLangs] = useState(initial);
  const [adding, setAdding] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(next: string[]) {
    const prev = langs;
    setLangs(next);
    setError(null);
    start(async () => {
      const r = await setTranslatorLanguages(next);
      if (!r.ok) {
        setLangs(prev);
        setError(r.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }
    });
  }

  return (
    <div className="mt-3">
      <ul className="flex flex-wrap gap-2">
        {langs.map((l) => (
          <li key={l}>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent/12 pr-1.5 pl-3.5 text-sm text-foreground ring-1 ring-accent/25">
              {languageLabel(l)}
              <button onClick={() => save(langs.filter((x) => x !== l))} aria-label={`Remove ${languageLabel(l)}`} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </li>
        ))}
        {langs.length === 0 && <li className="text-sm text-muted">None yet.</li>}
      </ul>
      {langs.length < 12 && (
        <div className="mt-3 flex gap-2">
          <select
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            aria-label="Add a language"
            className="h-10 min-w-0 flex-1 rounded-lg border border-border-strong bg-background px-3 text-sm"
          >
            <option value="">Add a language…</option>
            {LANGUAGES.filter((l) => !langs.includes(l.code)).map((l) => (
              <option key={l.code} value={l.code}>
                {languageLabel(l.code)}
              </option>
            ))}
          </select>
          <button
            disabled={!adding || pending}
            onClick={() => {
              save([...langs, adding]);
              setAdding("");
            }}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 px-3 text-sm font-medium disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      )}
      <p className="mt-2 h-5 text-sm text-muted" role="status">
        {pending ? (
          <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>
        ) : saved ? (
          <span className="inline-flex items-center gap-1.5 text-success"><Check className="h-3.5 w-3.5" /> Saved</span>
        ) : error ? (
          <span className="text-danger">{error}</span>
        ) : null}
      </p>
    </div>
  );
}
