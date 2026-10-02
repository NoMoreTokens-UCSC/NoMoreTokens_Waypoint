import { useMemo } from 'react'
import type { Order, Temperature } from '../../../../domain/models'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useSession } from '../../../session/useSession'
import { applyOutbox, useOutbox, type StoreOrder } from './outbox'
import { temperatures } from './orderView'

/** The outlet this person manages, from their session ('' when none is assigned). */
export function useStoreOutlet() {
  return useSession().outletId ?? ''
}

/** This outlet's orders, newest data first, split by temperature as the store places them. */
export function useStoreOrders() {
  const outletId = useStoreOutlet()
  // Without an outlet nothing is requested: an empty filter would return every outlet's orders.
  const query = useApiQuery(['orders', outletId], async (apis) =>
    outletId ? apis.orders.listOrders({ outletId }) : [],
  )
  const outbox = useOutbox(outletId)
  // Changes waiting to be sent already show, marked `pendingSync`.
  const orders: StoreOrder[] = useMemo(
    () => applyOutbox(query.data ?? [], outbox),
    [query.data, outbox],
  )
  const byTemperature = (temperature: Temperature) =>
    orders.find((order) => order.temperature === temperature)
  return { ...query, orders, outletId, byTemperature, loaded: query.data !== undefined }
}

/** The outlet's brand, schedule and receiving limits; Fresh until they have loaded. */
export function useStoreProfile() {
  const outletId = useStoreOutlet()
  const query = useApiQuery(['outlet', outletId], async (apis) =>
    outletId ? apis.orders.getOutletProfile(outletId) : null,
  )
  return { profile: query.data ?? undefined, loaded: query.data !== undefined }
}

export function useStoreStops() {
  const outletId = useStoreOutlet()
  const query = useApiQuery(['stops', outletId], async (apis) =>
    outletId ? apis.delivery.listStops({ outletId }) : [],
  )
  return { ...query, stops: query.data ?? [] }
}

/** Earlier orders for this outlet, newest delivery day first. */
export function useStoreHistory() {
  const outletId = useStoreOutlet()
  const query = useApiQuery(['history', outletId], async (apis) =>
    outletId ? apis.orders.listHistory({ outletId }) : [],
  )
  return { ...query, history: query.data ?? [], loaded: query.data !== undefined }
}

export function useStoreDrafts() {
  const query = useApiQuery(['drafts'], (apis) => apis.orders.listDrafts())
  return { ...query, drafts: query.data ?? [] }
}

/** Deferred orders the store should hear about. */
export const deferredOrders = (orders: Order[]) =>
  orders.filter((order) => order.status === 'Deferred')

/** The order a delivery screen is about: the one in the URL, else the first on its way. */
export function pickActiveOrder(orders: Order[], requested?: string | null) {
  const live = orders.filter((order) => order.status !== 'Deferred')
  return (
    live.find((order) => order.id === requested) ??
    live.find((order) => order.status !== 'Confirmed' && order.status !== 'Allocated') ??
    live.find((order) => temperatures.includes(order.temperature))
  )
}
