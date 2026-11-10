import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChapterReader } from "@/components/reader/ChapterReader";
import { toParagraphs } from "@/lib/reader/text";

type Params = Promise<{ storyId: string; number: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(storyId: string, numberParam: string) {
  const number = Number(numberParam);
  if (!UUID.test(storyId) || !Number.isInteger(number) || number < 1) return null;
  const supabase = await createClient();
  const [{ data: story }, { data: chapter }] = await Promise.all([
    supabase.from("stories").select("id, title, status").eq("id", storyId).neq("status", "draft").maybeSingle(),
    supabase
      .from("chapters")
      .select("id, number, title, body, word_count")
      .eq("story_id", storyId)
      .eq("number", number)
      .eq("status", "published")
      .maybeSingle(),
  ]);
  if (!story || !chapter) return null;
  return { supabase, story, chapter };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { storyId, number } = await params;
  const l = await load(storyId, number);
  if (!l) return { title: "Chapter not found" };
  return { title: `${l.chapter.title || `Chapter ${l.chapter.number}`} · ${l.story.title}` };
}

export default async function ChapterPage({ params }: { params: Params }) {
  const { storyId, number } = await params;
  const l = await load(storyId, number);
  if (!l) notFound();
  const { supabase, story, chapter } = l;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Neighbours by number among published chapters (numbers can skip over drafts).
  const [{ data: prev }, { data: next }, progressRes] = await Promise.all([
    supabase
      .from("chapters")
      .select("number")
      .eq("story_id", storyId)
      .eq("status", "published")
      .lt("number", chapter.number)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("chapters")
      .select("number")
      .eq("story_id", storyId)
      .eq("status", "published")
      .gt("number", chapter.number)
      .order("number")
      .limit(1)
      .maybeSingle(),
    user
      ? supabase
          .from("reading_progress")
          .select("chapter_id, scroll_position")
          .eq("user_id", user.id)
          .eq("story_id", storyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const progress = progressRes.data;
  return (
    <ChapterReader
      key={chapter.id}
      storyId={story.id}
      storyTitle={story.title}
      chapterId={chapter.id}
      number={chapter.number}
      title={chapter.title}
      paragraphs={toParagraphs(chapter.body)}
      wordCount={chapter.word_count}
      prevNumber={prev?.number ?? null}
      nextNumber={next?.number ?? null}
      signedIn={Boolean(user)}
      initialScroll={progress && progress.chapter_id === chapter.id ? progress.scroll_position : 0}
    />
  );
}
