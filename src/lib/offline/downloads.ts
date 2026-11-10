// Downloading stories for offline reading. Pages are fetched as full HTML and stored in the "oq-offline" cache,
// which the service worker (public/sw.js) serves from when there is no connection. The app files each page needs
// are stored too, so a downloaded chapter opens even if it was never visited.

export const OFFLINE_CACHE = "oq-offline";
const STATIC_CACHE = "oq-static";
const INDEX_URL = "/__offline-index";

export interface OfflineStory {
  id: string;
  title: string;
  coverUrl: string | null;
  chapters: number[];
  savedAt: string;
}

export function offlineSupported() {
  return typeof window !== "undefined" && "caches" in window && window.isSecureContext;
}

export const storyUrl = (id: string) => `/story/${id}`;
export const chapterUrl = (id: string, n: number) => `/story/${id}/chapter/${n}`;

async function readIndex(cache: Cache): Promise<OfflineStory[]> {
  const res = await cache.match(INDEX_URL);
  if (!res) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeIndex(cache: Cache, list: OfflineStory[]) {
  await cache.put(INDEX_URL, new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json" } }));
}

export async function listOfflineStories(): Promise<OfflineStory[]> {
  if (!offlineSupported()) return [];
  return readIndex(await caches.open(OFFLINE_CACHE));
}

export async function getOfflineStory(id: string): Promise<OfflineStory | null> {
  return (await listOfflineStories()).find((s) => s.id === id) ?? null;
}

/** Same-origin app files (scripts, styles, fonts) referenced by a page's HTML. */
function assetUrls(html: string) {
  const urls = new Set<string>();
  for (const m of html.matchAll(/["'(](\/_next\/static\/[^"'()\s]+)["')]/g)) urls.add(m[1]);
  return [...urls];
}

export async function downloadStory(
  story: { id: string; title: string; coverUrl: string | null; chapters: number[] },
  onProgress?: (done: number, total: number) => void,
) {
  const cache = await caches.open(OFFLINE_CACHE);
  const statics = await caches.open(STATIC_CACHE);
  const pages = [storyUrl(story.id), ...story.chapters.map((n) => chapterUrl(story.id, n))];
  const assets = new Set<string>();
  let done = 0;
  onProgress?.(done, pages.length);

  for (const url of pages) {
    const res = await fetch(url, { credentials: "include", headers: { Accept: "text/html" } });
    if (!res.ok) throw new Error(`Could not download ${url} (${res.status}).`);
    const html = await res.clone().text();
    assetUrls(html).forEach((a) => assets.add(a));
    await cache.put(new URL(url, location.origin).toString(), res);
    onProgress?.(++done, pages.length);
  }

  // App files: skip ones already stored; a failure here only means that chapter needs one online visit.
  await Promise.all(
    [...assets].map(async (a) => {
      if (await statics.match(a)) return;
      try {
        await statics.add(a);
      } catch {
        /* ignore */
      }
    }),
  );
  if (story.coverUrl?.startsWith("/")) {
    try {
      await cache.add(story.coverUrl);
    } catch {
      /* the cover falls back to the title card */
    }
  }

  const list = (await readIndex(cache)).filter((s) => s.id !== story.id);
  list.unshift({ ...story, savedAt: new Date().toISOString() });
  await writeIndex(cache, list);
}

export async function removeOfflineStory(id: string) {
  const cache = await caches.open(OFFLINE_CACHE);
  const list = await readIndex(cache);
  const entry = list.find((s) => s.id === id);
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path === storyUrl(id) || path.startsWith(`${storyUrl(id)}/`) || (entry?.coverUrl && path === entry.coverUrl)) {
      await cache.delete(req);
    }
  }
  await writeIndex(cache, list.filter((s) => s.id !== id));
}
