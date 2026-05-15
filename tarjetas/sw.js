const CACHE_NAME = 'finanzas-tarjetas-v1';
const STATIC_ASSETS = ['./', './index.html', './app.js', './manifest.json', '../shared/api-client.js', '../shared/formatters.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS).catch(() => {})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.url.includes('script.google.com') || e.request.url.includes('fonts.googleapis.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
