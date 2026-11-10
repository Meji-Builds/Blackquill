import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Cover } from "@/components/Cover";
import { StatusBadge } from "@/components/studio/StatusBadge";
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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Writer Studio</h1>
          <p className="mt-1 text-sm text-muted">Your stories, drafts and schedule.</p>
        </div>
        <Link href="/studio/new" className="rounded-md bg-accent-strong px-4 py-2 font-medium text-white hover:bg-accent">
          New story
        </Link>
      </div>

      {stories.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-border p-10 text-center">
          <p className="font-serif text-xl">No stories yet.</p>
          <p className="mt-2 text-sm text-muted">
            Start one now. It stays a private draft until you publish it, and its first week on the Fresh Shelf
            starts then.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {stories.map((s) => (
            <li key={s.id}>
              <Link
                href={`/studio/${s.id}`}
                className="flex gap-4 rounded-lg border border-border bg-surface p-4 hover:border-accent/50"
              >
                <Cover url={s.cover_url} title={s.title} className="w-20 shrink-0" />
                <div className="min-w-0">
                  <h2 className="truncate font-serif text-lg">{s.title}</h2>
                  <div className="mt-1">
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {plural(s.chapters[0]?.count ?? 0, "chapter")} · {plural(s.word_count, "published word")}
                  </p>
                  <p className="text-xs text-muted">Edited {new Date(s.updated_at).toLocaleDateString()}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
