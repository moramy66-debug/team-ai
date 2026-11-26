const CACHE_NAME = 'teamai-v77';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/storage-idb.js',
  './js/sanitize.js',
  './css/styles.css',
  './js/codes-and-templates.js',
  './js/files-and-export.js',
  './js/orchestrator.js',
  './js/code-search.js', './js/app.js', './js/team-extras.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('teamai-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const TRUSTED_CDN_HOSTS = new Set(['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com']); if (TRUSTED_CDN_HOSTS.has(url.hostname)) { event.respondWith(caches.open(CACHE_NAME).then(async (cache) => { const cached = await cache.match(request); const net = fetch(request).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone()); return res; }).catch(() => cached); return cached || net; })); return; } if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
