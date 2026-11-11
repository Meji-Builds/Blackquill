import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { StoryForm } from "@/components/studio/StoryForm";
import { BackLink } from "@/components/ui/BackLink";
import { createStory } from "../actions";
import type { Genre } from "@/lib/studio/types";

export const metadata: Metadata = { title: "New story" };

export default async function NewStoryPage() {
  const { supabase } = await requireUser("/studio/new");
  const { data: genres } = await supabase.from("genres").select("id, slug, name").order("name");

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-12">
      <BackLink href="/studio">Studio</BackLink>
      <h1 className="mt-1 mb-8 font-display text-[38px] leading-tight font-semibold">New story</h1>
      <StoryForm action={createStory} genres={(genres ?? []) as Genre[]} submitLabel="Create story" />
    </div>
  );
}
