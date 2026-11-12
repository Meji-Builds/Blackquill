// What a notification says and where it leads. Shared by the notifications page and phone alerts.
import { languageLabel } from "../translation/languages.ts";

export type NotificationKind =
  | "new_chapter"
  | "comment_reply"
  | "story_comment"
  | "new_follower"
  | "chapter_like"
  | "comment_like"
  | "translator_request"
  | "translator_invite"
  | "translator_approved"
  | "translator_declined";

export interface NotificationFacts {
  kind: NotificationKind;
  storyId: string | null;
  chapterNumber: number | null;
  actorUsername: string | null;
  language: string | null;
}

/** The page a notification opens. */
export function notificationHref(n: NotificationFacts): string {
  const story = n.storyId ? `/story/${n.storyId}` : "/";
  const chapter = n.storyId && n.chapterNumber ? `${story}/chapter/${n.chapterNumber}` : story;
  switch (n.kind) {
    case "new_chapter":
    case "chapter_like":
      return chapter;
    case "comment_reply":
    case "story_comment":
    case "comment_like":
      return `${chapter}#comments`;
    case "new_follower":
      return n.actorUsername ? `/author/${n.actorUsername}` : "/";
    case "translator_request":
      return n.storyId ? `/studio/${n.storyId}#translations` : "/studio";
    case "translator_approved":
      return n.storyId && n.language ? `/translate/${n.storyId}/${n.language}` : "/translate";
    default:
      return "/translate";
  }
}

export interface PushFacts extends NotificationFacts {
  id: string;
  actorName: string | null;
  storyTitle: string | null;
  chapterTitle: string | null;
  commentId: string | null;
  commentBody: string | null;
  /** Other people who liked the same thing (for likes). */
  others: number;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Alerts with the same tag replace each other on the phone instead of piling up. */
  tag: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The words of a phone alert. */
export function pushMessage(n: PushFacts): PushMessage {
  const who = n.actorName || "Someone";
  const story = n.storyTitle || "your story";
  const chapter = n.chapterNumber ? `Chapter ${n.chapterNumber}${n.chapterTitle ? `: ${n.chapterTitle}` : ""}` : "a chapter";
  const quote = n.commentBody ? `“${clip(n.commentBody.replace(/\s+/g, " ").trim(), 140)}”` : "";
  const andOthers = n.others > 0 ? ` and ${n.others} other${n.others === 1 ? "" : "s"}` : "";
  const lang = n.language ? languageLabel(n.language) : "another language";
  switch (n.kind) {
    case "new_chapter":
      return { title: `New chapter of ${story}`, body: chapter, tag: `chapter-${n.storyId}-${n.chapterNumber}` };
    case "comment_reply":
      return { title: `${who} replied to you`, body: quote || `On ${story}`, tag: `n-${n.id}` };
    case "story_comment":
      return { title: `${who} commented on ${story}`, body: quote || chapter, tag: `n-${n.id}` };
    case "chapter_like":
      return { title: `${who}${andOthers} liked ${chapter}`, body: story, tag: `like-ch-${n.storyId}-${n.chapterNumber}` };
    case "comment_like":
      return { title: `${who}${andOthers} liked your comment`, body: quote || `On ${story}`, tag: `like-c-${n.commentId}` };
    case "new_follower":
      return n.storyId
        ? { title: `${who} followed ${story}`, body: "They'll hear about every new chapter.", tag: `n-${n.id}` }
        : { title: `${who} started following you`, body: "They'll hear about everything you publish.", tag: `n-${n.id}` };
    case "translator_request":
      return { title: `${who} offered to translate ${story}`, body: `Into ${lang}. Open your studio to say yes or no.`, tag: `n-${n.id}` };
    case "translator_invite":
      return { title: `${who} invited you to translate`, body: `${story}, into ${lang}`, tag: `n-${n.id}` };
    case "translator_approved":
      return { title: `You can translate ${story}`, body: `${who} said yes to ${lang}.`, tag: `n-${n.id}` };
    case "translator_declined":
      return { title: `${who} declined your offer`, body: `${story}, into ${lang}`, tag: `n-${n.id}` };
  }
}

export type PushGroup = "chapters" | "comments" | "likes" | "followers" | "translations";
export const PUSH_GROUPS: { key: PushGroup; label: string; hint: string }[] = [
  { key: "chapters", label: "New chapters", hint: "From stories and authors you follow" },
  { key: "comments", label: "Comments and replies", hint: "Replies to you, and comments on your stories" },
  { key: "likes", label: "Likes", hint: "On your chapters and comments" },
  { key: "followers", label: "New followers", hint: "People following you or your stories" },
  { key: "translations", label: "Translations", hint: "Offers, invitations and answers" },
];
