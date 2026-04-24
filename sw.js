const CACHE = 'calibots2-home-studio-v9';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css?v=9',
  './content.js?v=9',
  './app.js?v=9',
  './manifest.webmanifest',
  './assets/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const normalizedRequest = requestUrl.pathname.endsWith('/')
    ? new Request('./index.html', { cache: 'reload' })
    : event.request;

  event.respondWith(
    fetch(normalizedRequest)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
