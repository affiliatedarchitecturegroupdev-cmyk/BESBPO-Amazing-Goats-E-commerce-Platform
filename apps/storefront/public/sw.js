// Storefront service worker (T-064): a minimal app-shell cache so the shop
// opens and the last-visited pages still render on a flaky connection. It is a
// deliberately small, network-first shell: pages always try the network, and the
// cache is the fallback, so prices and stock are never stale when online.
const CACHE = 'ag-store-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});
