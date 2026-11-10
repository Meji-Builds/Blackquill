import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ChapterEditor } from "@/components/studio/ChapterEditor";
import type { ChapterRow } from "@/lib/studio/types";

type Params = Promise<{ storyId: string; chapterId: string }>;

export const metadata: Metadata = { title: "Edit chapter" };

export default async function ChapterEditorPage({ params }: { params: Params }) {
  const { storyId, chapterId } = await params;
  const { supabase, user } = await requireUser(`/studio/${storyId}/chapters/${chapterId}`);

  const { data } = await supabase
    .from("chapters")
    .select("*, stories!inner(id, title, author_id, status)")
    .eq("id", chapterId)
    .eq("story_id", storyId)
    .maybeSingle();
  const story = data?.stories as unknown as { id: string; title: string; author_id: string; status: string } | undefined;
  if (!data || !story || story.author_id !== user.id) notFound();

  const { stories: _omit, ...chapter } = data;
  void _omit;

  return <ChapterEditor chapter={chapter as ChapterRow} storyTitle={story.title} storyStatus={story.status} />;
}
