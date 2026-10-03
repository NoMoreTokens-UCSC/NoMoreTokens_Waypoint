import { useQuery } from '@tanstack/react-query'
import type { Apis } from '../../domain/api'
import { useApis } from '../providers/ApisContext'
import { snapshotKey } from './useOperations'

/**
 * Reads data through the API contract. Keys nest under the snapshot key, so any write made
 * with useAction() (or by another tab) refreshes every API query. Pair with useAction() for
 * writes: `action.run(() => apis.orders.confirmReceipt(id), 'Receipt confirmed')`.
 */
export function useApiQuery<T>(key: readonly unknown[], read: (apis: Apis) => Promise<T>) {
  const apis = useApis()
  return useQuery({
    queryKey: [...snapshotKey, 'api', ...key],
    queryFn: () => read(apis),
    networkMode: 'always',
  })
}
