import type { Metadata } from "next";
import Link from "next/link";
import { Flag, Images, Search, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { ReportCard, type QueueItem } from "@/components/admin/ReportCard";
import { FeaturedToggle } from "@/components/admin/FeaturedToggle";
import { Cover } from "@/components/Cover";
import { input } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Moderation", robots: { index: false } };

type Search = Promise<{ tab?: string; q?: string }>;
const TABS = [
  { id: "open", label: "Open reports", icon: Flag },
  { id: "resolved", label: "Resolved", icon: ShieldCheck },
  { id: "featured", label: "Featured stories", icon: Images },
] as const;

export default async function AdminPage({ searchParams }: { searchParams: Search }) {
  const { supabase } = await requireAdmin("/admin");
  const { tab: tabParam, q } = await searchParams;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "open";

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-12 sm:pt-10">
      <h1 className="font-display text-[38px] leading-tight font-semibold">Moderation</h1>
      <p className="mt-1 text-sm text-muted">Reports from readers, takedowns and stories featured for comic panels.</p>
      <nav aria-label="Sections" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium ${tab === t.id ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{tab === "featured" ? <Featured q={q} supabase={supabase} /> : <Queue status={tab} supabase={supabase} />}</div>
    </div>
  );
}

type Client = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

async function Queue({ status, supabase }: { status: "open" | "resolved"; supabase: Client }) {
  const results = await Promise.all(
    (status === "open" ? ["open"] : ["actioned", "dismissed"]).map((s) => supabase.rpc("moderation_queue", { p_status: s })),
  );
  const error = results.find((r) => r.error)?.error;
  if (error) throw new Error(error.message);
  const items = results.flatMap((r) => (r.data ?? []) as QueueItem[]);
  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border-strong px-6 py-12 text-center text-muted">
        {status === "open" ? "No open reports. All clear." : "Nothing resolved yet."}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((it) => (
        <ReportCard key={`${it.target_type}:${it.target_id}`} item={it} resolved={status === "resolved"} />
      ))}
    </div>
  );
}

async function Featured({ q, supabase }: { q?: string; supabase: Client }) {
  const { data: enabled } = await supabase
    .from("comic_enabled_stories")
    .select("regen_cap_per_chapter, stories(id, title, cover_url, profiles!stories_author_id_fkey(display_name, username))");
  const featured = (enabled ?? []) as unknown as {
    regen_cap_per_chapter: number;
    stories: { id: string; title: string; cover_url: string | null; profiles: { display_name: string | null; username: string } | null } | null;
  }[];
  const ids = new Set(featured.map((f) => f.stories?.id));
  const { data: found } = q?.trim()
    ? await supabase.rpc("search_stories", { p_query: q.trim(), p_limit: 10, p_include_mature: true })
    : { data: null };
  const results = ((found ?? []) as { id: string; title: string; cover_url: string | null; author_name: string }[]).filter((s) => !ids.has(s.id));

  const row = (s: { id: string; title: string; cover_url: string | null }, author: string, toggle: React.ReactNode) => (
    <li key={s.id} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-3">
      <Cover url={s.cover_url} title={s.title} className="w-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <Link href={`/story/${s.id}`} className="font-medium hover:underline">{s.title}</Link>
        <p className="text-sm text-muted">{author}</p>
        <div className="mt-2">{toggle}</div>
      </div>
    </li>
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-semibold">Featured for comic panels</h2>
        <p className="mt-0.5 text-sm text-muted">Writers of these stories can turn chapters into comic panels, up to the limit per chapter.</p>
        {featured.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No featured stories yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {featured.flatMap((f) =>
              f.stories
                ? [row(f.stories, f.stories.profiles?.display_name || f.stories.profiles?.username || "", <FeaturedToggle storyId={f.stories.id} enabled cap={f.regen_cap_per_chapter} />)]
                : [],
            )}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-semibold">Feature another story</h2>
        <form className="mt-3 flex gap-2" action="/admin">
          <input type="hidden" name="tab" value="featured" />
          <input name="q" defaultValue={q} placeholder="Search by title" aria-label="Search stories" className={input} />
          <button className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-accent-strong px-4 text-sm font-medium text-white">
            <Search className="h-4 w-4" /> Search
          </button>
        </form>
        {q && (
          <ul className="mt-4 space-y-3">
            {results.length === 0 ? <li className="text-sm text-muted">No matching stories.</li> : results.map((s) => row(s, s.author_name, <FeaturedToggle storyId={s.id} enabled={false} cap={6} />))}
          </ul>
        )}
      </section>
    </div>
  );
}
