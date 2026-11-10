"use client";

import { useEffect, useState } from "react";
import { downloadStory, getOfflineStory, offlineSupported, removeOfflineStory, type OfflineStory } from "@/lib/offline/downloads";

type State =
  | { kind: "checking" }
  | { kind: "none" }
  | { kind: "saving"; done: number; total: number }
  | { kind: "saved"; story: OfflineStory };

/** Download a story's published chapters for offline reading, update the copy, or remove it. */
export function OfflineButton({
  storyId,
  title,
  coverUrl,
  chapters,
}: {
  storyId: string;
  title: string;
  coverUrl: string | null;
  chapters: number[];
}) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<State>({ kind: "checking" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!offlineSupported()) return;
    setSupported(true);
    getOfflineStory(storyId).then((s) => setState(s ? { kind: "saved", story: s } : { kind: "none" }));
  }, [storyId]);

  if (!supported || chapters.length === 0) return null;

  async function save() {
    setError(null);
    try {
      await downloadStory({ id: storyId, title, coverUrl, chapters }, (done, total) =>
        setState({ kind: "saving", done, total }),
      );
      const s = await getOfflineStory(storyId);
      setState(s ? { kind: "saved", story: s } : { kind: "none" });
    } catch (e) {
      setError(navigator.onLine ? (e as Error).message : "You are offline. Connect to download this story.");
      const s = await getOfflineStory(storyId);
      setState(s ? { kind: "saved", story: s } : { kind: "none" });
    }
  }

  async function remove() {
    setError(null);
    await removeOfflineStory(storyId);
    setState({ kind: "none" });
  }

  const missing = state.kind === "saved" ? chapters.filter((n) => !state.story.chapters.includes(n)).length : 0;
  const button = "rounded-md border px-4 py-2 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state.kind === "none" && (
        <button onClick={save} className={`${button} border-border hover:bg-surface-2`}>
          ↓ Download for offline
        </button>
      )}
      {state.kind === "saving" && (
        <span role="status" className={`${button} border-border text-muted`}>
          Saving {state.done} of {state.total}…
        </span>
      )}
      {state.kind === "saved" &&
        (missing > 0 ? (
          <button onClick={save} className={`${button} border-accent/50 text-accent hover:bg-accent/10`}>
            ↓ Update offline copy ({missing} new)
          </button>
        ) : (
          <span className={`${button} border-emerald-400/40 text-emerald-300`}>✓ Saved offline</span>
        ))}
      {state.kind === "saved" && (
        <button onClick={remove} className="text-sm text-muted hover:text-danger">
          Remove
        </button>
      )}
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
