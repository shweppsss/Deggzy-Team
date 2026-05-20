// ============================================================================
// Service Worker — app-shell offline cache. Phase Offline-1.
//
// Strategy:
//   - Pre-cache the app shell (index.html + the Vite bundle + main icons)
//     on install. The shell is what makes the app load offline.
//   - Cache-first for shell entries (instant load even with a network).
//   - Network-first for everything else (Supabase API calls, blob refs,
//     external images). Falls back to cache only if the network is dead
//     AND the cache has a copy.
//   - No caching of Supabase API responses — those are stateful and
//     handled by the in-app store, not by the SW.
//
// Versioning: bump CACHE_VERSION when the shell ships breaking changes.
// The activate event prunes old cache buckets.
// ============================================================================

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `deggzy-shell-${CACHE_VERSION}`;

// Paths relative to the SW scope (GitHub Pages serves under /Deggzy-Team/).
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS.map((u) => new Request(u, { cache: 'reload' }))))
      .catch((err) => console.warn('[sw] shell pre-cache failed:', err))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('deggzy-shell-') && k !== SHELL_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only intercept GET. Mutations always hit the network.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Don't touch Supabase API calls — they're stateful + auth-bound.
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) return;

  // Same-origin app-shell requests: cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          // Cache only successful 200 OPAQUE-not responses for the shell.
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached); // network dead + no cache → undefined → browser default
      }),
    );
    return;
  }

  // Cross-origin (CDN, fonts) — network-first with cache fallback.
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req)),
  );
});
