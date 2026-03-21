// Tax Adviser Arena — Service Worker
// Cache-first for app shell, network-first for CDN scripts

const CACHE_NAME = 'taa-v1';

const SHELL_FILES = [
  '/',
  '/index.html',
  '/teacher.html',
  '/css/common.css',
  '/css/student.css',
  '/css/teacher.css',
  '/js/config.js',
  '/js/db.js',
  '/js/simulation.js',
  '/js/scoring.js',
  '/js/charts.js',
  '/js/student-app.js',
  '/js/teacher-app.js',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CDN scripts: network-first with cache fallback
  if (url.hostname !== location.hostname) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
