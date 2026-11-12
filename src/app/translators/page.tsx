import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Languages } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LANGUAGES, isLanguage, languageLabel } from "@/lib/translation/languages";

export const metadata: Metadata = {
  title: "Translators",
  description: "Volunteer translators bringing Obsidian Quill stories to readers in their languages.",
};

type Search = Promise<{ lang?: string }>;

export default async function TranslatorsPage({ searchParams }: { searchParams: Search }) {
  const { lang: raw } = await searchParams;
  const lang = isLanguage(raw) ? raw : null;
  const supabase = await createClient();
  let q = supabase
    .from("profiles")
    .select("id, username, display_name, bio, translator_languages, avatar_url")
    .neq("translator_languages", "{}")
    .order("created_at", { ascending: false })
    .limit(100);
  if (lang) q = q.contains("translator_languages", [lang]);
  const { data } = await q;
  const people = data ?? [];
  const ids = people.map((p) => p.id);
  const { data: work } = ids.length
    ? await supabase.from("chapter_translations").select("translator_id").in("translator_id", ids).eq("kind", "community").eq("published", true)
    : { data: [] as { translator_id: string }[] };
  const chapters = new Map<string, number>();
  for (const w of work ?? []) chapters.set(w.translator_id, (chapters.get(w.translator_id) ?? 0) + 1);
  people.sort((a, b) => (chapters.get(b.id) ?? 0) - (chapters.get(a.id) ?? 0));

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-12 sm:pt-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Community</p>
      <h1 className="mt-1 font-display text-[38px] leading-tight font-semibold">Translators</h1>
      <p className="mt-1 max-w-2xl text-muted">
        Volunteers who bring stories to readers in their language. Writers can invite them from their story&apos;s studio page.{" "}
        <Link href="/translate" className="font-medium text-foreground underline">Become a translator</Link>.
      </p>

      <form className="mt-6 flex gap-2" action="/translators">
        <select name="lang" defaultValue={lang ?? ""} aria-label="Language" className="h-11 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-3 text-[15px] sm:max-w-xs">
          <option value="">All languages</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {languageLabel(l.code)}
            </option>
          ))}
        </select>
        <button className="h-11 rounded-lg bg-accent-strong px-4 text-sm font-medium text-white">Filter</button>
      </form>

      {people.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border-strong p-8 text-center text-muted">
          No translators {lang ? `for ${languageLabel(lang)} ` : ""}yet. <Link href="/translate" className="font-medium text-foreground underline">Be the first</Link>.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {people.map((p) => {
            const name = p.display_name || p.username;
            const n = chapters.get(p.id) ?? 0;
            return (
              <li key={p.id}>
                <Link href={`/author/${p.username}`} className="flex h-full gap-3.5 rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2">
                  <Avatar url={p.avatar_url} name={name} seed={p.username} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{name}</span>
                    <span className="block text-xs text-muted">@{p.username} · {n} {n === 1 ? "chapter" : "chapters"} translated</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {p.translator_languages.map((l: string) => (
                        <span key={l} className={`rounded-full px-2 py-0.5 text-xs ring-1 ${l === lang ? "bg-accent/15 text-accent ring-accent/30" : "text-muted ring-border-strong"}`}>
                          {languageLabel(l)}
                        </span>
                      ))}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-8 flex items-center gap-2 text-sm text-muted">
        <Languages className="h-4 w-4" /> Translators&apos; usernames are shown so writers can invite them.
      </p>
    </div>
  );
}
