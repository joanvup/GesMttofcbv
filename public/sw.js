/*
 * Service Worker de la app FCBV SGC.
 *
 * Estrategia:
 * - App shell (HTML + estáticos con hash): cache-first con actualización en
 *   segundo plano; si la red falla, sirve la copia en caché para poder abrir la
 *   aplicación sin conexión.
 * - Navegación (SPA): network-first con respaldo en el `index.html` cacheado.
 * - Peticiones `/api/`: nunca se cachean aquí; los datos los gestiona la capa
 *   de IndexedDB (`src/services/offline.ts`) con su propia cola de escritura.
 */

const CACHE_NAME = 'fcbv-app-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET del mismo origen y fuera de /api/.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navegaciones: red primero, con respaldo del shell cacheado.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put('/index.html', response.clone());
          return response;
        } catch {
          const cached = (await caches.match('/index.html')) || (await caches.match('/'));
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Estáticos: cache-first con refresco en segundo plano.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
});
