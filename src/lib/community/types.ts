export interface CommentView {
  id: string;
  body: string;
  paragraphIndex: number | null;
  parentId: string | null;
  createdAt: string;
  edited: boolean;
  hidden: boolean;
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  /** Written by the story's author. */
  isAuthor: boolean;
  likes: number;
  /** Liked by the person reading. */
  liked: boolean;
}

export interface Thread {
  comment: CommentView;
  replies: CommentView[];
}

/** Groups comments into threads (top-level comments with their replies), oldest first. */
export function threads(comments: CommentView[]): Thread[] {
  const byId = new Map<string, Thread>();
  const out: Thread[] = [];
  for (const c of comments) {
    if (!c.parentId) {
      const t = { comment: c, replies: [] };
      byId.set(c.id, t);
      out.push(t);
    }
  }
  for (const c of comments) {
    if (c.parentId) byId.get(c.parentId)?.replies.push(c);
  }
  return out;
}

/** Number of top-level comments plus replies attached to each paragraph. */
export function paragraphCounts(comments: CommentView[]): Map<number, number> {
  const para = new Map<string, number>();
  const counts = new Map<number, number>();
  for (const c of comments) if (!c.parentId && c.paragraphIndex !== null) para.set(c.id, c.paragraphIndex);
  for (const c of comments) {
    const p = c.parentId ? para.get(c.parentId) : c.paragraphIndex;
    if (p === undefined || p === null) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return counts;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  if (d < 365) return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
