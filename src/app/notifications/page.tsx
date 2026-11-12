import type { Metadata } from "next";
import Link from "next/link";
import { languageLabel } from "@/lib/translation/languages";
import { Languages, BellOff, BookOpen, Heart, MessageCircle, Reply, Settings, UserPlus } from "lucide-react";
import { notificationHref, type NotificationKind } from "@/lib/notifications/text";
import { PushSettings } from "@/components/settings/PushSettings";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/community/types";
import { MarkRead } from "@/components/community/MarkRead";
import { Avatar } from "@/components/Avatar";

export const metadata: Metadata = { title: "Notifications" };

interface Row {
  id: string;
  kind: NotificationKind;
  language: string | null;
  read_at: string | null;
  created_at: string;
  story_id: string | null;
  actor: { username: string; display_name: string | null; avatar_url: string | null } | null;
  stories: { id: string; title: string } | null;
  chapters: { number: number; title: string } | null;
  comments: { body: string } | null;
}

function describe(n: Row) {
  const who = n.actor ? n.actor.display_name || n.actor.username : "Someone";
  const story = n.stories?.title ?? "a story";
  const chapter = n.chapters ? `Chapter ${n.chapters.number}${n.chapters.title ? `: ${n.chapters.title}` : ""}` : "";
  const lang = n.language ? languageLabel(n.language) : "another language";
  const href = notificationHref({
    kind: n.kind,
    storyId: n.stories?.id ?? null,
    chapterNumber: n.chapters?.number ?? null,
    actorUsername: n.actor?.username ?? null,
    language: n.language,
  });
  switch (n.kind) {
    case "new_chapter":
      return { icon: BookOpen, href, text: <><b>{story}</b> has a new chapter: {chapter}</> };
    case "comment_reply":
      return { icon: Reply, href, text: <><b>{who}</b> replied to your comment on <b>{story}</b></> };
    case "story_comment":
      return { icon: MessageCircle, href, text: <><b>{who}</b> commented on {chapter || "a chapter"} of <b>{story}</b></> };
    case "translator_request":
      return {
        icon: Languages,
        href,
        text: <><b>{who}</b> offered to translate <b>{story}</b> into {lang}</>,
      };
    case "translator_invite":
      return { icon: Languages, href, text: <><b>{who}</b> invited you to translate <b>{story}</b> into {lang}</> };
    case "translator_approved":
      return {
        icon: Languages,
        href,
        text: <><b>{who}</b> said yes: <b>{story}</b> can be translated into {lang}</>,
      };
    case "translator_declined":
      return { icon: Languages, href, text: <><b>{who}</b> declined translating <b>{story}</b> into {lang}</> };
    case "chapter_like":
      return { icon: Heart, href, text: <><b>{who}</b> liked {chapter || "a chapter"} of <b>{story}</b></> };
    case "comment_like":
      return { icon: Heart, href, text: <><b>{who}</b> liked your comment on <b>{story}</b></> };
    case "new_follower":
      return {
        icon: UserPlus,
        href,
        text: n.story_id ? <><b>{who}</b> followed <b>{story}</b></> : <><b>{who}</b> started following you</>,
      };
  }
}

export default async function NotificationsPage() {
  const { supabase, user } = await requireUser("/notifications");
  const { data } = await supabase
    .from("notifications")
    .select(
      "id, kind, read_at, created_at, story_id, language, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url), stories(id, title), chapters(number, title), comments(body)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as Row[];
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-12 sm:pt-10">
      <h1 className="font-display text-[38px] leading-tight font-semibold">Notifications</h1>
      <p className="mt-1 text-sm text-muted">
        New chapters from stories and authors you follow, replies and likes, and news about your own stories.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {unread > 0 && <MarkRead />}
        <Link href="/settings#notifications" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <Settings className="h-4 w-4" /> Phone notifications
        </Link>
      </div>
      <PushSettings variant="prompt" />

      {rows.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border-strong px-6 py-12 text-center">
          <BellOff className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-4 font-medium">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Follow a story and you&apos;ll hear the moment a new chapter is out.
          </p>
          <Link href="/browse" className="mt-5 inline-flex h-11 items-center rounded-lg bg-accent-strong px-5 text-sm font-medium text-white">
            Find a story
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((n) => {
            const d = describe(n);
            const Icon = d.icon;
            return (
              <li key={n.id}>
                <Link href={d.href} className={`flex gap-3.5 px-4 py-4 transition hover:bg-surface-2 ${n.read_at ? "" : "bg-accent/[0.06]"}`}>
                  {n.actor && n.kind !== "new_chapter" ? (
                    // The person who did it, with a small badge saying what they did.
                    <span className="relative mt-0.5 h-9 w-9 shrink-0">
                      <Avatar url={n.actor.avatar_url} name={n.actor.display_name || n.actor.username} seed={n.actor.username} size={36} />
                      <span className={`absolute -right-1 -bottom-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-surface ${n.read_at ? "bg-surface-3 text-muted" : "bg-accent-strong text-white"}`}>
                        <Icon className="h-2.5 w-2.5" />
                      </span>
                    </span>
                  ) : (
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.read_at ? "bg-surface-3 text-muted" : "bg-accent/15 text-accent"}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug [&_b]:font-semibold">{d.text}</span>
                    {n.comments?.body && (n.kind === "comment_reply" || n.kind === "story_comment" || n.kind === "comment_like") && (
                      <span className="mt-1 line-clamp-2 block font-serif text-[15px] text-muted italic">“{n.comments.body}”</span>
                    )}
                    <span className="mt-1 block text-xs text-muted">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
