"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, MoreHorizontal, Pencil, Reply, Trash2, X } from "lucide-react";
import { deleteComment, editComment, loadComments, postComment } from "@/app/community/actions";
import { threads, timeAgo, type CommentView } from "@/lib/community/types";
import type { Palette } from "@/components/reader/settings";
import { ReportButton } from "./ReportButton";

/** Loads a chapter's comments once and keeps them in sync with what this reader posts, edits and deletes. */
export function useComments(chapterId: string) {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");

  useEffect(() => {
    let live = true;
    loadComments(chapterId)
      .then((r) => {
        if (!live) return;
        setComments(r.comments);
        setMe(r.me);
        setState(r.error ? "offline" : "ready");
      })
      .catch(() => live && setState("offline"));
    return () => {
      live = false;
    };
  }, [chapterId]);

  const add = useCallback((c: CommentView) => setComments((cs) => [...cs, c]), []);
  const change = useCallback(
    (id: string, body: string) => setComments((cs) => cs.map((c) => (c.id === id ? { ...c, body, edited: true } : c))),
    [],
  );
  const remove = useCallback((id: string) => setComments((cs) => cs.filter((c) => c.id !== id && c.parentId !== id)), []);
  return { comments, me, state, add, change, remove };
}

export type CommentsApi = ReturnType<typeof useComments>;

interface Shared {
  api: CommentsApi;
  chapterId: string;
  signedIn: boolean;
  loginHref: string;
  t: Palette;
}

/** The discussion at the end of a chapter: chapter comments, with paragraph comments listed after them. */
export function ChapterComments({ onOpenParagraph, ...p }: Shared & { onOpenParagraph: (index: number) => void }) {
  const { api, t } = p;
  const all = threads(api.comments);
  const chapterLevel = all.filter((x) => x.comment.paragraphIndex === null);
  const paragraphLevel = all.filter((x) => x.comment.paragraphIndex !== null);
  const total = api.comments.length;
  const [showInline, setShowInline] = useState(false);

  return (
    <section id="comments" aria-labelledby="comments-heading" className="mt-14 scroll-mt-20">
      <h2 id="comments-heading" className="flex items-center gap-2 text-lg font-semibold">
        <MessageCircle className="h-5 w-5" /> Comments
        {total > 0 && <span className="text-sm font-normal" style={{ color: t.muted }}>{total}</span>}
      </h2>
      <p className="mt-1 text-sm" style={{ color: t.muted }}>
        Tap any paragraph to comment on that line.
      </p>

      <div className="mt-5">
        <Composer {...p} placeholder="Share your thoughts on this chapter…" />
      </div>

      {api.state === "loading" ? (
        <p className="mt-6 flex items-center gap-2 text-sm" style={{ color: t.muted }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
        </p>
      ) : api.state === "offline" ? (
        <p className="mt-6 text-sm" style={{ color: t.muted }}>
          Comments aren&apos;t available offline.
        </p>
      ) : chapterLevel.length === 0 && paragraphLevel.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: t.muted }}>
          No comments yet. Be the first to say what you thought.
        </p>
      ) : (
        <>
          <ThreadList {...p} list={chapterLevel} />
          {paragraphLevel.length > 0 && (
            <div className="mt-8">
              <button
                onClick={() => setShowInline((s) => !s)}
                aria-expanded={showInline}
                className="text-sm font-medium underline-offset-4 hover:underline"
                style={{ color: t.muted }}
              >
                {showInline ? "Hide" : "Show"} {paragraphLevel.length} paragraph {paragraphLevel.length === 1 ? "comment" : "comments"}
              </button>
              {showInline && (
                <ul className="mt-4 space-y-3">
                  {paragraphLevel.map((x) => (
                    <li key={x.comment.id}>
                      <button
                        onClick={() => onOpenParagraph(x.comment.paragraphIndex!)}
                        className="w-full rounded-xl border px-4 py-3 text-left text-sm"
                        style={{ borderColor: t.border }}
                      >
                        <span className="block text-xs" style={{ color: t.muted }}>
                          Paragraph {x.comment.paragraphIndex! + 1} · {x.comment.name}
                          {x.replies.length > 0 && ` · ${x.replies.length} ${x.replies.length === 1 ? "reply" : "replies"}`}
                        </span>
                        <span className="mt-1 line-clamp-2 block">{x.comment.body}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Bottom sheet with one paragraph's discussion. */
export function ParagraphSheet({
  index,
  excerpt,
  onClose,
  ...p
}: Shared & { index: number; excerpt: string; onClose: () => void }) {
  const { api, t } = p;
  const list = threads(api.comments).filter((x) => x.comment.paragraphIndex === index);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Comments on paragraph ${index + 1}`}
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-t-3xl shadow-2xl outline-none sm:rounded-3xl"
        style={{ background: t.bg, color: t.fg, boxShadow: `0 0 0 1px ${t.border}` }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full sm:hidden" style={{ background: t.border }} />
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 className="text-base font-semibold">Paragraph {index + 1}</h2>
          <button onClick={onClose} aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ color: t.muted }}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <blockquote className="mx-5 line-clamp-3 border-l-2 pl-3 font-serif text-[15px] italic" style={{ borderColor: "var(--accent-strong)", color: t.muted }}>
          {excerpt}
        </blockquote>
        <div className="mt-2 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
          {list.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: t.muted }}>
              No comments on this paragraph yet.
            </p>
          ) : (
            <ThreadList {...p} list={list} />
          )}
        </div>
        <div className="border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ borderColor: t.border }}>
          <Composer {...p} paragraphIndex={index} placeholder="Comment on this paragraph…" autoFocus={list.length === 0} />
        </div>
      </div>
    </div>
  );
}

function ThreadList({ list, ...p }: Shared & { list: ReturnType<typeof threads> }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  return (
    <ul className="mt-6 space-y-6">
      {list.map(({ comment, replies }) => (
        <li key={comment.id}>
          <CommentItem {...p} c={comment} onReply={() => setReplyTo(comment.id)} />
          {(replies.length > 0 || replyTo === comment.id) && (
            <ul className="mt-4 ml-5 space-y-4 border-l pl-4" style={{ borderColor: p.t.border }}>
              {replies.map((r) => (
                <li key={r.id}>
                  <CommentItem {...p} c={r} onReply={() => setReplyTo(comment.id)} />
                </li>
              ))}
              {replyTo === comment.id && (
                <li>
                  <Composer
                    {...p}
                    parentId={comment.id}
                    placeholder={`Reply to ${comment.name}…`}
                    autoFocus
                    onDone={() => setReplyTo(null)}
                  />
                </li>
              )}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function CommentItem({ c, onReply, api, t, signedIn }: Shared & { c: CommentView; onReply: () => void }) {
  const mine = api.me === c.userId;
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const r = await editComment(c.id, draft);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    api.change(c.id, draft.trim());
    setEditing(false);
  }

  async function remove() {
    if (!confirm(c.parentId ? "Delete this reply?" : "Delete this comment and its replies?")) return;
    const r = await deleteComment(c.id);
    if (!r.ok) return setError(r.error);
    api.remove(c.id);
  }

  return (
    <article className="flex gap-3">
      <Link
        href={`/author/${c.username}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8f6bff] to-[#5b3fd6] text-sm font-semibold text-white"
        aria-hidden="true"
        tabIndex={-1}
      >
        {c.name.charAt(0).toUpperCase()}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <Link href={`/author/${c.username}`} className="font-semibold hover:underline">
            {c.name}
          </Link>
          {c.isAuthor && (
            <span className="rounded-full bg-[#d9b26f]/20 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#b8893a] uppercase">
              Author
            </span>
          )}
          <span className="text-xs" style={{ color: t.muted }}>
            {timeAgo(c.createdAt)}
            {c.edited && " · edited"}
          </span>
        </div>
        {c.hidden && (
          <p className="mt-1 text-xs font-medium text-[#e5484d]">Hidden by moderators. Only you can see this.</p>
        )}
        {editing ? (
          <div className="mt-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={4000}
              className="w-full rounded-xl border bg-transparent px-3 py-2 text-[15px] outline-none focus:ring-2 focus:ring-[#8f6bff]/40"
              style={{ borderColor: t.border }}
            />
            <div className="mt-2 flex gap-2">
              <button onClick={save} disabled={busy || !draft.trim()} className="inline-flex h-9 items-center rounded-lg bg-[#8f6bff] px-4 text-sm font-medium text-white disabled:opacity-50">
                {busy ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setEditing(false); setDraft(c.body); }} className="h-9 rounded-lg px-3 text-sm" style={{ color: t.muted }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-[15px] leading-relaxed break-words whitespace-pre-line">{c.body}</p>
        )}
        {error && <p role="alert" className="mt-1 text-sm text-[#e5484d]">{error}</p>}
        {!editing && (
          <div className="mt-1.5 flex items-center gap-1 text-sm" style={{ color: t.muted }}>
            {signedIn && (
              <button onClick={onReply} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 -ml-2 hover:underline">
                <Reply className="h-4 w-4" /> Reply
              </button>
            )}
            {signedIn && (
              <div className="relative">
                <button
                  onClick={() => setMenu((m) => !m)}
                  aria-label="More actions"
                  aria-expanded={menu}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menu && (
                  <div
                    className="absolute left-0 z-10 mt-1 w-44 overflow-hidden rounded-xl py-1 shadow-xl"
                    style={{ background: t.bg, boxShadow: `0 0 0 1px ${t.border}, 0 12px 32px rgba(0,0,0,.35)`, color: t.fg }}
                    onClick={() => setMenu(false)}
                  >
                    {mine ? (
                      <>
                        <button onClick={() => setEditing(true)} className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm hover:bg-black/5">
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button onClick={remove} className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm text-[#e5484d] hover:bg-black/5">
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </>
                    ) : (
                      <ReportButton targetType="comment" targetId={c.id} variant="menu" />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Composer({
  api,
  chapterId,
  signedIn,
  loginHref,
  t,
  placeholder,
  paragraphIndex = null,
  parentId = null,
  autoFocus,
  onDone,
}: Shared & {
  placeholder: string;
  paragraphIndex?: number | null;
  parentId?: string | null;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  if (!signedIn) {
    return (
      <p className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: t.border, color: t.muted }}>
        <Link href={loginHref} className="font-medium underline" style={{ color: t.fg }}>
          Sign in
        </Link>{" "}
        to join the conversation.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await postComment({ chapterId, body, paragraphIndex, parentId }).catch(() => ({
      ok: false as const,
      error: "You seem to be offline. Try again when you're connected.",
      comment: undefined,
    }));
    setBusy(false);
    if (!r.ok || !r.comment) return setError(r.ok ? "Something went wrong." : r.error);
    api.add(r.comment);
    setBody("");
    setPosted(true);
    setTimeout(() => setPosted(false), 2500);
    onDone?.();
  }

  return (
    <form onSubmit={submit}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={parentId ? 2 : 3}
        maxLength={4000}
        autoFocus={autoFocus}
        className="w-full resize-y rounded-xl border bg-transparent px-3.5 py-2.5 text-[15px] outline-none placeholder:opacity-60 focus:ring-2 focus:ring-[#8f6bff]/40"
        style={{ borderColor: t.border }}
      />
      {error && <p role="alert" className="mt-1 text-sm text-[#e5484d]">{error}</p>}
      <div className="mt-2 flex items-center justify-end gap-2">
        {posted && <span role="status" className="mr-auto text-sm" style={{ color: t.muted }}>Posted.</span>}
        {onDone && (
          <button type="button" onClick={onDone} className="h-9 rounded-lg px-3 text-sm" style={{ color: t.muted }}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#8f6bff] px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Posting…" : parentId ? "Reply" : "Post"}
        </button>
      </div>
    </form>
  );
}
