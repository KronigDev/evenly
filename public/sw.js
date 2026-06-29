/* eslint-disable */
/**
 * Evenly service worker (hand-written, no libraries).
 *
 * Strategies:
 *   - Navigations (HTML)            -> network-first, fall back to cached `/offline`.
 *   - Same-origin static assets     -> cache-first + stale-while-revalidate.
 *     (`/_next/static/`, `/icons/`)
 *   - Everything else / `/api/`     -> straight to network (never cached).
 *
 * Only successful, basic (same-origin) GET responses are ever written to the
 * cache; opaque/error responses are passed through untouched.
 */

const VERSION = 'v1';
const CACHE_NAME = `evenly-cache-${VERSION}`;
const OFFLINE_URL = '/offline';

// Minimal app shell precached on install so the offline page always works.
const PRECACHE_URLS = ['/offline', '/icons/icon-192.png', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // `addAll` is atomic; if any request fails the whole install fails, so we
      // add resiliently one-by-one and ignore individual misses.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response && response.ok) {
              await cache.put(url, response.clone());
            }
          } catch {
            /* network unavailable during install — non-fatal */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** A response we are allowed to persist (same-origin, 200, non-opaque). */
function isCacheable(response) {
  return (
    response &&
    response.ok &&
    response.status === 200 &&
    (response.type === 'basic' || response.type === 'default')
  );
}

/** Network-first for navigations; offline -> cached page, then `/offline`. */
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const network = await fetch(request);
    if (isCacheable(network)) {
      cache.put(request, network.clone());
    }
    return network;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('You are offline.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/** Cache-first with background revalidation (stale-while-revalidate). */
async function handleStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (isCacheable(response)) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    // Refresh in the background (fire-and-forget); serve the cached copy now.
    void networkPromise;
    return cached;
  }

  const network = await networkPromise;
  if (network) return network;
  return new Response('', { status: 504, statusText: 'Gateway Timeout' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch non-GET requests — always hit the network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin traffic; let the browser deal with cross-origin.
  if (url.origin !== self.location.origin) return;

  // Never cache API calls.
  if (url.pathname.startsWith('/api/')) return;

  // HTML navigations.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Static assets we own.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // Everything else: default browser handling (network).
});

// Allow the page to trigger an immediate activation after an update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
