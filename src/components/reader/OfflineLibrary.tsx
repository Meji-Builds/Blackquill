"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cover } from "@/components/Cover";
import { chapterUrl, listOfflineStories, offlineSupported, removeOfflineStory, storyUrl, type OfflineStory } from "@/lib/offline/downloads";

/** Stories saved on this device. Rendered entirely from the browser's cache, so it works with no connection. */
export function OfflineLibrary() {
  const [stories, setStories] = useState<OfflineStory[] | null>(null);
  const [online, setOnline] = useState(true);
  // Shown in place of a page that is not saved (the address bar still shows that page): certainly offline.
  const [standIn, setStandIn] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(offlineSupported());
    setOnline(navigator.onLine);
    setStandIn(window.location.pathname !== "/offline");
    listOfflineStories().then(setStories);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (!supported) {
    return <p className="mt-6 text-muted">This browser cannot save stories for offline reading.</p>;
  }

  return (
    <div>
      {(standIn || !online) && (
        <p role="status" className="mt-6 rounded-lg border border-amber-400/40 bg-amber-400/5 p-4 text-sm">
          {standIn
            ? "You are offline and that page is not saved on this device. Stories you downloaded are below."
            : "You are offline. Stories saved on this device are below; everything else needs a connection."}
        </p>
      )}
      {stories === null ? null : stories.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-muted">
          Nothing saved yet. Open a story and choose <span className="text-foreground">Download for offline</span>.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border">
          {stories.map((s) => (
            <li key={s.id} className="flex gap-4 py-4">
              <Link href={storyUrl(s.id)} className="w-16 shrink-0">
                <Cover url={s.coverUrl} title={s.title} className="w-full" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={storyUrl(s.id)} className="font-serif text-lg hover:text-accent">
                  {s.title}
                </Link>
                <p className="text-xs text-muted">
                  {s.chapters.length} {s.chapters.length === 1 ? "chapter" : "chapters"} saved{" "}
                  {new Date(s.savedAt).toLocaleDateString()}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {s.chapters.slice(0, 1).map((n) => (
                    <a key={n} href={chapterUrl(s.id, n)} className="inline-flex h-9 items-center rounded-lg bg-accent-strong px-3 text-sm font-medium text-white hover:bg-[#9c7dff]">
                      Read from chapter {n}
                    </a>
                  ))}
                  <button
                    onClick={async () => {
                      await removeOfflineStory(s.id);
                      setStories(await listOfflineStories());
                    }}
                    className="px-2 text-muted hover:text-danger"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
