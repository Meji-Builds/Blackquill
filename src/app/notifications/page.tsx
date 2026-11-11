import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, BookOpen, MessageCircle, Reply, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/community/types";
import { MarkRead } from "@/components/community/MarkRead";

export const metadata: Metadata = { title: "Notifications" };

interface Row {
  id: string;
  kind: "new_chapter" | "comment_reply" | "story_comment" | "new_follower";
  read_at: string | null;
  created_at: string;
  story_id: string | null;
  actor: { username: string; display_name: string | null } | null;
  stories: { id: string; title: string } | null;
  chapters: { number: number; title: string } | null;
  comments: { body: string } | null;
}

function describe(n: Row) {
  const who = n.actor ? n.actor.display_name || n.actor.username : "Someone";
  const story = n.stories?.title ?? "a story";
  const chapter = n.chapters ? `Chapter ${n.chapters.number}${n.chapters.title ? `: ${n.chapters.title}` : ""}` : "";
  const chapterHref = n.stories && n.chapters ? `/story/${n.stories.id}/chapter/${n.chapters.number}` : n.stories ? `/story/${n.stories.id}` : "/";
  switch (n.kind) {
    case "new_chapter":
      return { icon: BookOpen, href: chapterHref, text: <><b>{story}</b> has a new chapter: {chapter}</> };
    case "comment_reply":
      return { icon: Reply, href: `${chapterHref}#comments`, text: <><b>{who}</b> replied to your comment on <b>{story}</b></> };
    case "story_comment":
      return { icon: MessageCircle, href: `${chapterHref}#comments`, text: <><b>{who}</b> commented on {chapter || "a chapter"} of <b>{story}</b></> };
    case "new_follower":
      return {
        icon: UserPlus,
        href: n.actor ? `/author/${n.actor.username}` : "/",
        text: n.story_id ? <><b>{who}</b> followed <b>{story}</b></> : <><b>{who}</b> started following you</>,
      };
  }
}

export default async function NotificationsPage() {
  const { supabase, user } = await requireUser("/notifications");
  const { data } = await supabase
    .from("notifications")
    .select(
      "id, kind, read_at, created_at, story_id, actor:profiles!notifications_actor_id_fkey(username, display_name), stories(id, title), chapters(number, title), comments(body)",
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
        New chapters from stories and authors you follow, replies to your comments and news about your own stories.
      </p>
      {unread > 0 && <MarkRead />}

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
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.read_at ? "bg-surface-3 text-muted" : "bg-accent/15 text-accent"}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug [&_b]:font-semibold">{d.text}</span>
                    {n.comments?.body && (n.kind === "comment_reply" || n.kind === "story_comment") && (
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
