// Service Worker ligero para habilitación PWA instalable en móviles (Android / iOS)
const CACHE_NAME = 'olga-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Nunca interceptar APIs, Firebase/Google Auth, Firestore ni streams
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@vite/')
  ) {
    return;
  }

  // Estrategia Network-First segura para mantener la consola siempre actualizada
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
