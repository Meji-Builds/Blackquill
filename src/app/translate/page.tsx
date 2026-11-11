import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Languages, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Cover } from "@/components/Cover";
import { TranslatorAnswer } from "@/components/translation/TranslatorAnswer";
import { TranslatorLanguages } from "@/components/translation/TranslatorLanguages";
import { languageLabel } from "@/lib/translation/languages";

export const metadata: Metadata = { title: "Translation desk" };

interface Row {
  story_id: string;
  language: string;
  status: "requested" | "invited" | "approved" | "declined";
  created_at: string;
  stories: {
    id: string;
    title: string;
    cover_url: string | null;
    language: string;
    profiles: { username: string; display_name: string | null } | null;
    chapters: { id: string; status: string }[];
  } | null;
}

export default async function TranslateHome() {
  const { supabase, user } = await requireUser("/translate");
  const [{ data }, { data: me }, { data: mine }] = await Promise.all([
    supabase
      .from("story_translators")
      .select("story_id, language, status, created_at, stories(id, title, cover_url, language, profiles!stories_author_id_fkey(username, display_name), chapters(id, status))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("translator_languages").eq("id", user.id).single(),
    supabase.from("chapter_translations").select("chapter_id, language, published").eq("translator_id", user.id).eq("kind", "community"),
  ]);
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.stories);
  const progress = (r: Row) => {
    const ids = new Set(r.stories!.chapters.filter((c) => c.status === "published").map((c) => c.id));
    const mineHere = (mine ?? []).filter((t) => t.language === r.language && ids.has(t.chapter_id));
    return { total: ids.size, published: mineHere.filter((t) => t.published).length, drafts: mineHere.filter((t) => !t.published).length };
  };
  const invited = rows.filter((r) => r.status === "invited");
  const approved = rows.filter((r) => r.status === "approved");
  const requested = rows.filter((r) => r.status === "requested");
  const declined = rows.filter((r) => r.status === "declined");
  const writer = (r: Row) => r.stories!.profiles?.display_name || r.stories!.profiles?.username || "the writer";

  const card = (r: Row, right: React.ReactNode, sub?: React.ReactNode) => (
    <li key={`${r.story_id}:${r.language}`} className="flex gap-4 rounded-2xl border border-border bg-surface p-4">
      <Cover url={r.stories!.cover_url} title={r.stories!.title} className="w-14 shrink-0 self-start" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">
          {languageLabel(r.stories!.language)} → {languageLabel(r.language)}
        </p>
        <Link href={`/story/${r.story_id}`} className="mt-0.5 block font-semibold hover:underline">
          {r.stories!.title}
        </Link>
        <p className="text-sm text-muted">by {writer(r)}</p>
        {sub}
        <div className="mt-3">{right}</div>
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-12 sm:pt-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">For translators</p>
      <h1 className="mt-1 font-display text-[38px] leading-tight font-semibold">Translation desk</h1>
      <p className="mt-1 text-muted">
        Bring stories to readers in your language. Find a story you love, tap <b className="text-foreground">Help translate</b> on its page,
        and once the writer approves, translate it here chapter by chapter.
      </p>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Languages className="h-5 w-5 text-accent" /> Languages you translate into
        </h2>
        <p className="mt-1 text-sm text-muted">Shown on your profile and in the translator directory, so writers can find and invite you.</p>
        <TranslatorLanguages initial={me?.translator_languages ?? []} />
        <Link href="/translators" className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <Users className="h-4 w-4" /> Browse the translator directory <ChevronRight className="h-4 w-4" />
        </Link>
      </section>

      {invited.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">Invitations</h2>
          <ul className="mt-3 space-y-3">
            {invited.map((r) => card(r, <TranslatorAnswer storyId={r.story_id} userId={user.id} language={r.language} mode="answer-invite" />, <p className="mt-1 text-sm">{writer(r)} invited you to translate this story.</p>))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold">Your translations</h2>
        {approved.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border-strong p-8 text-center text-muted">
            No stories yet. <Link href="/browse" className="font-medium text-foreground underline">Find a story</Link> and offer to translate it.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {approved.map((r) => {
              const p = progress(r);
              return card(
                r,
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/translate/${r.story_id}/${r.language}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent-strong px-3.5 text-sm font-medium text-white">
                    Open <ChevronRight className="h-4 w-4" />
                  </Link>
                  <TranslatorAnswer storyId={r.story_id} userId={user.id} language={r.language} mode="leave" />
                </div>,
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full bg-accent" style={{ width: `${p.total ? (p.published / p.total) * 100 : 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {p.published} of {p.total} chapters published{p.drafts ? ` · ${p.drafts} in draft` : ""}
                  </p>
                </div>,
              );
            })}
          </ul>
        )}
      </section>

      {(requested.length > 0 || declined.length > 0) && (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">Your requests</h2>
          <ul className="mt-3 space-y-3">
            {requested.map((r) => card(r, <TranslatorAnswer storyId={r.story_id} userId={user.id} language={r.language} mode="withdraw" />, <p className="mt-1 text-sm text-muted">Waiting for the writer to answer.</p>))}
            {declined.map((r) => card(r, <span />, <p className="mt-1 text-sm text-muted">Not this time. The writer declined.</p>))}
          </ul>
        </section>
      )}
    </div>
  );
}
