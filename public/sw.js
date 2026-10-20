/* DARS service worker — hand-written (replaces next-pwa, which doesn't support Next 16 / Turbopack).
 * Bump VERSION whenever this file or /offline.html changes. */
const VERSION = "v1";
const SHELL_CACHE = `dars-shell-${VERSION}`;
const STATIC_CACHE = `dars-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const SHELL_ASSETS = ["/icon.png", "/icons/icon-192.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Offline page is mandatory; if it fails, the install fails and retries later.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      // Nice-to-haves: never block install on these.
      await Promise.allSettled(SHELL_ASSETS.map((u) => cache.add(new Request(u, { cache: "reload" }))));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop old caches, including leftovers from the previous workbox/next-pwa worker.
      const keep = new Set([SHELL_CACHE, STATIC_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never touch API / connectivity probes

  // Page navigations: network first, offline page when the network is unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          return preload || (await fetch(request));
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
    return;
  }

  // Hashed build assets are immutable: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })()
    );
    return;
  }

  // Icons / manifest: stale-while-revalidate.
  if (SHELL_ASSETS.includes(url.pathname) || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const hit = await cache.match(request);
        const refresh = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })()
    );
  }
});
