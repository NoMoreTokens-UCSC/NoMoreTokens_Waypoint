import { useState } from 'react'
import { useApis } from '../providers/ApisContext'
import { useAction } from './useOperations'

/** Public VAPID key only. The private key belongs exclusively on the backend. */
export function useWebPushSubscription(outletId?: string, refreshPermission?: () => void) {
  const apis = useApis(),
    action = useAction()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string>()
  const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined
  async function connect() {
    setConnecting(true)
    setError(undefined)
    try {
      if (!publicKey || !outletId || !('PushManager' in window))
        throw new Error('Remote push is not configured for this browser.')
      if ((await Notification.requestPermission()) !== 'granted')
        throw new Error('Allow notification permission before connecting remote push.')
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration?.active)
        throw new Error('Open the production PWA online before connecting push.')
      const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/')
      const bytes = Uint8Array.from(
        atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
        (char) => char.charCodeAt(0),
      )
      if (bytes.length !== 65 || bytes[0] !== 4)
        throw new Error('Configure a valid public VAPID key.')
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }))
      const json = subscription.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
        throw new Error('The browser did not return a complete push subscription.')
      await action.mutateAsync(() =>
        apis.driverSignals.registerPushSubscription({
          outletId,
          endpoint: json.endpoint!,
          expirationTime: json.expirationTime ?? null,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
          createdAt: new Date().toISOString(),
        }),
      )
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Push could not be connected.')
    } finally {
      refreshPermission?.()
      setConnecting(false)
    }
  }
  return {
    configured: !!publicKey && window.isSecureContext && 'PushManager' in window,
    busy: connecting || action.isPending,
    connect,
    error,
  }
}
