/* Obsidian Quill service worker: offline reading.
 *
 * Caches
 *   oq-offline  Stories the reader downloaded (story page, every chapter, cover). Never trimmed; removed only by the
 *               reader or on sign-out. Also holds "/__offline-index", the list of downloaded stories.
 *   oq-pages    Recently visited reading pages, so they reopen offline. Trimmed to the newest 60.
 *   oq-static   Hashed app files (/_next/static), icons and fonts. Cache-first, trimmed to 400.
 *
 * The writer studio, sign-in and auth routes are never cached: editing offline could lose work.
 */
const VERSION = "v2";
const OFFLINE = "oq-offline";
const PAGES = "oq-pages";
const STATIC = "oq-static";
const KEEP = [OFFLINE, PAGES, STATIC];
const OFFLINE_PAGE = "/offline";
const PAGE_LIMIT = 60;
const STATIC_LIMIT = 400;

const READING_PATHS = [/^\/$/, /^\/story\//, /^\/browse$/, /^\/library$/, /^\/rankings$/, /^\/genre\//, /^\/tag\//, /^\/offline$/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        // The offline page and the app files it needs, so it works even if it was never visited.
        const response = await fetch(OFFLINE_PAGE, { credentials: "include" });
        if (response.ok) {
          const html = await response.clone().text();
          await (await caches.open(PAGES)).put(new URL(OFFLINE_PAGE, self.location.origin).toString(), response);
          const assets = [...html.matchAll(/["'(](\/_next\/static\/[^"'()\s]+)["')]/g)].map((m) => m[1]);
          const statics = await caches.open(STATIC);
          await Promise.all([...new Set(assets)].map((a) => statics.add(a).catch(() => {})));
        }
      } catch {
        /* the offline page is cached on the next successful visit instead */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (!KEEP.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

function pageKey(url) {
  // One entry per page regardless of tracking or cache-busting parameters, except where the query is the page
  // (browse filters, rankings tabs).
  const u = new URL(url);
  if (!/^\/(browse|rankings|genre|tag)/.test(u.pathname)) u.search = "";
  u.hash = "";
  return u.toString();
}

async function fromCaches(request) {
  const key = pageKey(request.url);
  return (
    (await (await caches.open(OFFLINE)).match(key)) ||
    (await (await caches.open(PAGES)).match(key)) ||
    (await (await caches.open(PAGES)).match(OFFLINE_PAGE))
  );
}

async function handleNavigation(event) {
  const { request } = event;
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok && READING_PATHS.some((re) => re.test(url.pathname))) {
      // Both copies are taken now: the browser starts reading the original as soon as it is returned.
      const forPages = response.clone();
      const forOffline = response.clone();
      event.waitUntil(
        (async () => {
          await (await caches.open(PAGES)).put(pageKey(request.url), forPages);
          await trim(PAGES, PAGE_LIMIT);
          // Keep downloaded stories fresh when the reader is online anyway.
          const offline = await caches.open(OFFLINE);
          if (await offline.match(pageKey(request.url))) await offline.put(pageKey(request.url), forOffline);
        })(),
      );
    }
    return response;
  } catch {
    const cached = await fromCaches(request);
    return cached || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function handleStatic(event) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const response = await fetch(event.request);
  if (response.ok) {
    event.waitUntil(cache.put(event.request, response.clone()).then(() => trim(STATIC, STATIC_LIMIT)));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Signing out clears everything personal that was saved for offline use.
  if (request.method === "POST" && url.pathname === "/auth/signout") {
    event.waitUntil(Promise.all([caches.delete(OFFLINE), caches.delete(PAGES)]));
    return;
  }
  if (request.method !== "GET") return;

  // Client-side navigation data (React Server Components): always from the network. When it fails, Next.js falls
  // back to a full page load, which the navigation handler below can answer from the cache.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(handleStatic(event));
    return;
  }

  // Downloaded covers and other saved files.
  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const hit = await (await caches.open(OFFLINE)).match(request);
        if (hit) return hit;
        throw new Error("offline");
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "version") event.source?.postMessage({ version: VERSION });
});
