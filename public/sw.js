const CACHE_NAME = 'poongsung-ieum-v2'

const STATIC_ASSETS = [
  '/home',
  '/logo.svg',
  '/avatar-default.svg',
  '/avatar-soldier.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── 웹 푸시 알림 ──
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: '풍성이음', body: event.data.text() } }

  const { title = '풍성이음', body = '', url = '/notifications' } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/logo.svg',
      badge: '/logo.svg',
      data: { url },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/home'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.focus(); client.navigate?.(url); return }
      }
      return clients.openWindow(url)
    })
  )
})

self.addEventListener('fetch', (event) => {
  // API / Supabase 요청은 캐시 안 함
  const url = new URL(event.request.url)
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    event.request.method !== 'GET'
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((res) => {
        // 정적 에셋만 캐시
        if (res.ok && (url.pathname.startsWith('/_next/static/') || url.pathname.endsWith('.svg'))) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return res
      }).catch(() => {
        // 오프라인 시 홈 페이지 캐시 반환
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/home') ?? Response.error()
        }
        return Response.error()
      })
    })
  )
})
