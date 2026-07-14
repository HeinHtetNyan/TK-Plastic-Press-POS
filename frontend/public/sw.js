/**
 * TK Plastic Press — Service Worker
 *
 * Strategy:
 *   - App shell (HTML / JS / CSS / images): network-first with cache fallback
 *     so users always get the latest build but still work when offline.
 *   - API calls (/api/*): network-only. The app itself handles offline via
 *     IndexedDB; we never serve stale API responses from cache.
 *
 * Cache versioning: bump CACHE_VERSION when deploying a new build so
 * stale caches are cleaned up automatically.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `tk-pos-${CACHE_VERSION}`;

// Assets to pre-cache on install (minimal shell)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API calls — always network-only
  if (url.pathname.startsWith('/api/') || url.port === '8001') return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // Network-first strategy for everything else
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache a clone of successful responses
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(() =>
        // Network failed — try cache
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, fall back to the cached root (SPA)
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Service unavailable', { status: 503 });
        })
      )
  );
});
