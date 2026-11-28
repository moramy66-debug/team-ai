const CACHE_NAME = 'teamai-v176';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/key-session.js',
  './js/source-info.js',
  './js/review-prompt.js',
  './js/projects.js',
  './js/storage-idb.js',
  './js/sanitize.js',
  './js/robust.js',
  './guide.html',
  './css/styles.css',
  './js/codes-and-templates.js',
  './js/files-and-export.js',
  './js/orchestrator.js',
  './js/code-search.js', './js/app.js', './js/team-extras.js', './js/pro-tools.js', './js/project-header.js', './js/eng-tables.js', './js/eng-calc.js', './js/eng-ui.js', './js/eng-shortcircuit-ui.js', './js/eng-isc.js', './js/eng-cablecalc.js', './js/eng-crosscheck.js', './js/eng-pdf.js', './js/eng-submittal.js', './js/eng-loadschedule.js', './data/eng-tables.json', './codes-data.json', './js/eng-pfc-cpc.js', './js/eng-sld.js', './js/eng-ups.js', './js/a11y-polish.js', './js/ui-tidy.js', './js/eng-lighting.js', './js/eng-cabletray.js', './js/eng-transformer.js', './js/eng-generator.js', './js/code-library.js', './data/code-library.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS).then(() => cache.add(new Request('https://cdn.jsdelivr.net/npm/dompurify@3.5.0/dist/purify.min.js', { mode: 'cors' })).catch(() => {})))
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
  const TRUSTED_CDN_HOSTS = new Set(['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com']); if (TRUSTED_CDN_HOSTS.has(url.hostname)) { event.respondWith(caches.open(CACHE_NAME).then(async (cache) => { const cached = await cache.match(request); const net = fetch(request).then((res) => { if (res && (res.ok || res.type === 'opaque')) event.waitUntil(cache.put(request, res.clone()).catch(() => {})); return res; }).catch(() => cached); return cached || net; })); return; } if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const fromCache = () => caches.match(request, { ignoreSearch: true });
    const net = fetch(request).then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        const copy = networkResponse.clone();
        const put = caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        try { event.waitUntil(put); } catch (_) {}
      }
      return networkResponse;
    });
    // On a slow connection, serve the cached copy after 4s (the network fetch keeps going and refreshes the cache).
    const slow = new Promise((resolve) => setTimeout(async () => {
      const cached = await fromCache();
      if (cached) resolve(cached);
    }, 4000));
    try {
      return await Promise.race([net, slow]);
    } catch (_) {
      const cached = await fromCache();
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
  })());
});
