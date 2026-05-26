// Comms Queue Service Worker — v3
// v3: Never cache index.html — always fetch fresh from network
// Only cache static assets (icons, fonts, manifest)

const CACHE_NAME = 'comms-queue-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install ──
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ── Activate: delete all old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // NEVER cache index.html or root — always go to network
  // This ensures the latest code is always served
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline fallback — serve cached version if available
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Static assets — cache first
  if (url.origin === self.location.origin || 
      url.hostname === 'fonts.googleapis.com' || 
      url.hostname === 'fonts.gstatic.com' ||
      url.hostname === 'cdn.jsdelivr.net') {
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
  }
});

// ── Allow app to trigger update ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
