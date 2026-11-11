import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Cover } from "@/components/Cover";
import { StatusBadge } from "@/components/studio/StatusBadge";
import { btn } from "@/components/ui/styles";
import { Feather, Plus } from "lucide-react";
import type { StoryRow } from "@/lib/studio/types";

function plural(n: number, word: string) {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

export const metadata: Metadata = { title: "Writer Studio" };

export default async function StudioPage() {
  const { supabase, user } = await requireUser("/studio");
  const { data } = await supabase
    .from("stories")
    .select("id, title, cover_url, status, word_count, updated_at, chapters(count)")
    .eq("author_id", user.id)
    .order("updated_at", { ascending: false });
  const stories = (data ?? []) as (Pick<StoryRow, "id" | "title" | "cover_url" | "status" | "word_count" | "updated_at"> & {
    chapters: { count: number }[];
  })[];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Writer studio</p>
          <h1 className="mt-1 font-display text-[38px] leading-tight font-semibold">Your stories</h1>
        </div>
        <Link href="/studio/new" className={btn.primary}>
          <Plus className="h-4 w-4" /> New story
        </Link>
      </div>

      {stories.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border-strong bg-surface/60 p-10 text-center">
          <Feather className="mx-auto h-10 w-10 text-accent" strokeWidth={1.5} />
          <p className="mt-4 font-display text-3xl font-semibold">Your first story starts here.</p>
          <p className="mx-auto mt-2 max-w-md text-muted">
            It stays a private draft until you publish it. Its first week on the Fresh Shelf starts then.
          </p>
          <Link href="/studio/new" className={`${btn.primary} mt-6`}>
            <Plus className="h-4 w-4" /> Start a story
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {stories.map((s) => (
            <li key={s.id}>
              <Link
                href={`/studio/${s.id}`}
                className="group flex gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/50 hover:bg-surface-2"
              >
                <Cover url={s.cover_url} title={s.title} className="w-20 shrink-0" />
                <div className="flex min-w-0 flex-col">
                  <h2 className="line-clamp-2 font-serif text-lg leading-snug font-semibold group-hover:text-accent">{s.title}</h2>
                  <div className="mt-2">
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-auto pt-3 text-sm text-muted">
                    {plural(s.chapters[0]?.count ?? 0, "chapter")} · {plural(s.word_count, "published word")}
                  </p>
                  <p className="text-xs text-muted/80">Edited {new Date(s.updated_at).toLocaleDateString()}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
