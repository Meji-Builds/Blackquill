import type { MetadataRoute } from "next";
import { publicClient, siteUrl } from "@/lib/seo/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = ["", "/browse", "/rankings", "/guidelines"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "daily",
    priority: p === "" ? 1 : 0.6,
  }));
  const supabase = publicClient();
  if (!supabase) return pages;

  const [{ data: stories }, { data: genres }] = await Promise.all([
    supabase
      .from("stories")
      .select("id, last_chapter_at, profiles!stories_author_id_fkey(username), chapters(number, published_at)")
      .neq("status", "draft")
      .neq("rating", "mature")
      .not("last_chapter_at", "is", null)
      .eq("chapters.status", "published")
      .order("last_chapter_at", { ascending: false })
      .limit(2000),
    supabase.from("genres").select("slug"),
  ]);
  const authors = new Set<string>();
  for (const s of (stories ?? []) as unknown as {
    id: string;
    last_chapter_at: string;
    profiles: { username: string } | null;
    chapters: { number: number; published_at: string | null }[];
  }[]) {
    pages.push({ url: `${base}/story/${s.id}`, lastModified: s.last_chapter_at, changeFrequency: "weekly", priority: 0.8 });
    for (const c of s.chapters) {
      pages.push({ url: `${base}/story/${s.id}/chapter/${c.number}`, lastModified: c.published_at ?? undefined, priority: 0.5 });
    }
    if (s.profiles) authors.add(s.profiles.username);
  }
  for (const a of authors) pages.push({ url: `${base}/author/${a}`, changeFrequency: "weekly", priority: 0.4 });
  for (const g of genres ?? []) pages.push({ url: `${base}/genre/${g.slug}`, changeFrequency: "daily", priority: 0.5 });
  return pages;
}
