import { useQueryClient } from '@tanstack/react-query'
import { useApis } from '../../../providers/ApisContext'
import { snapshotKey, useAction } from '../../../hooks/useOperations'
import { enqueue, type OutboxRequest } from './outbox'
import { perform } from './outboxSend'
import { useOnline } from './useOnline'
import { useStoreOutlet } from './useStore'

/**
 * Like useAction(), plus `runThen`: do the work, wait for every screen's data to refresh, and only
 * then continue (usually navigating). Without the wait, the next screen briefly sees the old
 * order and, for example, sends the person back because receipt "is not confirmed yet".
 *
 * `send` is for changes the store makes: online it is sent now; offline it is saved in the outbox
 * and sent when the connection returns, and the person carries on as if it had gone.
 */
export function useStoreAction() {
  const action = useAction()
  const client = useQueryClient()
  const apis = useApis()
  const online = useOnline()
  const outletId = useStoreOutlet()
  const runThen = (work: () => Promise<unknown>, next: () => void, message?: string) =>
    action.run(async () => {
      await work()
      await client.invalidateQueries({ queryKey: snapshotKey })
      next()
    }, message)
  return {
    ...action,
    runThen,
    send: (request: OutboxRequest, title: string, next: () => void) => {
      if (online) return runThen(() => perform(apis, outletId, request), next)
      enqueue(outletId, request, title)
      next()
    },
  }
}
