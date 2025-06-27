let CACHE_NAME = 'pwacache-default';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    fetch('./version.json', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        CACHE_NAME = `pwacache-v${data.version}`;
        return caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE));
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
  clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
