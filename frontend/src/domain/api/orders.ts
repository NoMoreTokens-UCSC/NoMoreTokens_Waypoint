import type { Order, OrderStatus, Snapshot, StoreOrderInput, Temperature } from '../models'

export type OrderDraft = Snapshot['drafts'][number]
export interface OrderFilter {
  outletId?: string
  status?: OrderStatus
}
export interface IntakeStatus {
  /** True after the 4 PM cutoff: new demand becomes a draft for the next run. */
  cutoffClosed: boolean
  /** True once the dispatcher publishes the plan; orders can no longer be edited. */
  published: boolean
}
export interface ReceiptIssue {
  kind: 'Missing' | 'Damaged'
  received: number
  affected: number
  description: string
}

/** Store demand from placement to receipt. Used by the store manager; read by planning. */
export interface OrdersApi {
  listOrders(filter?: OrderFilter): Promise<Order[]>
  /** Earlier orders for the outlet, newest delivery day first. */
  listHistory(filter?: { outletId?: string }): Promise<Order[]>
  listDrafts(): Promise<OrderDraft[]>
  getIntakeStatus(): Promise<IntakeStatus>
  createOrder(
    outletId: string,
    temperature: Temperature,
    cases: number,
    window: string,
  ): Promise<void>
  /** Confirms the outlet's separate chilled and ambient orders together. */
  placeOrders(outletId: string, inputs: StoreOrderInput[]): Promise<void>
  editOrder(orderId: string, cases: number, window: string): Promise<void>
  saveDraft(temperature: Temperature, cases: number, window: string): Promise<void>
  saveDrafts(outletId: string, inputs: StoreOrderInput[]): Promise<void>
  confirmReceipt(orderId: string): Promise<void>
  reportReceiptIssue(orderId: string, issue: ReceiptIssue): Promise<void>
  acknowledgeDeferral(orderId: string): Promise<void>
}
