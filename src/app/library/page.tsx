import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Cover } from "@/components/Cover";
import { ShelfManager } from "@/components/reader/ShelfManager";
import { RemoveFromShelf } from "@/components/reader/RemoveFromShelf";
import { btn } from "@/components/ui/styles";
import { Download } from "lucide-react";

export const metadata: Metadata = { title: "Library" };

type SearchParams = Promise<{ shelf?: string }>;

interface ShelfRow {
  id: string;
  name: string;
  kind: string;
  shelf_items: { added_at: string; stories: StoryLite | null }[];
}
interface StoryLite {
  id: string;
  title: string;
  cover_url: string | null;
  status: string;
  last_chapter_at: string | null;
}

export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, user } = await requireUser("/library");
  const { shelf: shelfParam } = await searchParams;

  const [{ data: shelvesData }, { data: progressData }] = await Promise.all([
    supabase
      .from("shelves")
      .select("id, name, kind, shelf_items(added_at, stories(id, title, cover_url, status, last_chapter_at))")
      .eq("user_id", user.id)
      .order("position")
      .order("created_at"),
    supabase.from("reading_progress").select("story_id, chapters(number)").eq("user_id", user.id),
  ]);
  const shelves = (shelvesData ?? []) as unknown as ShelfRow[];
  const active = shelves.find((s) => s.id === shelfParam) ?? shelves[0];
  const progress = new Map(
    (progressData ?? []).map((p) => [p.story_id, (p.chapters as unknown as { number: number } | null)?.number]),
  );

  const items = (active?.shelf_items ?? [])
    .filter((i) => i.stories) // drafts or removed stories drop out via RLS
    .sort((a, b) => b.added_at.localeCompare(a.added_at));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-[38px] leading-tight font-semibold">Your Library</h1>
        <Link href="/offline" className={btn.small}>
          <Download className="h-4 w-4" /> Downloaded
        </Link>
      </div>

      <div className="mt-6 flex items-center justify-end">
        <ShelfManager active={active ? { id: active.id, name: active.name, custom: active.kind === "custom" } : null} />
      </div>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto border-b border-border px-4 pb-4 [scrollbar-width:none]">
        {shelves.map((s) => (
          <Link
            key={s.id}
            href={`/library?shelf=${s.id}`}
            aria-current={s.id === active?.id ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm whitespace-nowrap ring-1 transition ${
              s.id === active?.id ? "bg-accent/15 text-foreground ring-accent/50" : "text-muted ring-border-strong hover:text-foreground"
            }`}
          >
            {s.name} <span className="text-muted">{s.shelf_items.filter((i) => i.stories).length}</span>
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border p-8 text-center text-muted">
          Nothing on this shelf yet. Use <span className="text-foreground">Add to library</span> on any story page.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-5 md:grid-cols-5">
          {items.map(({ stories: s }) => {
            const ch = progress.get(s!.id);
            return (
              <li key={s!.id} className="group relative">
                <Link href={ch ? `/story/${s!.id}/chapter/${ch}` : `/story/${s!.id}`}>
                  <Cover url={s!.cover_url} title={s!.title} className="w-full transition group-hover:opacity-90" />
                  <p className="mt-2 line-clamp-2 font-serif leading-snug">{s!.title}</p>
                  <p className="text-xs text-muted">{ch ? `Continue chapter ${ch}` : "Not started"}</p>
                </Link>
                {active && <RemoveFromShelf shelfId={active.id} storyId={s!.id} title={s!.title} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
