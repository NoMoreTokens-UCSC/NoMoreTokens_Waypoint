import { formatClock, formatLongDate, formatWeekday } from '../../../../domain/calendar'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { CutoffPanel } from '../components/CutoffPanel'
import { ActionLink, OfflineNotice, PageIntro, Pill, StorePage } from '../components/StoreKit'
import { ParcelIcon } from '../components/StoreIcons'
import { cutoffLabel } from '../lib/cutoff'
import {
  kindOf,
  quantityText,
  statusTone,
  storeStatus,
  temperatures,
  windowText,
} from '../lib/orderView'
import { useOnline } from '../lib/useOnline'
import { runningLate } from '../lib/lateness'
import { useStoreOrders, useStoreProfile, useStoreStops } from '../lib/useStore'

/** Order placement: the cutoff countdown and this outlet's two separate Fresh orders. */
export default function OverviewPage() {
  const { byTemperature, outletId, orders } = useStoreOrders()
  const { stops } = useStoreStops()
  const { profile } = useStoreProfile()
  const brand = profile?.brand ?? 'Fresh'
  // Fresh places a chilled and a dry order; Style and Tech place one.
  const cards =
    brand === 'Fresh'
      ? temperatures.map((temperature) => ({
          key: temperature,
          temperature,
          order: byTemperature(temperature),
        }))
      : orders.length
        ? orders.map((order) => ({ key: order.id, temperature: order.temperature, order }))
        : [{ key: 'none', temperature: 'Ambient' as const, order: undefined }]
  const clock = useBusinessClock()
  const online = useOnline()
  return (
    <StorePage>
      <PageIntro
        title="Order placement"
        context={`${outletId} · Delivery ${formatLongDate(clock.deliveryDate)} · ${formatWeekday(clock.now)}, ${formatClock(clock.now)}`}
      />
      {!online && <OfflineNotice cutoff={cutoffLabel(clock.cutoff)} />}
      <CutoffPanel clock={clock} />
      <div className="sm-widgets">
        {cards.map(({ key, temperature, order }) => {
          const kind = kindOf({ brand, temperature })
          return (
            <section className="sm-card" key={key} aria-label={kind.title}>
              <div className="sm-widget-head">
                <span className="sm-mark">
                  <ParcelIcon size={24} />
                </span>
                <div>
                  <h3>{kind.title}</h3>
                  <p>{kind.subtitle}</p>
                </div>
                {order && (
                  <span className="sm-widget-status">
                    <Pill tone={statusTone(order)}>{storeStatus(order)}</Pill>
                    {runningLate(
                      order,
                      stops.find((stop) => stop.orderIds.includes(order.id)),
                    ) && <Pill tone="red">Running late</Pill>}
                  </span>
                )}
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
              <ActionLink
                variant="grey"
                to={
                  brand === 'Tech' && order
                    ? `/store-manager/orders/new?order=${order.id}`
                    : '/store-manager/orders/new'
                }
              >
                {order ? 'Edit order' : 'Create order'}
              </ActionLink>
            </section>
          )
        })}
      </div>
      {brand === 'Tech' && orders.length > 0 && (
        <ActionLink variant="outline" to="/store-manager/orders/new">
          Add another order
        </ActionLink>
      )}
      <p className="sm-note">
        {brand === 'Fresh'
          ? `${outletId} is a Fresh outlet. Dry groceries and chilled goods are submitted as separate order records.`
          : `${outletId} is a ${brand} outlet. ${profile?.schedule}.`}
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
