"use client";

import { useTransition } from "react";
import { removeFromShelf } from "@/app/reader/actions";

export function RemoveFromShelf({ shelfId, storyId, title }: { shelfId: string; storyId: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label={`Remove ${title} from this shelf`}
      disabled={pending}
      onClick={() => start(async () => void (await removeFromShelf(shelfId, storyId)))}
      className="absolute top-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-sm text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger"
    >
      ✕
    </button>
  );
}
