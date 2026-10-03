const VERSION = '__VERSION__';
const CORE = __PRECACHE__;
const CORE_CACHE = `ringoos-core-${VERSION}`;
const ART_CACHE = 'ringoos-art-v1';
const NAV_TIMEOUT = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('ringoos-core-') && key !== CORE_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function navigate(request) {
  try {
    const response = await withTimeout(fetch(request), NAV_TIMEOUT);
    if (response.ok) {
      const cache = await caches.open(CORE_CACHE);
      cache.put('index.html', response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match('index.html', { ignoreSearch: true });
    return cached || Response.error();
  }
}

async function art(request) {
  const cache = await caches.open(ART_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function asset(request) {
  const hit = await caches.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CORE_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }
  if (url.pathname.includes('/characters/')) {
    event.respondWith(art(request));
    return;
  }
  event.respondWith(asset(request));
});
