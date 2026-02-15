const CACHE_VERSION = 'v3'
const STATIC_CACHE = `kaloritrack-static-${CACHE_VERSION}`
const PAGES_CACHE = `kaloritrack-pages-${CACHE_VERSION}`
const DATA_CACHE = `kaloritrack-data-${CACHE_VERSION}`
const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, DATA_CACHE]

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
      // Precache pages individually (don't fail all if one fails)
      caches.open(PAGES_CACHE).then((cache) =>
        Promise.allSettled(
          APP_SHELL_PAGES.map((url) =>
            fetch(url, { credentials: 'same-origin' })
              .then((res) => {
                if (res.ok) return cache.put(url, res)
              })
              .catch(() => {}) // Silently skip failed pages
          )
        )
      ),
      // Precache static assets
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

  // Skip non-GET, non-http(s), and browser extensions
  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return

  // --- Strategy 1: API data routes --- 
  // Network-first, cache the latest response for offline reads
  if (url.pathname.startsWith('/api/data')) {
    event.respondWith(networkFirstWithDataCache(request))
    return
  }

  // --- Strategy 2: Other API routes --- 
  // Network-only (auth, AI parsing, etc.)
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

  // --- Strategy 3: Next.js static chunks (_next/static) ---
  // Cache-first (these are content-hashed, immutable)
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(cacheFirstImmutable(request, STATIC_CACHE))
    return
  }

  // --- Strategy 4: Static assets (images, fonts, icons) ---
  // Stale-while-revalidate
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|ico|mp3|glb|gltf)$/)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  // --- Strategy 5: Page navigations ---
  // Network-first with cached fallback
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstPage(request))
    return
  }

  // --- Default: stale-while-revalidate ---
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
})

// ─── Strategy implementations ───

async function networkFirstWithDataCache(request) {
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
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  // Fire off revalidation in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  // Return cached immediately, or wait for network
  if (cached) return cached
  const response = await fetchPromise
  return response || new Response('Offline', { status: 503 })
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Try exact URL match
    const cached = await cache.match(request)
    if (cached) return cached

    // Try matching just the pathname (for navigations with query params)
    const url = new URL(request.url)
    const pathCached = await cache.match(url.pathname)
    if (pathCached) return pathCached

    // Fallback to dashboard as the offline shell
    const fallback = await cache.match('/dashboard')
    if (fallback) return fallback

    // Last resort: offline HTML
    return new Response(offlineHTML(), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

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
    .icon{font-size:3rem;margin-bottom:1rem}
    h1{font-size:1.25rem;font-weight:600;margin-bottom:0.5rem}
    p{color:#64748b;font-size:0.875rem;line-height:1.5;margin-bottom:1.5rem}
    button{background:#3b82f6;color:#fff;border:none;padding:0.625rem 1.25rem;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer}
    button:active{background:#2563eb}
  </style>
</head>
<body>
  <div class="c">
    <div class="icon">&#128268;</div>
    <h1>Нет подключения</h1>
    <p>Приложение не может загрузить данные. Проверьте интернет-соединение и попробуйте снова.</p>
    <button onclick="location.reload()">Повторить</button>
  </div>
</body>
</html>`
}

// ─── Background sync for offline writes ───

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
  // Allow manual cache clear
  if (event.data === 'clearCaches') {
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name)))
    )
  }
})
