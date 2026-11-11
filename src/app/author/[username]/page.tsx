import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, CalendarDays, PenLine, Settings, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StoryCard, formatWords } from "@/components/browse/StoryCard";
import { btn } from "@/components/ui/styles";
import { FollowButton } from "@/components/community/FollowButton";
import { ReportButton } from "@/components/community/ReportButton";
import { ShareButton } from "@/components/community/ShareButton";
import { languageLabel } from "@/lib/translation/languages";

type Params = Promise<{ username: string }>;

async function load(username: string) {
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, created_at, translator_languages")
    .eq("username", username)
    .maybeSingle();
  return profile ? { supabase, profile } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const l = await load((await params).username);
  if (!l) return { title: "Author not found" };
  const name = l.profile.display_name || l.profile.username;
  return {
    title: name,
    description: l.profile.bio?.slice(0, 160) || `${name} on Obsidian Quill.`,
  };
}

export default async function AuthorPage({ params }: { params: Params }) {
  const l = await load((await params).username);
  if (!l) notFound();
  const { supabase, profile } = l;
  const name = profile.display_name || profile.username;

  const [{ data: stories }, { data: me }] = await Promise.all([
    supabase
      .from("stories")
      .select(
        "id, title, cover_url, status, word_count, last_chapter_at, chapters(count)",
      )
      .eq("author_id", profile.id)
      .neq("status", "draft")
      .not("last_chapter_at", "is", null)
      .order("last_chapter_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);
  const list = (stories ?? []) as {
    id: string;
    title: string;
    cover_url: string | null;
    status: string;
    word_count: number;
    chapters: { count: number }[];
  }[];
  const totalWords = list.reduce((a, s) => a + s.word_count, 0);
  const isMe = me.user?.id === profile.id;
  const { data: writer } = await supabase.rpc("is_writer", { uid: profile.id });
  const isWriter = Boolean(writer);
  const translates: string[] = profile.translator_languages ?? [];
  const { data: translating } = await supabase
    .from("story_translators")
    .select("language, stories(id, title, cover_url, status, word_count, profiles!stories_author_id_fkey(username, display_name), chapters(count))")
    .eq("user_id", profile.id)
    .eq("status", "approved");
  const translated = ((translating ?? []) as unknown as {
    language: string;
    stories: {
      id: string;
      title: string;
      cover_url: string | null;
      status: string;
      word_count: number;
      profiles: { username: string; display_name: string | null } | null;
      chapters: { count: number }[];
    } | null;
  }[]).filter((t) => t.stories && t.stories.status !== "draft");
  const [{ data: counts }, { data: follow }] = await Promise.all([
    supabase.rpc("follower_counts", { p_author_id: profile.id }),
    me.user && !isMe
      ? supabase
          .from("follows")
          .select("id")
          .eq("user_id", me.user.id)
          .eq("author_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const followers = (counts as { author: number } | null)?.author ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:pt-10">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(143,107,255,0.22),transparent_50%)]"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-strong to-[#5b3fd6] font-display text-4xl font-semibold text-white ring-4 ring-background">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
              {[isWriter ? "Author" : null, translates.length || translated.length ? "Translator" : null].filter(Boolean).join(" · ") || "Reader"}
            </p>
            <h1 className="font-display text-[38px] leading-tight font-semibold [overflow-wrap:anywhere]">
              {name}
            </h1>
            {profile.display_name && (
              <p className="text-sm text-muted">@{profile.username}</p>
            )}
          </div>
          {isMe ? (
            <Link href="/settings" className={btn.small}>
              <Settings className="h-4 w-4" /> Edit profile
            </Link>
          ) : (
            isWriter && (
              <FollowButton
                authorId={profile.id}
                initial={Boolean(follow)}
                signedIn={Boolean(me.user)}
                loginHref={`/login?next=/author/${profile.username}`}
                className="self-start sm:self-center"
              />
            )
          )}
          {isWriter && (
            <ShareButton path={`/author/${profile.username}`} title={`${name} on Obsidian Quill`} variant="icon" className="self-start sm:self-center" />
          )}
        </div>
        {profile.bio && (
          <p className="relative mt-5 max-w-2xl font-serif text-[17px] leading-relaxed text-foreground/90">
            {profile.bio}
          </p>
        )}
        <div className="relative mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          {isWriter && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> {list.length}{" "}
                {list.length === 1 ? "story" : "stories"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PenLine className="h-4 w-4" /> {formatWords(totalWords)}{" "}
                published
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {followers.toLocaleString()}{" "}
                {followers === 1 ? "follower" : "followers"}
              </span>
            </>
          )}
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" /> Joined{" "}
            {new Date(profile.created_at).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </section>

      {!isWriter ? (
        isMe && (
          <p className="mt-8 rounded-2xl border border-dashed border-border-strong p-8 text-center text-muted">
            This is your reader profile. Want to write?{" "}
            <Link
              href="/studio/new"
              className="font-medium text-foreground underline"
            >
              Start your first story
            </Link>{" "}
            and you can choose a pen name for it.
          </p>
        )
      ) : (
        <>
          <h2 className="mt-10 font-display text-[28px] leading-tight font-semibold">
            Stories
          </h2>
          {list.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-border-strong p-8 text-center text-muted">
              {isMe
                ? "Publish a story and it will appear here."
                : `${name} hasn't published a story yet.`}
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-5 md:grid-cols-5 lg:grid-cols-6">
              {list.map((s) => (
                <li key={s.id}>
                  <StoryCard
                    story={{
                      ...s,
                      author_name: name,
                      chapter_count: s.chapters[0]?.count,
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {(translates.length > 0 || translated.length > 0) && (
        <section className="mt-10">
          <h2 className="font-display text-[28px] leading-tight font-semibold">Translations</h2>
          {translates.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              Translates into {translates.map((l) => languageLabel(l)).join(", ")}.
            </p>
          )}
          {translated.length > 0 ? (
            <ul className="mt-4 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-5 md:grid-cols-5 lg:grid-cols-6">
              {translated.map((t) => (
                <li key={`${t.stories!.id}:${t.language}`}>
                  <StoryCard
                    story={{
                      ...t.stories!,
                      author_name: t.stories!.profiles?.display_name || t.stories!.profiles?.username || "",
                      chapter_count: t.stories!.chapters[0]?.count,
                    }}
                  />
                  <p className="mt-1 text-xs font-medium text-accent">→ {languageLabel(t.language)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{isMe ? "Offer to translate a story from its page and it will show here." : "No translations published yet."}</p>
          )}
        </section>
      )}
      {me.user && !isMe && (
        <div className="mt-12 flex justify-center">
          <ReportButton targetType="profile" targetId={profile.id} />
        </div>
      )}
    </div>
  );
}
