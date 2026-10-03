/* Imported by the generated service worker. The backend owns push authentication,
   subscription registration, expiry and delivery; payloads contain no proof tokens. */
self.addEventListener('push', (event) => {
  let payload
  try {
    payload = event.data?.json()
  } catch {
    return
  }
  if (!payload || typeof payload.title !== 'string' || typeof payload.message !== 'string') return
  event.waitUntil(
    self.registration.showNotification(payload.title.slice(0, 120), {
      body: payload.message.slice(0, 500),
      icon: '/icons/icon-192.png',
      tag: typeof payload.id === 'string' ? payload.id : 'delivery-update',
      data: { url: '/store-manager/alerts' },
    }),
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL('/store-manager/alerts', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const client = windows.find((item) => new URL(item.url).origin === self.location.origin)
      if (client) {
        await client.navigate(url)
        return client.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
