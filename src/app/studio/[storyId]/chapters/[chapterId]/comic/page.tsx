import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ComicStudio, type StudioPanel } from "@/components/comics/ComicStudio";
import { comicProvider } from "@/lib/comics/providers";

export const metadata: Metadata = { title: "Comic panels" };
// Image generation can take up to a minute per panel with a real image model.
export const maxDuration = 60;

type Params = Promise<{ storyId: string; chapterId: string }>;

export default async function ComicPage({ params }: { params: Params }) {
  const { storyId, chapterId } = await params;
  const { supabase, user } = await requireUser(`/studio/${storyId}/chapters/${chapterId}/comic`);
  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, number, title, story_id, stories!inner(title, author_id)")
    .eq("id", chapterId)
    .eq("story_id", storyId)
    .maybeSingle();
  const story = chapter?.stories as unknown as { title: string; author_id: string } | undefined;
  if (!chapter || story?.author_id !== user.id) notFound();

  const [{ data: panels }, { data: budget }] = await Promise.all([
    supabase
      .from("comic_panels")
      .select("id, scene_index, prompt, caption, style, image_url, status, error, reference_image_url")
      .eq("chapter_id", chapterId)
      .order("scene_index"),
    supabase.rpc("comic_budget", { p_chapter_id: chapterId }),
  ]);

  return (
    <ComicStudio
      storyId={storyId}
      chapter={{ id: chapter.id, number: chapter.number, title: chapter.title, storyTitle: story.title }}
      panels={(panels ?? []) as StudioPanel[]}
      budget={(budget as { enabled: boolean; cap: number; used: number } | null) ?? { enabled: false, cap: 0, used: 0 }}
      provider={comicProvider()}
    />
  );
}
