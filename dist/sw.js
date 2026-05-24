const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('outback-shell-v1').then((cache) =>
      cache.addAll([OFFLINE_URL, '/favicon.png', '/logo.webp'])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(OFFLINE_URL).then((r) => r || new Response('Offline', { status: 503 }))
    )
  );
});
