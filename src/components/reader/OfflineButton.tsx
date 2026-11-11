"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { btn } from "@/components/ui/styles";
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
    if (!window.confirm("Remove the offline copy of this story from this device?")) return;
    setError(null);
    await removeOfflineStory(storyId);
    setState({ kind: "none" });
  }

  const missing = state.kind === "saved" ? chapters.filter((n) => !state.story.chapters.includes(n)).length : 0;

  return (
    <div className="relative">
      {state.kind === "checking" && (
        <span className={`${btn.secondary} w-full text-muted`}>
          <Download className="h-4 w-4" /> Offline
        </span>
      )}
      {state.kind === "none" && (
        <button onClick={save} className={`${btn.secondary} w-full`}>
          <Download className="h-4 w-4" /> <span className="sm:hidden">Offline</span><span className="hidden sm:inline">Download</span>
        </button>
      )}
      {state.kind === "saving" && (
        <span role="status" className={`${btn.secondary} w-full text-muted`}>
          <Loader2 className="h-4 w-4 animate-spin" /> {state.done}/{state.total}
        </span>
      )}
      {state.kind === "saved" &&
        (missing > 0 ? (
          <button onClick={save} className={`${btn.secondary} w-full border-accent/50 text-accent`}>
            <RefreshCw className="h-4 w-4" /> Update<span className="hidden sm:inline"> ({missing} new)</span>
          </button>
        ) : (
          <button onClick={remove} title="Saved for offline reading. Tap to remove." className={`${btn.secondary} group w-full text-success`}>
            <CheckCircle2 className="h-4 w-4 group-hover:hidden" />
            <Trash2 className="hidden h-4 w-4 group-hover:block" />
            <span className="group-hover:hidden">Saved<span className="hidden sm:inline"> offline</span></span>
            <span className="hidden group-hover:inline">Remove</span>
          </button>
        ))}
      {error && <p className="absolute top-full mt-1 w-64 text-xs text-danger">{error}</p>}
    </div>
  );
}
