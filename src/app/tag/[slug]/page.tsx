import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrowseView } from "@/components/browse/BrowseView";
import { canonicalHref, parseFilters } from "@/lib/browse/params";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function tag(slug: string) {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("slug, name").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await tag((await params).slug);
  return { title: t ? `#${t.name}` : "Tag not found" };
}

export default async function TagPage({ params, searchParams }: Props) {
  const t = await tag((await params).slug);
  if (!t) notFound();
  const raw = await searchParams;
  const filters = parseFilters(raw);
  filters.tags = [t.slug, ...filters.tags.filter((x) => x !== t.slug)];
  const clean = canonicalHref(`/tag/${t.slug}`, raw, filters, { tags: [t.slug] });
  if (clean) redirect(clean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/browse" className="text-sm text-muted hover:text-foreground">← All stories</Link>
      <h1 className="mt-2 mb-6 font-serif text-3xl">#{t.name}</h1>
      <BrowseView path={`/tag/${t.slug}`} filters={filters} locked={{ tag: t.slug }} />
    </div>
  );
}
