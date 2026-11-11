"use client";

import { useTransition } from "react";
import { removeFromShelf } from "@/app/reader/actions";
import { X } from "lucide-react";

export function RemoveFromShelf({ shelfId, storyId, title }: { shelfId: string; storyId: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label={`Remove ${title} from this shelf`}
      disabled={pending}
      onClick={() => start(async () => void (await removeFromShelf(shelfId, storyId)))}
      className="absolute top-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur transition hover:bg-danger hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
