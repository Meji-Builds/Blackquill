"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Languages, Search, Sparkles, Users, X } from "lucide-react";
import { LANGUAGES, language, languageLabel } from "@/lib/translation/languages";
import type { ReaderLanguages } from "@/lib/translation/resolve";

/**
 * Chooses the language to read this story in. Volunteer translations come first; machine translation covers the
 * rest when the writer allows it. The choice is remembered for this story only.
 */
export function LanguagePanel({
  languages,
  storyId,
  onPick,
  onClose,
}: {
  languages: ReaderLanguages;
  storyId: string;
  onPick: (lang: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = languages.chosen;
  const communityCodes = new Set(languages.community.map((c) => c.language));
  const q = query.trim().toLowerCase();
  const matches = (code: string) => {
    const l = language(code);
    return !q || (l && (l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code === q));
  };
  const machineList = languages.machineLanguages.filter((c) => !communityCodes.has(c) && matches(c));

  const row = (code: string | null, label: string, hint: React.ReactNode, icon?: React.ReactNode) => {
    const on = current === code;
    return (
      <li key={code ?? "original"}>
        <button
          onClick={() => onPick(code)}
          aria-pressed={on}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${on ? "bg-accent/15 ring-1 ring-accent/40" : "hover:bg-surface-2"}`}
          dir="auto"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{label}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              {icon}
              {hint}
            </span>
          </span>
          {on && <Check className="h-4 w-4 shrink-0 text-accent" />}
        </button>
      </li>
    );
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label="Reading language"
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl border border-border bg-surface text-foreground shadow-2xl outline-none sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-auto sm:max-h-[calc(100vh-6rem)] sm:w-[22rem] sm:rounded-2xl"
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="flex items-center gap-2 font-serif text-lg">
          <Languages className="h-5 w-5 text-accent" /> Read in
        </h2>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="overflow-y-auto overscroll-contain px-3 pb-5">
        <ul className="space-y-1">
          {row(null, languageLabel(languages.original), "Original, as the writer wrote it")}
        </ul>

        {languages.community.length > 0 && (
          <>
            <h3 className="mt-4 mb-1 px-3 text-xs tracking-wider text-muted uppercase">Translated by readers</h3>
            <ul className="space-y-1">
              {languages.community.map((c) =>
                row(
                  c.language,
                  languageLabel(c.language),
                  `${c.translators.length ? `by ${c.translators.join(", ")} · ` : ""}${c.chapters} of ${c.total} chapters${c.hasThisChapter ? "" : " (not this one yet)"}`,
                  <Users className="h-3.5 w-3.5" />,
                ),
              )}
            </ul>
          </>
        )}

        {languages.machine ? (
          <>
            <h3 className="mt-4 mb-1 px-3 text-xs tracking-wider text-muted uppercase">Machine translation</h3>
            {languages.machineLanguages.length > 8 && (
              <label className="mx-3 mb-2 flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-background px-3">
                <Search className="h-4 w-4 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a language"
                  aria-label="Find a language"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
            )}
            <ul className="space-y-1">
              {machineList.map((code) => row(code, languageLabel(code), "Translated automatically", <Sparkles className="h-3.5 w-3.5" />))}
              {machineList.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matching language.</li>}
            </ul>
          </>
        ) : (
          languages.community.length === 0 && (
            <p className="mt-4 px-3 text-sm text-muted">
              This story isn&apos;t translated yet. Speak another language?{" "}
              <Link href={`/story/${storyId}#translate`} className="font-medium text-foreground underline">
                Help translate it
              </Link>
              .
            </p>
          )
        )}
        <p className="mt-4 px-3 text-xs text-muted">
          Your choice applies to this story only. {LANGUAGES.length} languages are supported.
        </p>
      </div>
    </div>
  );
}
