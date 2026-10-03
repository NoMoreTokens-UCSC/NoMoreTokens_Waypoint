import { formatWeekday } from '../../../../domain/calendar'
import type { BusinessClock } from '../../../session/useBusinessClock'
import { cutoffLabel } from '../lib/cutoff'
import { ActionLink } from './StoreKit'

/** The cutoff countdown (or the locked notice) with the way into ordering. */
export function CutoffPanel({ clock }: { clock: BusinessClock }) {
  return (
    <section className="sm-panel sm-cutoff" aria-label="Order cutoff">
      <div>
        {clock.cutoffPassed ? (
          <>
            <h2>Today’s cutoff has passed</h2>
            <p>
              {formatWeekday(clock.deliveryDate)}’s intake is locked · Save a draft for{' '}
              {formatWeekday(clock.nextRunDate)}
            </p>
          </>
        ) : (
          <>
            <h2>
              {clock.minutesToCutoff} minute{clock.minutesToCutoff === 1 ? '' : 's'} to place
              tomorrow’s orders
            </h2>
            <p>Daily cutoff · {cutoffLabel(clock.cutoff)} Sri Lanka time</p>
          </>
        )}
      </div>
      <ActionLink small to="/store-manager/orders/new">
        {clock.cutoffPassed ? 'Keep a draft' : 'Create orders'}
      </ActionLink>
    </section>
  )
}
