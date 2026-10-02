import { formatClock, formatLongDate } from '../../../../domain/calendar'
import { ActionLink, Callout, PageIntro, StorePage } from '../components/StoreKit'
import { ParcelIcon } from '../components/StoreIcons'
import { orderKinds, quantityText, storeStatus, temperatures, windowText } from '../lib/orderView'
import { useStoreOrders } from '../lib/useStore'

/** Orders confirmed: each order has its own reference; allocation is still pending. */
export default function ConfirmedPage() {
  const { byTemperature, outletId, orders } = useStoreOrders()
  const placed = orders
    .map((order) => order.placedAt)
    .filter((at): at is string => Boolean(at))
    .sort()
    .at(-1)
  const recorded = temperatures.map(byTemperature).filter((order) => order !== undefined)
  return (
    <StorePage>
      <PageIntro
        title="Orders confirmed"
        context={`${placed ? `Placed ${formatLongDate(placed)} · ${formatClock(placed)} · ` : ''}${outletId}`}
      />
      <Callout tone="success" title={`Your ${recorded.length} Fresh orders are confirmed`}>
        Each order has its own reference. Vehicle allocation is still pending; no arrival time is
        confirmed yet.
      </Callout>
      <div className="sm-widgets">
        {recorded.map((order) => {
          const kind = orderKinds[order.temperature]
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
                {order.id} · {storeStatus(order)}
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
