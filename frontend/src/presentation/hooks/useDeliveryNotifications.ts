import { useEffect, useState } from 'react'
import type { DeliveryNotice } from '../../domain/api/driverSignals'

const supported = () =>
  window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator
/** System notifications are optional; the persisted in-app inbox always works. */
export function useDeliveryNotifications(notices: DeliveryNotice[], enabled: boolean) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    supported() ? Notification.permission : 'unsupported',
  )
  const [error, setError] = useState<string>()
  async function enable() {
    setError(undefined)
    if (!supported()) {
      setPermission('unsupported')
      return
    }
    try {
      setPermission(await Notification.requestPermission())
    } catch {
      setError('Notification permission could not be requested. Use the in-app inbox.')
    }
  }
  useEffect(() => {
    if (!enabled || permission !== 'granted') return
    let alive = true
    async function notify() {
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration?.active) return
      for (const notice of notices.filter((item) => !item.readAt).slice(0, 3)) {
        if (!alive) return
        const key = `waypoint.delivery-notified.${notice.id}`
        if (localStorage.getItem(key)) continue
        await registration.showNotification(notice.title, {
          body: notice.message,
          icon: '/icons/icon-192.png',
          tag: notice.id,
          data: { url: '/store-manager/alerts' },
        })
        localStorage.setItem(key, '1')
      }
    }
    void notify().catch(() => {
      if (alive)
        setError('System notification could not be shown. Your alert remains in the inbox.')
    })
    return () => {
      alive = false
    }
  }, [notices, permission, enabled])
  return {
    permission,
    enable,
    error,
    refreshPermission: () => setPermission(supported() ? Notification.permission : 'unsupported'),
  }
}
