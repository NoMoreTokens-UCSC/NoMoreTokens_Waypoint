import { useEffect, useMemo } from 'react'
import type { Order, Stop } from '../../../../domain/models'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useStoreStops } from './useStore'

/** The driver's proof for an order: the stop it was delivered at and the photograph taken. */
export function useProof(order?: Order) {
  const { stops } = useStoreStops()
  const stop: Stop | undefined = order
    ? stops.find((candidate) => candidate.orderIds.includes(order.id))
    : undefined
  // React Query does not accept `undefined` as a result, so "no photo" is null.
  const evidence = useApiQuery(['evidence', stop?.proofId ?? 'none'], async (apis) =>
    stop?.proofId ? ((await apis.delivery.getEvidence(stop.proofId)) ?? null) : null,
  )
  const photo = evidence.data?.photo
  const url = useMemo(() => (photo ? URL.createObjectURL(photo) : undefined), [photo])
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )
  return { stop, url, capturedAt: evidence.data?.createdAt }
}
