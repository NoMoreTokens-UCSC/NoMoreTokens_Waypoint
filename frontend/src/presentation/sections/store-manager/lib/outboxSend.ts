import type { Apis } from '../../../../domain/api'
import type { OutboxRequest } from './outbox'

/** Sends one change through the API, exactly as an online action would. */
export function perform(apis: Apis, outletId: string, request: OutboxRequest) {
  switch (request.kind) {
    case 'orders':
      return apis.orders.placeOrders(outletId, request.inputs)
    case 'receipt':
      return apis.orders.confirmReceipt(request.orderId)
    case 'issue':
      return apis.orders.reportReceiptIssue(request.orderId, request.issue)
    case 'profile':
      return apis.team.updateContact(request.memberId, {
        name: request.name,
        mobile: request.mobile,
        email: request.email,
      })
    case 'cancel':
      return apis.orders.cancelOrder(request.orderId)
    case 'acknowledge':
      return apis.orders.acknowledgeDeferral(request.orderId)
  }
}

export type Delivery = { status: 'sent' } | { status: 'draft'; message: string }

/**
 * Sends a change that was made offline. Orders may arrive after the cutoff: the booklet says late
 * demand waits for the next run, so they are kept as drafts instead of being refused.
 */
export async function deliver(
  apis: Apis,
  outletId: string,
  request: OutboxRequest,
): Promise<Delivery> {
  if (request.kind === 'orders') {
    const intake = await apis.orders.getIntakeStatus()
    if (intake.cutoffClosed || intake.published) {
      await apis.orders.saveDrafts(outletId, request.inputs)
      return {
        status: 'draft',
        message:
          'The cutoff passed before this could be sent, so it was kept as a draft for the next run.',
      }
    }
  }
  await perform(apis, outletId, request)
  return { status: 'sent' }
}
