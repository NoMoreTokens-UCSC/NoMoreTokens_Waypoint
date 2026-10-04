import type { Order, Settings, Trip } from '../models'

export interface PlanState {
  orders: Order[]
  trips: Trip[]
  status: Pick<Settings, 'cutoffClosed' | 'published' | 'allocationReviewed'>
}

/** The dispatcher's daily plan: allocation, deferral, review, publication and release. */
export interface PlanningApi {
  getPlan(): Promise<PlanState>
  allocate(orderId: string, vehicleId: string, trip: number): Promise<void>
  unallocate(orderId: string): Promise<void>
  autoAllocate(): Promise<void>
  defer(orderId: string, reason: string): Promise<void>
  reviewAllocation(): Promise<void>
  publish(): Promise<void>
  /** Releases a loaded vehicle for departure. */
  release(loadId: string): Promise<void>
  /** Closes order intake for the delivery day. Orders are then fixed for allocation. */
  closeIntake(): Promise<void>
}
