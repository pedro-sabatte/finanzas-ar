// Service Worker — Form PWA
// Cache-first para assets estáticos, network-first para la API

const CACHE_NAME = 'finanzas-form-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  '../shared/api-client.js',
  '../shared/formatters.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;1,8..60,400&display=swap',
  'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // La API de Apps Script siempre network-first
  if (e.request.url.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ ok: false, message: 'Sin conexión' }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // Assets estáticos: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return resp;
    }))
  );
});
