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

async function genre(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("genres").select("slug, name").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await genre((await params).slug);
  return { title: g ? `${g.name} stories` : "Genre not found" };
}

export default async function GenrePage({ params, searchParams }: Props) {
  const g = await genre((await params).slug);
  if (!g) notFound();
  const raw = await searchParams;
  const filters = parseFilters(raw);
  filters.genres = [g.slug];
  const clean = canonicalHref(`/genre/${g.slug}`, raw, filters, { genres: [g.slug] });
  if (clean) redirect(clean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/browse" className="text-sm text-muted hover:text-foreground">← All stories</Link>
      <h1 className="mt-2 mb-6 font-serif text-3xl">{g.name}</h1>
      <BrowseView path={`/genre/${g.slug}`} filters={filters} locked={{ genre: g.slug }} />
    </div>
  );
}
