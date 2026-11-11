import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrowseView } from "@/components/browse/BrowseView";
import { canonicalHref, parseFilters } from "@/lib/browse/params";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { q } = parseFilters(await searchParams);
  return { title: q ? `Search: ${q}` : "Browse" };
}

export default async function BrowsePage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const clean = canonicalHref("/browse", raw, filters);
  if (clean) redirect(clean);
  const supabase = await createClient();
  const { data: tags } = await supabase.rpc("popular_tags", { p_limit: 20 });

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:pt-10">
      <h1 className="mb-6 font-display text-[38px] leading-tight font-semibold">{filters.q ? `Results for “${filters.q}”` : "Browse stories"}</h1>
      <BrowseView path="/browse" filters={filters} />
      {(tags ?? []).length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold">Popular tags</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(tags as { slug: string; name: string; uses: number }[]).map((t) => (
              <Link key={t.slug} href={`/tag/${t.slug}`} className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:text-foreground">
                #{t.name} <span className="text-xs">{t.uses}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
