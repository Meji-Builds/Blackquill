"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BookOpen, ExternalLink, FileText, Loader2, MessageCircle, UserRound } from "lucide-react";
import { removeProfilePicture, resolveReports } from "@/app/admin/actions";
import { Avatar } from "@/components/Avatar";
import { btn } from "@/components/ui/styles";
import { timeAgo } from "@/lib/community/types";

export interface QueueItem {
  target_type: "story" | "chapter" | "comment" | "profile";
  target_id: string;
  reports: number;
  reasons: string[];
  first_at: string;
  last_at: string;
  title: string | null;
  excerpt: string | null;
  href: string | null;
  owner_username: string | null;
  is_removed: boolean;
  /** The profile picture of the reported person (profiles) or commenter (comments). */
  image: string | null;
}

const ICONS = { story: BookOpen, chapter: FileText, comment: MessageCircle, profile: UserRound };

export function ReportCard({ item, resolved }: { item: QueueItem; resolved?: boolean }) {
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const Icon = ICONS[item.target_type];
  const removeLabel = item.target_type === "comment" ? "Hide comment" : item.target_type === "profile" ? "Clear picture and bio" : "Take story down";
  const [picture, setPicture] = useState(item.image);

  function act(action: "dismiss" | "remove" | "restore") {
    if (action === "remove" && !confirm(`${removeLabel}? Readers will no longer see it.`)) return;
    if (action === "remove" && item.target_type === "profile") setPicture(null);
    setError(null);
    start(async () => {
      const r = await resolveReports(item.target_type, item.target_id, action, note);
      if (!r.ok) setError(r.error);
      else setDone(action === "dismiss" ? "Dismissed" : action === "remove" ? (item.target_type === "comment" ? "Comment hidden" : item.target_type === "profile" ? "Picture and bio cleared" : "Story taken down") : "Restored");
    });
  }

  function clearPicture() {
    if (!item.owner_username || !confirm(`Remove @${item.owner_username}'s profile picture?`)) return;
    setError(null);
    start(async () => {
      const r = await removeProfilePicture(item.owner_username!);
      if (!r.ok) setError(r.error);
      else setPicture(null);
    });
  }

  return (
    <article className={`rounded-2xl border border-border bg-surface p-4 sm:p-5 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-muted">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {item.target_type}
            {item.is_removed && <span className="ml-2 rounded-full bg-danger/15 px-2 py-0.5 text-danger normal-case">{item.target_type === "comment" ? "Hidden" : "Taken down"}</span>}
          </p>
          <h2 className="mt-0.5 font-semibold break-words">{item.title ?? "(deleted)"}</h2>
          {item.owner_username && (
            <p className="text-sm text-muted">
              by <Link href={`/author/${item.owner_username}`} className="hover:underline">@{item.owner_username}</Link>
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-danger/15 px-2.5 py-1 text-xs font-semibold text-danger tabular-nums">
          {item.reports} {item.reports === 1 ? "report" : "reports"}
        </span>
      </div>
      {picture && (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-background px-3.5 py-2.5">
          <Avatar url={picture} name={item.owner_username ?? "?"} size={72} />
          <div className="min-w-0 text-sm">
            <p className="text-muted">Profile picture of @{item.owner_username}</p>
            {!done && (
              <button onClick={clearPicture} disabled={pending} className="mt-1 font-medium text-danger hover:underline">
                Remove picture
              </button>
            )}
          </div>
        </div>
      )}
      {item.excerpt && <p className="mt-3 line-clamp-4 rounded-xl bg-background px-3.5 py-2.5 font-serif text-[15px] text-foreground/85">{item.excerpt}</p>}
      <ul className="mt-3 space-y-1 text-sm">
        {item.reasons.slice(0, 5).map((r, i) => (
          <li key={i} className="text-muted">
            <span className="text-foreground">•</span> {r}
          </li>
        ))}
        {item.reasons.length > 5 && <li className="text-muted">and {item.reasons.length - 5} more</li>}
      </ul>
      <p className="mt-2 text-xs text-muted">
        First reported {timeAgo(item.first_at)} · latest {timeAgo(item.last_at)}
      </p>

      {done ? (
        <p role="status" className="mt-4 text-sm font-medium text-success">{done}.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {!resolved && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (shown to the writer if their story is taken down)"
              maxLength={500}
              className="h-10 w-full rounded-lg border border-border-strong bg-background px-3 text-sm outline-none focus:border-accent"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {item.href && (
              <Link href={item.href} target="_blank" className={btn.small}>
                <ExternalLink className="h-4 w-4" /> Open
              </Link>
            )}
            {!resolved && (
              <button onClick={() => act("dismiss")} disabled={pending} className={btn.small}>
                Dismiss
              </button>
            )}
            {item.is_removed && item.target_type !== "profile" ? (
              <button onClick={() => act("restore")} disabled={pending} className={btn.small}>
                Restore
              </button>
            ) : (
              !resolved && (
                <button onClick={() => act("remove")} disabled={pending} className={`${btn.small} border-danger/40 text-danger hover:bg-danger/10`}>
                  {removeLabel}
                </button>
              )
            )}
            {pending && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </article>
  );
}
