// App-shell cache so the driver app opens without signal. TODO(T-021): precache routes and map tiles.
const CACHE = 'ag-driver-v1';
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/sync']))));
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));
