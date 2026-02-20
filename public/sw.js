const CACHE_VERSION = 'v4'
const STATIC_CACHE = `kaloritrack-static-${CACHE_VERSION}`
const PAGES_CACHE = `kaloritrack-pages-${CACHE_VERSION}`
const DATA_CACHE = `kaloritrack-data-${CACHE_VERSION}`
const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, DATA_CACHE]

// Background Sync tag
const SYNC_TAG = 'kaloritrack-sync'

// App shell pages to precache for offline navigation
const APP_SHELL_PAGES = [
  '/',
  '/dashboard',
  '/food',
  '/products',
  '/profile',
  '/body',
]

// Static assets to precache
const PRECACHE_STATIC = [
  '/manifest.json',
  '/icons/icon-192x192.jpg',
  '/icons/icon-512x512.jpg',
]

// ─── Install: precache app shell + static assets ───

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(PAGES_CACHE).then((cache) =>
        Promise.allSettled(
          APP_SHELL_PAGES.map((url) =>
            fetch(url, { credentials: 'same-origin' })
              .then((res) => {
                if (res.ok) return cache.put(url, res)
              })
              .catch(() => {})
          )
        )
      ),
      caches.open(STATIC_CACHE).then((cache) =>
        Promise.allSettled(
          PRECACHE_STATIC.map((url) =>
            fetch(url, { credentials: 'same-origin' })
              .then((res) => {
                if (res.ok) return cache.put(url, res)
              })
              .catch(() => {})
          )
        )
      ),
    ])
  )
  self.skipWaiting()
})

// ─── Activate: clean old caches ───

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith('kaloritrack-') && !ALL_CACHES.includes(name))
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch strategies ───

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-http(s) and browser extensions
  if (!url.protocol.startsWith('http')) return

  // ── Non-GET requests (POST/DELETE): let through, don't intercept ──
  // The client-side offline layer (api-storage + sync-manager) handles
  // queueing mutations in IndexedDB. We don't intercept writes here
  // because the client needs the response body for optimistic updates.
  if (request.method !== 'GET') return

  // ── GET /api/data: network-first with data cache ──
  if (url.pathname.startsWith('/api/data')) {
    event.respondWith(networkFirstData(request))
    return
  }

  // ── Other API routes: network-only (auth, AI parsing, barcode) ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'Offline', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    return
  }

  // ── Next.js static chunks (_next/static): cache-first (immutable) ──
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(cacheFirstImmutable(request, STATIC_CACHE))
    return
  }

  // ── Static assets: stale-while-revalidate ──
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|ico|mp3|glb|gltf)$/)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  // ── Page navigations: network-first with offline shell fallback ──
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstPage(request))
    return
  }

  // ── Default: stale-while-revalidate ──
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
})

// ─── Strategy implementations ───

async function networkFirstData(request) {
  const cache = await caches.open(DATA_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function cacheFirstImmutable(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => null)
  if (cached) return cached
  const response = await fetchPromise
  return response || new Response('Offline', { status: 503 })
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    const url = new URL(request.url)
    const pathCached = await cache.match(url.pathname)
    if (pathCached) return pathCached
    const fallback = await cache.match('/dashboard')
    if (fallback) return fallback
    return new Response(offlineHTML(), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

// ─── Background Sync API ───
// When the browser regains connectivity, it fires this event.
// We notify all clients so the sync manager can process the queue.

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(notifyClientsToSync())
  }
})

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage({ type: 'SW_SYNC_TRIGGER' })
  }
}

// ─── Messages from client ───

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
  if (event.data === 'clearCaches') {
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name)))
    )
  }
  // Client requests a Background Sync registration
  if (event.data === 'registerSync') {
    if (self.registration.sync) {
      self.registration.sync.register(SYNC_TAG).catch(() => {})
    }
  }
})

// ─── Offline fallback HTML ───

function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>КалориТрек - Офлайн</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#1e293b;padding:1rem}
    .c{text-align:center;max-width:360px}
    h1{font-size:1.25rem;font-weight:600;margin-bottom:0.5rem}
    p{color:#64748b;font-size:0.875rem;line-height:1.5;margin-bottom:1.5rem}
    button{background:#3b82f6;color:#fff;border:none;padding:0.625rem 1.25rem;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer}
    button:active{background:#2563eb}
  </style>
</head>
<body>
  <div class="c">
    <h1>Нет подключения</h1>
    <p>Ваши данные сохранены локально и будут синхронизированы при восстановлении соединения.</p>
    <button onclick="location.reload()">Повторить</button>
  </div>
</body>
</html>`
}
