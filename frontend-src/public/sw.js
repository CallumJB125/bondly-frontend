// Bondly Service Worker — cache assets, never cache HTML
// Bump CACHE_NAME on every deploy to evict stale old-bundle references.
const CACHE_NAME = 'bondly-v4';

self.addEventListener('install', e => {
  // Pre-cache nothing on install — assets are cached on first fetch below.
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete every cache except the current one (evicts bondly-v2 stale caches).
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return; // never cache API calls

  const url = new URL(e.request.url);

  // Never cache HTML — always fetch fresh so JS chunk references are current.
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first for everything else (fonts, icons, hashed JS/CSS bundles).
  // Hashed filenames mean cached chunks are always valid until evicted.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
