"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell, BellRing, Check, Loader2, UserPlus } from "lucide-react";
import { setFollow } from "@/app/community/actions";
import { btn } from "@/components/ui/styles";

/** Follow a story (new-chapter alerts) or an author (alerts for all their stories). */
export function FollowButton({
  storyId,
  authorId,
  initial,
  signedIn,
  loginHref,
  count,
  className = "",
}: {
  storyId?: string;
  authorId?: string;
  initial: boolean;
  signedIn: boolean;
  loginHref: string;
  count?: number;
  className?: string;
}) {
  const [following, setFollowing] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const author = Boolean(authorId);
  const followers = count === undefined ? undefined : count + (following ? 1 : 0) - (initial ? 1 : 0);

  if (!signedIn) {
    return (
      <Link href={loginHref} className={`${btn.secondary} ${className}`}>
        {author ? <UserPlus className="h-4 w-4" /> : <Bell className="h-4 w-4" />} Follow
      </Link>
    );
  }

  function toggle() {
    const next = !following;
    setFollowing(next);
    setError(null);
    start(async () => {
      const r = await setFollow({ storyId, authorId }, next).catch(() => ({ ok: false as const, error: "You seem to be offline." }));
      if (!r.ok) {
        setFollowing(!next);
        setError(r.error);
      }
    });
  }

  return (
    <span className={`relative inline-flex flex-col ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={following}
        title={
          following
            ? author
              ? "You'll hear about this author's new chapters"
              : "You'll hear about new chapters"
            : undefined
        }
        className={`${btn.secondary} w-full ${following ? "text-accent" : ""}`}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : following ? (
          author ? <Check className="h-4 w-4" /> : <BellRing className="h-4 w-4" />
        ) : author ? (
          <UserPlus className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {following ? "Following" : "Follow"}
        {followers !== undefined && followers > 0 && <span className="hidden text-muted tabular-nums sm:inline">{followers.toLocaleString()}</span>}
      </button>
      {error && (
        <span role="alert" className="absolute top-full left-0 mt-1 text-xs whitespace-nowrap text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
