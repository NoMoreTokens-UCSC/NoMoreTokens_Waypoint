import { CUTOFF, minutesToCutoff, nextOperatingDay } from '../../domain/calendar'
import { useApiQuery } from '../hooks/useApiQuery'

/** The demo's "now": Friday 25 September 2026, 15:42 in Sri Lanka, 18 minutes before cutoff. */
const DEMO_NOW = new Date('2026-09-25T15:42:00+05:30')
/** Shown after the cutoff scenario is switched on in the demo panel. */
const DEMO_NOW_AFTER_CUTOFF = new Date('2026-09-25T16:02:00+05:30')

export interface BusinessClock {
  now: Date
  /** Clock time orders close, e.g. "16:00". */
  cutoff: string
  /** True once the clock has passed the cutoff, whether or not intake was closed. */
  cutoffPassed: boolean
  /** True when intake has actually been closed for the delivery day. */
  cutoffClosed: boolean
  minutesToCutoff: number
  /** The day the orders placed now will be delivered. */
  deliveryDate: Date
  /** The first run after `deliveryDate`, used for deferred and drafted orders. */
  nextRunDate: Date
  /** The day an order placed now is delivered: `deliveryDate`, or the following run after the cutoff. */
  orderDate: Date
}

/**
 * What time it is for ordering. The demo runs on a fixed Friday afternoon so the cutoff screens
 * are always reachable; with a backend this returns server time and the real cutoff state.
 */
export function useBusinessClock(): BusinessClock {
  const intake = useApiQuery(['intake'], (apis) => apis.orders.getIntakeStatus())
  const closed = intake.data?.cutoffClosed ?? false
  // With a backend the server decides "now" and the delivery day; the demo uses its fixed Friday.
  const serverNow = intake.data?.now ? new Date(intake.data.now) : undefined
  const now = serverNow ?? (closed ? DEMO_NOW_AFTER_CUTOFF : DEMO_NOW)
  const minutes = minutesToCutoff(now)
  const deliveryDate = intake.data?.deliveryDate
    ? new Date(`${intake.data.deliveryDate}T00:00:00+05:30`)
    : nextOperatingDay(now)
  const serverOrderDate = intake.data?.nextDeliveryDate
    ? new Date(`${intake.data.nextDeliveryDate}T00:00:00+05:30`)
    : undefined
  return {
    now,
    cutoff: CUTOFF,
    cutoffPassed: closed || minutes <= 0,
    cutoffClosed: closed,
    minutesToCutoff: minutes,
    deliveryDate,
    nextRunDate: closed && serverOrderDate ? serverOrderDate : nextOperatingDay(deliveryDate),
    orderDate: serverOrderDate ?? deliveryDate,
  }
}
