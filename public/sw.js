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

const CACHE_VERSION = 'v2';
const SHELL_CACHE = `deggzy-shell-${CACHE_VERSION}`;

// Paths relative to the SW scope (GitHub Pages serves under /Deggzy-Team/).
// NOTE: Vite-hashed asset URLs (assets/main-*.js, assets/manifest-*.json)
// change every build, so we DON'T list them here — the runtime fetch
// handler caches them cache-first on first load. The shell list is
// only paths we KNOW are stable.
const SHELL_URLS = [
  './',
  './index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Per-URL add with isolated catch: a single 404 must NOT abort the
      // whole pre-cache (v1's atomic addAll bug). Failed entries are
      // logged but the rest of the shell still lands in the cache.
      await Promise.all(
        SHELL_URLS.map((u) =>
          cache.add(new Request(u, { cache: 'reload' })).catch((err) => {
            console.warn('[sw] failed to pre-cache', u, '—', err);
          }),
        ),
      );
      await self.skipWaiting();
    })(),
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
