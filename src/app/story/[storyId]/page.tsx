import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { ShelfButton, type ShelfOption } from "@/components/reader/ShelfButton";
import { OfflineButton } from "@/components/reader/OfflineButton";
import { Expandable } from "@/components/reader/Expandable";
import { ChapterIndex } from "@/components/reader/ChapterIndex";
import { FollowButton } from "@/components/community/FollowButton";
import { ReportButton } from "@/components/community/ReportButton";
import { ShareButton } from "@/components/community/ShareButton";
import { Avatar } from "@/components/Avatar";
import { HelpTranslate, type MyTranslatorRow } from "@/components/translation/HelpTranslate";
import { languageLabel } from "@/lib/translation/languages";
import { machineTranslationReady } from "@/lib/translation/providers";
import { MatureGate } from "@/components/community/MatureGate";
import { needsMatureGate } from "@/lib/moderation/mature";
import { getViewer } from "@/components/SiteHeader";
import { RemovedNotice } from "@/components/community/RemovedNotice";
import { btn } from "@/components/ui/styles";
import { Languages, BookOpen, BookmarkPlus, CalendarDays, Clock, ListOrdered } from "lucide-react";
import { readingMinutes } from "@/lib/reader/text";

type Params = Promise<{ storyId: string }>;

interface StoryLanguages {
  original: string;
  machine: boolean;
  community: boolean;
  chapters: number;
  translations: { language: string; chapters: number; translators: string[] | null }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadStory(storyId: string) {
  if (!UUID.test(storyId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("stories")
    .select(
      "id, title, synopsis, cover_url, status, rating, removed_at, removed_reason, word_count, last_chapter_at, author_id, profiles!stories_author_id_fkey(username, display_name, avatar_url), story_genres(genres(slug, name)), story_tags(tags(slug, name))",
    )
    .eq("id", storyId)
    .neq("status", "draft")
    .maybeSingle();
  return data ? { supabase, story: data } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { storyId } = await params;
  const loaded = await loadStory(storyId);
  if (!loaded) return { title: "Story not found" };
  const { story } = loaded;
  const author = story.profiles as unknown as { username: string; display_name: string | null; avatar_url: string | null } | null;
  const description = story.rating === "mature" ? "A mature story on Obsidian Quill." : story.synopsis.slice(0, 160);
  return {
    title: story.title,
    description,
    alternates: { canonical: `/story/${story.id}` },
    robots: story.rating === "mature" || story.removed_at ? { index: false } : undefined,
    openGraph: {
      type: "book",
      title: story.title,
      description,
      authors: author ? [author.display_name || author.username] : undefined,
    },
  };
}

export default async function StoryPage({ params }: { params: Params }) {
  const { storyId } = await params;
  const loaded = await loadStory(storyId);
  if (!loaded) notFound();
  const { supabase, story } = loaded;

  const author = story.profiles as unknown as { username: string; display_name: string | null; avatar_url: string | null } | null;
  const genres = (story.story_genres as unknown as { genres: { slug: string; name: string } | null }[]).flatMap((g) =>
    g.genres ? [g.genres] : [],
  );
  const tags = (story.story_tags as unknown as { tags: { slug: string; name: string } | null }[]).flatMap((t) =>
    t.tags ? [t.tags] : [],
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewer = await getViewer();
  if (await needsMatureGate(story, user && viewer ? { id: user.id, showMature: viewer.showMature } : null)) {
    return <MatureGate title={story.title} signedIn={Boolean(user)} />;
  }

  const [{ data: chapters }, progressRes, shelvesRes, followRes, countsRes, langsRes, mineRes, meRes] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, number, title, word_count, published_at, choice_points(id)")
      .eq("story_id", story.id)
      .eq("status", "published")
      .order("number"),
    user
      ? supabase
          .from("reading_progress")
          .select("chapter_id")
          .eq("user_id", user.id)
          .eq("story_id", story.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("shelves")
          .select("id, name, kind, position, shelf_items(story_id)")
          .eq("user_id", user.id)
          .eq("shelf_items.story_id", story.id)
          .order("position")
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("follows").select("id").eq("user_id", user.id).eq("story_id", story.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("follower_counts", { p_story_id: story.id }),
    supabase.rpc("story_languages", { p_story_id: story.id }),
    user
      ? supabase.from("story_translators").select("language, status").eq("story_id", story.id).eq("user_id", user.id)
      : Promise.resolve({ data: null }),
    user ? supabase.from("profiles").select("translator_languages").eq("id", user.id).single() : Promise.resolve({ data: null }),
  ]);
  const langs = langsRes.data as StoryLanguages | null;
  const machineReady = machineTranslationReady();
  const followers = ((countsRes.data as { story: number } | null)?.story ?? 0) as number;
  const list = chapters ?? [];
  const resume = progressRes.data ? list.find((c) => c.id === progressRes.data!.chapter_id) : undefined;
  const first = list[0];
  const shelves: ShelfOption[] | null = shelvesRes.data
    ? (shelvesRes.data as { id: string; name: string; kind: string; shelf_items: unknown[] }[]).map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        on: s.shelf_items.length > 0,
      }))
    : null;

  const authorName = author ? author.display_name || author.username : null;
  const readHref = resume
    ? `/story/${story.id}/chapter/${resume.number}`
    : first
      ? `/story/${story.id}/chapter/${first.number}`
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-12 sm:pt-10">
      {story.removed_at && <RemovedNotice reason={story.removed_reason} />}
      <div className="grid grid-cols-[112px_1fr] gap-x-5 gap-y-6 sm:grid-cols-[220px_1fr] sm:gap-x-10">
        <Cover url={story.cover_url} title={story.title} author={authorName} className="w-full self-start sm:row-span-2" />

        <div className="min-w-0 self-center sm:self-start">
          {genres[0] && (
            <Link href={`/genre/${genres[0].slug}`} className="text-xs font-semibold tracking-[0.18em] text-gold uppercase hover:underline">
              {genres[0].name}
            </Link>
          )}
          <h1 className="mt-1 font-display text-[30px] leading-[1.05] font-semibold sm:text-[46px]">{story.title}</h1>
          {author && (
            <Link href={`/author/${author.username}`} className="mt-2 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground sm:text-base">
              <Avatar url={author.avatar_url} name={authorName ?? author.username} seed={author.username} size={28} />
              <span>
                by <span className="font-medium text-foreground">{authorName}</span>
              </span>
            </Link>
          )}
          <div className="mt-3">
            <ShareButton
              path={`/story/${story.id}`}
              title={story.title}
              text={authorName ? `by ${authorName} on Obsidian Quill` : "on Obsidian Quill"}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-3.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
            />
          </div>
          <div className="mt-3 hidden flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted sm:flex">
            <Stats story={story} chapters={list.length} />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 sm:col-start-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted sm:hidden">
            <Stats story={story} chapters={list.length} />
          </div>

          <div className="mt-5 grid gap-2 sm:mt-0 sm:flex sm:flex-wrap">
            {readHref ? (
              <Link href={readHref} className={`${btn.primary} w-full sm:w-auto`}>
                <BookOpen className="h-4 w-4" />
                {resume ? `Continue · Chapter ${resume.number}` : "Start reading"}
              </Link>
            ) : (
              <span className={`${btn.secondary} pointer-events-none w-full text-muted sm:w-auto`}>No chapters yet</span>
            )}
            <div className="grid grid-cols-3 gap-2 sm:flex">
              {shelves ? (
                <ShelfButton storyId={story.id} shelves={shelves} />
              ) : (
                <Link href={`/login?next=/story/${story.id}`} className={btn.secondary}>
                  <BookmarkPlus className="h-4 w-4" /> Library
                </Link>
              )}
              <FollowButton
                storyId={story.id}
                initial={Boolean(followRes.data)}
                signedIn={Boolean(user)}
                loginHref={`/login?next=/story/${story.id}`}
                count={followers}
              />
              <OfflineButton storyId={story.id} title={story.title} coverUrl={story.cover_url} chapters={list.map((c) => c.number)} />
            </div>
          </div>

          {story.synopsis && (
            <div className="mt-6 font-serif text-[17px] leading-relaxed text-foreground/90">
              <Expandable lines={5}>
                {(story.synopsis as string).split(/\n\s*\n/).map((p: string, i: number) => (
                  <p key={i}>{p}</p>
                ))}
              </Expandable>
            </div>
          )}

          {(genres.length > 0 || tags.length > 0) && (
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {genres.map((g) => (
                <Link key={g.slug} href={`/genre/${g.slug}`} className="rounded-full bg-accent/12 px-3 py-1.5 font-medium text-accent ring-1 ring-accent/25 hover:bg-accent/20">
                  {g.name}
                </Link>
              ))}
              {tags.map((t) => (
                <Link key={t.slug} href={`/tag/${t.slug}`} className="rounded-full px-3 py-1.5 text-muted ring-1 ring-border-strong hover:text-foreground">
                  #{t.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {langs && (langs.translations.length > 0 || (langs.machine && machineReady) || langs.community) && (
        <section id="translate" aria-labelledby="languages-heading" className="mt-10 scroll-mt-20 rounded-2xl border border-border bg-surface p-5">
          <h2 id="languages-heading" className="flex items-center gap-2 font-semibold">
            <Languages className="h-5 w-5 text-accent" /> Languages
          </h2>
          <p className="mt-1 text-sm text-muted">
            Written in <span className="text-foreground">{languageLabel(langs.original)}</span>.
            {langs.machine && machineReady && " Readers can also machine-translate any chapter into their own language: tap the language button in the reader."}
          </p>
          {langs.translations.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {langs.translations.map((t) => (
                <li key={t.language}>
                  <Link
                    href={`/story/${story.id}/chapter/${list[0]?.number ?? 1}?lang=${t.language}`}
                    className="inline-flex flex-col rounded-xl border border-border-strong px-3.5 py-2 text-sm hover:bg-surface-2"
                  >
                    <span className="font-medium">{languageLabel(t.language)}</span>
                    <span className="text-xs text-muted">
                      {t.chapters} of {langs.chapters} chapters{t.translators?.length ? ` · by ${t.translators.join(", ")}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {langs.community && user?.id !== story.author_id && (
            <div className="mt-4">
              <HelpTranslate
                storyId={story.id}
                storyTitle={story.title}
                original={langs.original}
                signedIn={Boolean(user)}
                mine={(mineRes.data ?? []) as MyTranslatorRow[]}
                myLanguages={(meRes.data as { translator_languages: string[] } | null)?.translator_languages ?? []}
              />
            </div>
          )}
        </section>
      )}

      <div className="mt-12">
        <ChapterIndex
          storyId={story.id}
          currentId={resume?.id}
          chapters={list.map((c) => ({
            id: c.id,
            number: c.number,
            title: c.title,
            published_at: c.published_at,
            hasChoice: Boolean(c.choice_points as unknown as { id: string } | null),
          }))}
        />
      </div>
      {user && user.id !== story.author_id && (
        <div className="mt-10 flex justify-center">
          <ReportButton targetType="story" targetId={story.id} />
        </div>
      )}
    </div>
  );
}

function Stats({
  story,
  chapters,
}: {
  story: { status: string; rating: string; word_count: number; last_chapter_at: string | null };
  chapters: number;
}) {
  const item = "inline-flex items-center gap-1.5";
  return (
    <>
      <span className={item}>
        <span className={`h-2 w-2 rounded-full ${story.status === "completed" ? "bg-accent" : story.status === "hiatus" ? "bg-warning" : "bg-success"}`} />
        {story.status === "completed" ? "Complete" : story.status === "hiatus" ? "On hiatus" : "Ongoing"}
      </span>
      <span className={item}>
        <ListOrdered className="h-4 w-4" /> {chapters} {chapters === 1 ? "chapter" : "chapters"}
      </span>
      <span className={item}>
        <Clock className="h-4 w-4" /> {readingMinutes(story.word_count) >= 60
          ? `${Math.round(readingMinutes(story.word_count) / 60)} h read`
          : `${readingMinutes(story.word_count)} min read`}
      </span>
      {story.rating !== "everyone" && (
        <span className={`${item} rounded-full px-2 py-0.5 text-xs capitalize ring-1 ring-border-strong`}>{story.rating}</span>
      )}
      {story.last_chapter_at && (
        <span className={item}>
          <CalendarDays className="h-4 w-4" /> Updated {new Date(story.last_chapter_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      )}
    </>
  );
}

