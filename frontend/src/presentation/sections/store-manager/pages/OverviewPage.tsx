import { formatClock, formatLongDate, formatWeekday } from '../../../../domain/calendar'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { ActionLink, PageIntro, StorePage } from '../components/StoreKit'
import { ParcelIcon } from '../components/StoreIcons'
import { cutoffLabel } from '../lib/cutoff'
import { orderKinds, quantityText, temperatures, windowText } from '../lib/orderView'
import { useStoreOrders } from '../lib/useStore'

/** Order placement: the cutoff countdown and this outlet's two separate Fresh orders. */
export default function OverviewPage() {
  const { byTemperature, outletId } = useStoreOrders()
  const clock = useBusinessClock()
  const next = formatWeekday(clock.nextRunDate)
  return (
    <StorePage>
      <PageIntro
        title="Order placement"
        context={`${outletId} · Delivery ${formatLongDate(clock.deliveryDate)} · ${formatWeekday(clock.now)}, ${formatClock(clock.now)}`}
      />
      <section className="sm-panel sm-cutoff" aria-label="Order cutoff">
        <div>
          {clock.cutoffPassed ? (
            <>
              <h2>Today’s cutoff has passed</h2>
              <p>
                {formatWeekday(clock.deliveryDate)}’s intake is locked · Save a draft for {next}
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
        <ActionLink small to="/store-manager/orders">
          {clock.cutoffPassed ? 'Keep a draft' : 'Create orders'}
        </ActionLink>
      </section>
      <div className="sm-widgets">
        {temperatures.map((temperature) => {
          const order = byTemperature(temperature)
          const kind = orderKinds[temperature]
          return (
            <section className="sm-card" key={temperature} aria-label={kind.title}>
              <div className="sm-widget-head">
                <span className="sm-mark">
                  <ParcelIcon size={24} />
                </span>
                <div>
                  <h3>{kind.title}</h3>
                  <p>{kind.subtitle}</p>
                </div>
              </div>
              {order ? (
                <>
                  <p className="sm-details">{quantityText(order)}</p>
                  <p className="sm-note">Window {windowText(order)}</p>
                </>
              ) : (
                <>
                  <p className="sm-details">No order yet</p>
                  <p className="sm-note">
                    Create one before the {cutoffLabel(clock.cutoff)} cutoff.
                  </p>
                </>
              )}
              <ActionLink variant="grey" to="/store-manager/orders">
                {order ? 'Edit order' : 'Create order'}
              </ActionLink>
            </section>
          )
        })}
      </div>
      <p className="sm-note">
        {outletId} is a Fresh outlet. Dry groceries and chilled goods are submitted as separate
        order records.
      </p>
      <div className="sm-actions-row">
        <ActionLink variant="grey" to="/store-manager/deliveries">
          View deliveries
        </ActionLink>
        <ActionLink variant="grey" to="/store-manager/alerts">
          View alerts
        </ActionLink>
      </div>
    </StorePage>
  )
}
