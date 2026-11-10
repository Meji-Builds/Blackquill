import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { StoryForm } from "@/components/studio/StoryForm";
import { createStory } from "../actions";
import type { Genre } from "@/lib/studio/types";

export const metadata: Metadata = { title: "New story" };

export default async function NewStoryPage() {
  const { supabase } = await requireUser("/studio/new");
  const { data: genres } = await supabase.from("genres").select("id, slug, name").order("name");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/studio" className="text-sm text-muted hover:text-foreground">
        ← Studio
      </Link>
      <h1 className="mt-2 mb-8 font-serif text-3xl">New story</h1>
      <StoryForm action={createStory} genres={(genres ?? []) as Genre[]} submitLabel="Create story" />
    </div>
  );
}
