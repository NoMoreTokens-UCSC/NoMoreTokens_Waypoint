import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApis } from '../../../providers/ApisContext'
import { snapshotKey } from '../../../hooks/useOperations'
import type { QueuedAction } from '../../../../domain/models'

/** Resume pending records; failed uploads always need an explicit retry decision. */
export function useDriverAutoSync(online: boolean, queue: QueuedAction[]) {
  const apis = useApis(),
    client = useQueryClient()
  const running = useRef(false)
  const attempted = useRef(new Set<string>())
  const [syncError, setSyncError] = useState('')
  const pendingKey = queue
    .filter((record) => record.status === 'pending')
    .map((record) => `${record.id}:${record.revision}:${record.attempts}`)
    .join('|')
  const syncing = queue.some((record) => record.status === 'syncing')
  useEffect(() => {
    if (!online || !pendingKey || syncing || running.current || attempted.current.has(pendingKey))
      return

    function triggerSync() {
      if (running.current) return
      running.current = true
      attempted.current.add(pendingKey)
      void apis.delivery
        .sync(true, { retryFailed: false })
        .then(() => setSyncError(''))
        .catch((error: unknown) => {
          setSyncError(
            error instanceof Error
              ? error.message
              : 'Upload interrupted. Your evidence remains saved.',
          )
        })
        .finally(() => {
          running.current = false
          void client.invalidateQueries({ queryKey: snapshotKey })
          void client.invalidateQueries({ queryKey: ['driver'] })
        })
    }

    triggerSync()

    const interval = setInterval(triggerSync, 30_000)
    window.addEventListener('online', triggerSync)
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', triggerSync)
    }
  }, [online, pendingKey, syncing, apis, client])
  return pendingKey ? syncError : ''
}
