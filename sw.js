const CACHE = 'p2p-chat-v1'
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  if(request.method !== 'GET') return
  const url = new URL(request.url)
  // No cachear signaling (trackers, relays nostr)
  if(url.origin !== location.origin) return
  // Network-first para HTML/JS, cache-first para assets
  e.respondWith(
    fetch(request).then(res => {
      const copy = res.clone()
      caches.open(CACHE).then(c => c.put(request, copy)).catch(()=>{})
      return res
    }).catch(() => caches.match(request).then(r => r || caches.match('./index.html')))
  )
})
