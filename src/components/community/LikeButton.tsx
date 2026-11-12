"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart } from "lucide-react";
import { setLike } from "@/app/community/actions";

/** A heart with a count, for a chapter or a comment. Updates at once and settles on the server's count. */
export function LikeButton({
  target,
  initialCount,
  initialLiked,
  signedIn,
  loginHref,
  size = "sm",
  label = "Like",
  own = false,
}: {
  target: { chapterId?: string; commentId?: string };
  initialCount: number;
  initialLiked: boolean;
  signedIn: boolean;
  loginHref: string;
  size?: "sm" | "lg";
  label?: string;
  /** The reader wrote it: show the count only. */
  own?: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !liked;
    setBusy(true);
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (next) {
      setPop(true);
      setTimeout(() => setPop(false), 400);
    }
    const r = await setLike(target, next).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      return;
    }
    if (typeof r.count === "number") setCount(r.count);
  }

  const big = size === "lg";
  const cls = big
    ? `inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium transition ${liked ? "border-[#e5487a]/40 bg-[#e5487a]/10 text-[#e5487a]" : "border-current/20 hover:bg-black/5"}`
    : `inline-flex h-8 items-center gap-1.5 rounded-lg px-2 -ml-2 transition ${liked ? "text-[#e5487a]" : "hover:text-[#e5487a]"}`;
  const heart = (
    <Heart
      className={`${big ? "h-5 w-5" : "h-4 w-4"} transition-transform ${pop ? "scale-125" : ""}`}
      fill={liked ? "currentColor" : "none"}
    />
  );
  const text = own && big ? `${count.toLocaleString()} like${count === 1 ? "" : "s"}` : big ? (count > 0 ? `${liked ? "Liked" : label} · ${count.toLocaleString()}` : label) : count > 0 ? count.toLocaleString() : null;

  if (own) {
    return count > 0 ? (
      <span className={cls} aria-label={`${count} like${count === 1 ? "" : "s"}`}>
        {heart} {text}
      </span>
    ) : null;
  }
  if (!signedIn) {
    return (
      <Link href={loginHref} className={cls} aria-label={`${label} (sign in)`}>
        {heart} {text}
      </Link>
    );
  }
  return (
    <button onClick={toggle} aria-pressed={liked} aria-label={big ? undefined : `${label}${count ? `, ${count}` : ""}`} className={cls}>
      {heart} {text}
    </button>
  );
}
