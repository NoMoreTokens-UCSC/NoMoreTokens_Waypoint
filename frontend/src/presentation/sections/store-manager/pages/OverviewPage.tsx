import { formatClock, formatLongDate, formatWeekday } from '../../../../domain/calendar'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { CutoffPanel } from '../components/CutoffPanel'
import { ActionLink, OfflineNotice, PageIntro, Pill, StorePage } from '../components/StoreKit'
import { ParcelIcon } from '../components/StoreIcons'
import { cutoffLabel } from '../lib/cutoff'
import {
  orderKinds,
  quantityText,
  statusTone,
  storeStatus,
  temperatures,
  windowText,
} from '../lib/orderView'
import { useOnline } from '../lib/useOnline'
import { useStoreOrders } from '../lib/useStore'

/** Order placement: the cutoff countdown and this outlet's two separate Fresh orders. */
export default function OverviewPage() {
  const { byTemperature, outletId } = useStoreOrders()
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
                {order && (
                  <span className="sm-widget-status">
                    <Pill tone={statusTone(order)}>{storeStatus(order)}</Pill>
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
              <ActionLink variant="grey" to="/store-manager/orders/new">
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
