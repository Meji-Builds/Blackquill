"use client";

import { useState, useTransition } from "react";
import { deleteStory, setStoryStatus } from "@/app/studio/actions";

export function StoryActions({
  storyId,
  mode,
  title,
  publishedChapters = 0,
}: {
  storyId: string;
  mode: "publish" | "delete";
  title?: string;
  publishedChapters?: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (mode === "publish") {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
        <p className="flex-1 text-sm">
          This story is a private draft. Readers cannot see it.
          {publishedChapters === 0 && " Publish at least one chapter so readers have something to read."}
        </p>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setStoryStatus(storyId, "ongoing");
              if (!r.ok) setError(r.error);
            })
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent-strong px-5 text-sm font-medium text-white shadow-[0_8px_24px_-12px_rgba(143,107,255,0.8)] transition hover:bg-[#9c7dff] disabled:opacity-50"
        >
          {pending ? "Publishing…" : "Publish story"}
        </button>
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        disabled={pending}
        onClick={() => {
          const typed = window.prompt(`Type the story title to delete it:\n${title}`);
          if (typed === null) return;
          if (typed.trim() !== title) {
            setError("The title did not match. Nothing was deleted.");
            return;
          }
          start(async () => {
            const r = await deleteStory(storyId);
            if (r && !r.ok) setError(r.error);
          });
        }}
        className="rounded-md border border-danger/50 px-4 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete story"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
