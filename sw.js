// Comms Queue Service Worker — v2
// Bumped to v2 to force-clear all v1 caches that were serving stale pre-Supabase code.

const CACHE_NAME = 'comms-queue-v2';

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install: cache app shell immediately ──
self.addEventListener('install', event => {
  self.skipWaiting(); // activate immediately, don't wait
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
});

// ── Activate: delete ALL old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// ── Fetch: network-first for HTML, cache-first for assets ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;
  const isFonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (event.request.method !== 'GET' || (!isLocal && !isFonts)) return;

  // Always go network-first for HTML navigation requests
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for everything else (fonts, icons, manifest)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── Allow app to trigger update ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
