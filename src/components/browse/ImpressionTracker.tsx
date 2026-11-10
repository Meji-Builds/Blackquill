"use client";

import { useEffect, useRef } from "react";
import { recordFreshImpressions } from "@/app/discovery/actions";

/**
 * Wraps the Fresh Shelf row and reports its stories as shown once the row is at least half on screen.
 * Readers who never scroll to it, and crawlers that run no JavaScript, do not use up a story's batch.
 */
export function ImpressionTracker({ storyIds, children }: { storyIds: string[]; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = storyIds.join(",");

  useEffect(() => {
    const el = ref.current;
    if (!el || !key) return;
    let sent = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (sent || !entries.some((e) => e.isIntersecting)) return;
        sent = true;
        io.disconnect();
        void recordFreshImpressions(key.split(","));
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [key]);

  return <div ref={ref}>{children}</div>;
}
