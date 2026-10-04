import type { OutletProfile } from '../outlets'
import type { Order, OrderStatus, Snapshot, StoreOrderInput, Temperature } from '../models'

export type OrderDraft = Snapshot['drafts'][number]
export interface OrderFilter {
  outletId?: string
  status?: OrderStatus
  /** Delivery day, YYYY-MM-DD. */
  date?: string
}
export interface IntakeStatus {
  /** True after the 4 PM cutoff: new demand becomes a draft for the next run. */
  cutoffClosed: boolean
  /** True once the dispatcher publishes the plan; orders can no longer be edited. */
  published: boolean
  /** The server's current time (ISO), when the backend supplies it. Demo adapters leave it out. */
  now?: string
  /** The day orders placed now are delivered (YYYY-MM-DD), when the backend supplies it. */
  deliveryDate?: string
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
  /** Brand, schedule and receiving limits for an outlet. */
  getOutletProfile(outletId: string): Promise<OutletProfile>
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
  /** Withdraws an order before the cutoff. Refused once intake is closed or the plan is published. */
  cancelOrder(orderId: string): Promise<void>
  acknowledgeDeferral(orderId: string): Promise<void>
  closeIntake?(): Promise<void>
}
