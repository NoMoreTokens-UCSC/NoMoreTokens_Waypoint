import type { AccountApi } from './account'
import type { DeliveryApi } from './delivery'
import type { FleetApi } from './fleet'
import type { LoadingApi } from './loading'
import type { OrdersApi } from './orders'
import type { PlanningApi } from './planning'
import type { TeamApi } from './team'

export type * from './account'
export type * from './delivery'
export type * from './fleet'
export type * from './loading'
export type * from './orders'
export type * from './planning'
export type * from './team'

/**
 * Everything the screens read and write, grouped by data rather than by role because one
 * order passes through every role. A backend replaces the implementations, not this contract.
 */
export interface Apis {
  orders: OrdersApi
  planning: PlanningApi
  loading: LoadingApi
  delivery: DeliveryApi
  fleet: FleetApi
  team: TeamApi
  account: AccountApi
}
