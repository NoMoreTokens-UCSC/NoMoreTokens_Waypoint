import { useQueryClient } from '@tanstack/react-query'
import { snapshotKey, useAction } from '../../../hooks/useOperations'

/**
 * Like useAction(), plus `runThen`: do the work, wait for every screen's data to refresh, and only
 * then continue (usually navigating). Without the wait, the next screen briefly sees the old
 * order and, for example, sends the person back because receipt "is not confirmed yet".
 */
export function useStoreAction() {
  const action = useAction()
  const client = useQueryClient()
  return {
    ...action,
    runThen: (work: () => Promise<unknown>, next: () => void, message?: string) =>
      action.run(async () => {
        await work()
        await client.invalidateQueries({ queryKey: snapshotKey })
        next()
      }, message),
  }
}
