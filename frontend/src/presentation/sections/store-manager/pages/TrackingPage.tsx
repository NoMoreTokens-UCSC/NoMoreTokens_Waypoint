import { useSearchParams } from 'react-router-dom'
import { formatClock, formatLongDate, formatShortDate } from '../../../../domain/calendar'
import type { Order } from '../../../../domain/models'
import { useAction } from '../../../hooks/useOperations'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import {
  Action,
  ActionLink,
  Callout,
  PageIntro,
  Pill,
  StorePage,
  Tile,
} from '../components/StoreKit'
import { RouteMapCard } from '../components/RouteMapCard'
import { kindSlash, orderKinds, windowText } from '../lib/orderView'
import { deferredOrders, pickActiveOrder, useStoreOrders } from '../lib/useStore'
import { useProof } from '../lib/useProof'

const steps = [
  { key: 'placedAt', label: 'Order placed' },
  { key: 'scheduledAt', label: 'Scheduled' },
  { key: 'departedAt', label: 'En route' },
  { key: 'deliveredAt', label: 'Delivered' },
] as const

function Timeline({ order }: { order: Order }) {
  return (
    <ol className="sm-timeline">
      {steps.map((step, index) => {
        const at = order[step.key]
        return (
          <li key={step.key} className={`sm-step${at ? '' : ' sm-step-pending'}`}>
            <span className="sm-step-dot" aria-hidden="true">
              {at ? '✓' : index + 1}
            </span>
            <div>
              <strong>{step.label}</strong>
              <small>
                {at ? `${formatShortDate(at)} · ${formatClock(at)}` : 'Awaiting update'}
              </small>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Delivery tracking for one order: where it is, when it arrives and when to be ready. */
export default function TrackingPage() {
  const [params, setParams] = useSearchParams()
  const action = useAction()
  const { orders, outletId, loaded } = useStoreOrders()
  const order = pickActiveOrder(orders, params.get('order'))
  const proof = useProof(order)
  const deferred = deferredOrders(orders)
  useBreadcrumb([{ label: 'Orders', to: '/store-manager/orders' }, { label: 'Tracking' }])
  if (!loaded) return null
  const alertLink = deferred.length > 0 && (
    <ActionLink variant="grey" to="/store-manager/alerts">
      {deferred.length} order{deferred.length === 1 ? '' : 's'} deferred · View alert
    </ActionLink>
  )
  if (!order)
    return (
      <StorePage>
        <PageIntro title="Delivery tracking" context={outletId} />
        <Callout title="No orders yet">
          Place your orders before the cutoff and their delivery appears here.
        </Callout>
        {alertLink}
      </StorePage>
    )
  // Before the dispatcher publishes the plan there is no vehicle, arrival time or map to show.
  const dispatched = ['Scheduled', 'En route', 'Delivered'].includes(order.status)
  const stop = proof.stop
  const arrival = stop?.eta ?? order.window
  const delivered = order.status === 'Delivered'
  const stamp = (at?: string) => (at ? `${formatLongDate(at)} · ${formatClock(at)}` : '')
  const heading = delivered
    ? order.receipt === 'Pending'
      ? 'Delivered · Confirm receipt'
      : 'Delivered'
    : 'Delivery tracking'
  const context = !dispatched
    ? `${outletId} · Waiting for the dispatcher`
    : order.status === 'Scheduled'
      ? `Plan published · ${stamp(order.scheduledAt)}`
      : stamp(delivered ? order.deliveredAt : order.departedAt)
  const live = orders.filter((candidate) => candidate.status !== 'Deferred')
  return (
    <StorePage>
      <PageIntro title={heading} context={context} />
      <section className="sm-panel sm-progress-top" aria-label="Delivery progress">
        <Timeline order={order} />
      </section>
      <div className="sm-tracking">
        <section className="sm-card sm-arrival" aria-label="Arrival and receiving">
          <div className="sm-arrival-left">
            <Pill tone={delivered ? 'green' : dispatched ? 'orange' : 'amber'}>
              {dispatched ? order.status : 'Awaiting allocation'}
            </Pill>
            {live.length > 1 ? (
              <div className="sm-segments" role="group" aria-label="Order">
                {live.map((candidate) => (
                  <Action
                    key={candidate.id}
                    small
                    variant={candidate.id === order.id ? 'primary' : 'outline'}
                    onClick={() => setParams({ order: candidate.id })}
                  >
                    {orderKinds[candidate.temperature].short}
                  </Action>
                ))}
              </div>
            ) : null}
            <p className="sm-order-line">
              {order.id} · {kindSlash(order.temperature)}
            </p>
            {delivered ? (
              <Tile
                size="lg"
                tone="success"
                label="Delivered at"
                value={order.deliveredAt ? formatClock(order.deliveredAt) : '—'}
              />
            ) : (
              <Tile
                size="lg"
                label={order.status === 'En route' ? 'Expected arrival' : 'Planned arrival'}
                value={dispatched ? arrival : 'Pending'}
              />
            )}
            <p className="sm-arrival-context">
              {delivered
                ? 'Photographic proof is attached. Receipt confirmation is still pending.'
                : !dispatched
                  ? 'No vehicle or arrival time yet. Both appear after the dispatcher publishes the plan.'
                  : order.status === 'Scheduled'
                    ? 'Vehicle assigned. Live position becomes available after departure.'
                    : `Departed ${order.departedAt ? formatClock(order.departedAt) : 'the depot'}. Live position updates when the vehicle reports it.`}
            </p>
          </div>
          <div className="sm-arrival-right">
            <Tile size="md" label="Receiving window" value={windowText(order)} />
            <Tile size="md" label="Prepare receiving staff" value={`Ready by ${order.window}`} />
            {delivered && order.receipt === 'Pending' ? (
              <ActionLink to={`/store-manager/deliveries/${order.id}/receipt`}>
                Confirm receipt
              </ActionLink>
            ) : delivered ? (
              <ActionLink
                to={
                  order.receipt === 'Confirmed'
                    ? `/store-manager/deliveries/${order.id}/receipt/confirmed`
                    : `/store-manager/deliveries/${order.id}/issue/submitted`
                }
              >
                View receipt
              </ActionLink>
            ) : (
              <Action
                disabled={action.isPending}
                onClick={() => action.run(async () => {}, 'Delivery status refreshed')}
              >
                {order.status === 'En route' ? 'Refresh delivery status' : 'Refresh tracking'}
              </Action>
            )}
            {alertLink}
          </div>
        </section>
        <RouteMapCard order={order} stop={stop} outletId={outletId} />
      </div>
      <section className="sm-panel sm-progress-compact" aria-label="Order journey">
        <h3>Order journey</h3>
        <Timeline order={order} />
      </section>
    </StorePage>
  )
}
