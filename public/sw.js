const CACHE_VERSION = "osameh-portfolio-v2"; // __CACHE_VERSION__
const PRECACHE_ASSETS = []; // __PRECACHE_ASSETS__
const SHELL = ["/", "/favicon.svg", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/og-cover-social.jpg"];
const PRECACHE = [...new Set([...SHELL, ...PRECACHE_ASSETS])];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

/**
 * Stores a copy of a response without ever risking the response we hand back.
 *
 * The clone MUST be taken synchronously, before the original is returned and the
 * browser starts consuming its body. Cloning later - for example inside the
 * caches.open() callback - throws "Response body is already used", because by
 * then the body has been read. Cache writes are also fully contained here: a
 * failed cache write must never reject an otherwise successful network response.
 */
function cacheResponse(request, response) {
  if (!response || !response.ok || response.type === "opaque") return response;
  let copy;
  try {
    copy = response.clone();
  } catch {
    return response;
  }
  caches.open(CACHE_VERSION)
    .then(cache => cache.put(request, copy))
    .catch(() => {});
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // NETWORK ONLY for the API. These responses are dynamic and include transient
  // GitHub failures, rate limits and 4xx/5xx bodies. Caching any of them would
  // let one failed Source Explorer request keep failing after the cause is gone,
  // so the service worker stays out of the way entirely.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => cacheResponse(request, response))
        .catch(async () => (await caches.match(request)) || caches.match("/"))
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/notes-content/") || /\.(?:png|jpe?g|webp|avif|svg|woff2)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => cacheResponse(request, response)))
    );
  }
});
