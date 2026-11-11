import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { StoryForm } from "@/components/studio/StoryForm";
import { BackLink } from "@/components/ui/BackLink";
import { createStory } from "../actions";
import type { Genre } from "@/lib/studio/types";

export const metadata: Metadata = { title: "New story" };

export default async function NewStoryPage() {
  const { supabase, user } = await requireUser("/studio/new");
  const [{ data: genres }, { count }, { data: profile }] = await Promise.all([
    supabase.from("genres").select("id, slug, name").order("name"),
    supabase.from("stories").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("profiles").select("username, display_name").eq("id", user.id).single(),
  ]);
  const firstStory = (count ?? 0) === 0 && profile && !profile.display_name;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-12">
      <BackLink href="/studio">Studio</BackLink>
      <h1 className="mt-1 mb-8 font-display text-[38px] leading-tight font-semibold">New story</h1>
      <StoryForm action={createStory} genres={(genres ?? []) as Genre[]} submitLabel="Create story"
        penName={firstStory ? { username: profile.username } : undefined}
      />
    </div>
  );
}
