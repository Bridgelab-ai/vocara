const CACHE = 'vocara-v1'
const STATIC = ['/', '/index.html']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  // Don't intercept API calls, Firebase, or cross-origin
  if (url.pathname.startsWith('/api/') || url.host !== self.location.host) return

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      // Network-first for navigation, cache-first for assets
      if (e.request.mode === 'navigate') {
        try {
          const res = await fetch(e.request)
          cache.put(e.request, res.clone())
          return res
        } catch {
          return cache.match('/index.html') || cache.match('/')
        }
      }
      const cached = await cache.match(e.request)
      if (cached) return cached
      try {
        const res = await fetch(e.request)
        if (res.ok && e.request.method === 'GET') cache.put(e.request, res.clone())
        return res
      } catch {
        return new Response('Offline', { status: 503 })
      }
    })
  )
})
