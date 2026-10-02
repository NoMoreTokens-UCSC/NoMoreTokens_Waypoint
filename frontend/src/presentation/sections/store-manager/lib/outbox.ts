import { useSyncExternalStore } from 'react'
import type { ReceiptIssue } from '../../../../domain/api/orders'
import type { Order, StoreOrderInput } from '../../../../domain/models'

/**
 * Changes the store makes while it has no connection. Each one is saved on this device, shown as
 * "waiting to send", and sent in order when the connection returns (`useOutboxSync`). The screens see
 * a waiting change as already made (`applyOutbox`), so the person can carry on working.
 *
 * Kept in localStorage so a change survives closing the tab. A backend replaces nothing here: the
 * requests are sent through the same `OrdersApi` calls as an online change.
 */
export type OutboxRequest =
  | { kind: 'orders'; inputs: StoreOrderInput[] }
  | { kind: 'receipt'; orderId: string }
  | { kind: 'issue'; orderId: string; issue: ReceiptIssue }
  | { kind: 'acknowledge'; orderId: string }
  | { kind: 'cancel'; orderId: string }
  | { kind: 'profile'; memberId: string; name: string; mobile: string; email: string }

/** waiting: not sent yet · sending · failed: needs the person · draft: arrived after the cutoff. */
export type OutboxStatus = 'waiting' | 'sending' | 'failed' | 'draft'
export interface OutboxItem {
  id: string
  outletId: string
  request: OutboxRequest
  /** What the person did, in their words: "Confirm 2 Fresh orders". */
  title: string
  createdAt: string
  status: OutboxStatus
  message?: string
}

/** An order as the store screens see it: possibly changed by something not sent yet. */
export type StoreOrder = Order & { pendingSync?: boolean }

const key = 'waypoint.store.outbox'
let items: OutboxItem[] | undefined
const listeners = new Set<() => void>()

function load(): OutboxItem[] {
  if (items) return items
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '[]') as OutboxItem[]
    // A send interrupted by closing the tab starts again.
    items = stored.map((item) =>
      item.status === 'sending' ? { ...item, status: 'waiting' } : item,
    )
  } catch {
    items = []
  }
  return items
}
function save(next: OutboxItem[]) {
  items = next
  try {
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // Storage can be blocked; the outbox then lasts as long as the page.
  }
  listeners.forEach((listener) => listener())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  const reload = (event?: Event) => {
    if (event instanceof StorageEvent && event.key !== key) return
    items = undefined
    listener()
  }
  // Another tab changed the outbox, or the demo was reset.
  const reset = () => save([])
  window.addEventListener('storage', reload)
  window.addEventListener('waypoint:demo-reset', reset)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', reload)
    window.removeEventListener('waypoint:demo-reset', reset)
  }
}

export function enqueue(outletId: string, request: OutboxRequest, title: string) {
  save([
    ...load(),
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      outletId,
      request,
      title,
      createdAt: new Date().toISOString(),
      status: 'waiting',
    },
  ])
}
export function setItem(id: string, patch: Partial<OutboxItem>) {
  save(load().map((item) => (item.id === id ? { ...item, ...patch } : item)))
}
export function removeItem(id: string) {
  save(load().filter((item) => item.id !== id))
}
/** Waiting changes for an outlet, oldest first. */
export const waitingItems = (outletId: string) =>
  load().filter((item) => item.outletId === outletId && item.status === 'waiting')

/** This outlet's unsent changes, oldest first. */
export function useOutbox(outletId: string) {
  const all = useSyncExternalStore(subscribe, load)
  return all.filter((item) => item.outletId === outletId)
}

const isWaiting = (item: OutboxItem) => item.status === 'waiting' || item.status === 'sending'

/** The orders as they will be once the waiting changes are sent. */
export function applyOutbox(orders: Order[], outbox: OutboxItem[]): StoreOrder[] {
  let result: StoreOrder[] = orders
  const change = (orderId: string, patch: Partial<StoreOrder>) => {
    result = result.map((order) =>
      order.id === orderId ? { ...order, ...patch, pendingSync: true } : order,
    )
  }
  for (const item of outbox.filter(isWaiting)) {
    const { request } = item
    if (request.kind === 'orders') {
      // Tech orders stand alone (a new one is added unless an existing order is changed).
      const tech = result[0]?.brand === 'Tech'
      for (const input of request.inputs) {
        const existing = input.orderId
          ? result.find((order) => order.id === input.orderId)
          : tech
            ? undefined
            : result.find((order) => order.temperature === input.temperature)
        // `orderId` only says which order is being changed; it is not an order field.
        const fields = { ...input, orderId: undefined }
        const placed: StoreOrder = {
          ...(existing ?? {
            id: tech
              ? `PENDING-${item.id}`
              : `PENDING-${input.temperature === 'Chilled' ? 'C' : 'A'}`,
            outlet: item.outletId,
            outletName: result[0]?.outletName ?? item.outletId,
            brand: result[0]?.brand ?? 'Fresh',
            priority: false,
            receipt: 'Pending',
          }),
          ...fields,
          status: 'Confirmed',
          vehicleId: undefined,
          trip: undefined,
          placedAt: item.createdAt,
          pendingSync: true,
        }
        result = existing
          ? result.map((order) => (order === existing ? placed : order))
          : [...result, placed]
      }
    } else if (request.kind === 'profile') {
      // Contact details are not part of an order; the page shows what is waiting.
    } else if (request.kind === 'cancel') {
      result = result.filter((order) => order.id !== request.orderId)
    } else if (request.kind === 'receipt') {
      change(request.orderId, { receipt: 'Confirmed', receiptAt: item.createdAt })
    } else if (request.kind === 'issue') {
      change(request.orderId, {
        receipt: 'Issue reported',
        receiptAt: item.createdAt,
        issue: `${request.issue.kind} goods: ${request.issue.description}`,
        receiptReport: { ...request.issue, recordedAt: item.createdAt },
      })
    } else {
      change(request.orderId, {
        deferralAcknowledged: true,
        deferralAcknowledgedAt: item.createdAt,
      })
    }
  }
  return result
}
