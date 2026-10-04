import { formatClock, formatLongDate } from '../../../../domain/calendar'
import { ActionLink, Callout, PageIntro, StorePage } from '../components/StoreKit'
import { ParcelIcon } from '../components/StoreIcons'
import { kindOf, quantityText, storeStatus, temperatures, windowText, orderNumber } from '../lib/orderView'
import { useStoreOrders, useStoreProfile } from '../lib/useStore'

/** Orders confirmed: each order has its own reference; allocation is still pending. */
export default function ConfirmedPage() {
  const { byTemperature, outletId, orders } = useStoreOrders()
  const { profile } = useStoreProfile()
  const brand = profile?.brand ?? 'Fresh'
  const placed = orders
    .map((order) => order.placedAt)
    .filter((at): at is string => Boolean(at))
    .sort()
    .at(-1)
  const recorded =
    brand === 'Fresh'
      ? temperatures.map(byTemperature).filter((order) => order !== undefined)
      : orders
  return (
    <StorePage>
      <PageIntro
        title="Orders confirmed"
        context={`${placed ? `Placed ${formatLongDate(placed)} · ${formatClock(placed)} · ` : ''}${outletId}`}
      />
      {recorded.some((order) => order.pendingSync) && (
        <Callout title="Saved on this device, not sent yet">
          You are offline. Dispatch cannot see{' '}
          {recorded.length === 1 ? 'this order' : 'these orders'} until your connection returns.
          They are sent automatically, and orders close at 4 PM, so reconnect before then.
        </Callout>
      )}
      <Callout
        tone="success"
        title={`${recorded.length === 1 ? `Your ${brand} order is` : `Your ${recorded.length} ${brand} orders are`} ${recorded.some((order) => order.pendingSync) ? 'saved' : 'confirmed'}`}
      >
        Each order has its own reference. Vehicle allocation is still pending; no arrival time is
        confirmed yet.
      </Callout>
      <div className="sm-widgets">
        {recorded.map((order) => {
          const kind = kindOf(order)
          return (
            <section className="sm-card" key={order.id} aria-label={kind.title}>
              <div className="sm-widget-head">
                <span className="sm-mark">
                  <ParcelIcon size={24} />
                </span>
                <div>
                  <h3>{kind.title}</h3>
                  <p>{kind.subtitle}</p>
                </div>
              </div>
              <p className="sm-details">{quantityText(order)}</p>
              <p className="sm-note">Window {windowText(order)}</p>
              <p className="sm-order-ref">
                {order.pendingSync ? 'Reference after sending' : orderNumber(order)} · {storeStatus(order)}
              </p>
            </section>
          )
        })}
      </div>
      <section className="sm-panel" aria-label="Next steps">
        <h2 className="sm-h22">Plan your receiving shift</h2>
        <p className="sm-muted">
          Check delivery status after the 4 PM planning cutoff. Any deferral will appear in Alerts
          and require your acknowledgment.
        </p>
        <div className="sm-actions">
          <ActionLink to="/store-manager/deliveries">View scheduled delivery</ActionLink>
          <ActionLink variant="outline" to="/store-manager/alerts">
            View alerts
          </ActionLink>
        </div>
      </section>
    </StorePage>
  )
}
