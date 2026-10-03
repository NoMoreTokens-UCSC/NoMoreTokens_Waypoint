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
  cutoffPassed: boolean
  minutesToCutoff: number
  /** The day the orders placed now will be delivered. */
  deliveryDate: Date
  /** The first run after `deliveryDate`, used for deferred and drafted orders. */
  nextRunDate: Date
}

/**
 * What time it is for ordering. The demo runs on a fixed Friday afternoon so the cutoff screens
 * are always reachable; with a backend this returns server time and the real cutoff state.
 */
export function useBusinessClock(): BusinessClock {
  const intake = useApiQuery(['intake'], (apis) => apis.orders.getIntakeStatus())
  const closed = intake.data?.cutoffClosed ?? false
  const now = closed ? DEMO_NOW_AFTER_CUTOFF : DEMO_NOW
  const minutes = minutesToCutoff(now)
  const deliveryDate = nextOperatingDay(now)
  return {
    now,
    cutoff: CUTOFF,
    cutoffPassed: closed || minutes <= 0,
    minutesToCutoff: minutes,
    deliveryDate,
    nextRunDate: nextOperatingDay(deliveryDate),
  }
}
