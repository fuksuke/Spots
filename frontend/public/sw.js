const CACHE_NAME = 'shibuya-livemap-api-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => undefined);

      if (cachedResponse) {
        event.waitUntil(fetchPromise);
        return cachedResponse;
      }

      return fetchPromise.catch(() => new Response(JSON.stringify({ message: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }));
    })
  );
});
