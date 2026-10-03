import { useState } from 'react'
import { Check } from 'lucide-react'
import { formatClock, formatLongDate, formatWeekday } from '../../../../domain/calendar'
import type { Order } from '../../../../domain/models'
import { toast } from 'sonner'
import { useStoreAction } from '../lib/useStoreAction'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { Action, ActionLink, Callout, PageIntro, Pill, StorePage } from '../components/StoreKit'
import { AlertIcon } from '../components/StoreIcons'
import { kindSlash } from '../lib/orderView'
import { deferredOrders, useStoreOrders } from '../lib/useStore'
import { DeliveryAlerts } from '../../../shared/organisms/DeliveryAlerts'

const explanation = (reason?: string) =>
  reason && /capacity/i.test(reason)
    ? 'The current delivery run has no suitable remaining capacity for this order.'
    : 'The dispatcher moved this order to the next run.'

/** One deferral notice: why the order is not coming, when it will, and the store's acknowledgment. */
function DeferralCard({ order, outletId }: { order: Order; outletId: string }) {
  const action = useStoreAction()
  const clock = useBusinessClock()
  const [understood, setUnderstood] = useState(false)
  const missed = formatWeekday(clock.deliveryDate)
  const acknowledged = Boolean(order.deferralAcknowledged)
  return (
    <section
      className={`sm-alert-card${acknowledged ? ' sm-acknowledged' : ''}`}
      aria-label={`Deferral of ${order.id}`}
    >
      <div className="sm-alert-title">
        {acknowledged ? (
          <Check size={28} color="#1E8A57" strokeWidth={2} aria-hidden="true" />
        ) : (
          <AlertIcon tone="danger" />
        )}
        <h2>{acknowledged ? 'You’re up to date' : `This order will not arrive on ${missed}`}</h2>
      </div>
      <Pill tone={acknowledged ? 'green' : 'red'}>
        {acknowledged ? 'Acknowledged' : 'Acknowledgment required'}
      </Pill>
      <div className="sm-facts">
        <div className="sm-fact">
          <span>Order</span>
          <strong>
            {order.id} · {kindSlash(order)}
          </strong>
        </div>
        <div className="sm-fact">
          <span>Outlet</span>
          <strong>{outletId}</strong>
        </div>
        <div className="sm-fact">
          <span>Goods</span>
          <strong>
            {order.cases} cases · {order.weight} kg
          </strong>
        </div>
      </div>
      <div className="sm-reason">
        <span>Dispatcher reason</span>
        <strong>{order.deferralReason ?? 'The dispatcher is recording the reason.'}</strong>
      </div>
      <p className="sm-muted">{explanation(order.deferralReason)}</p>
      <div className="sm-nextrun">
        <div className="sm-fact">
          <span>Next run</span>
          <strong>{formatLongDate(clock.nextRunDate)}</strong>
        </div>
        <p className="sm-muted">Allocation pending · No vehicle or ETA yet</p>
        <p>Your original order stays in the queue. Please do not place a duplicate order.</p>
      </div>
      {acknowledged ? (
        <>
          <Callout tone="success" title="Acknowledgment recorded">
            The dispatcher can see that {outletId} has reviewed the deferral. We’ll update the order
            when the next run is scheduled.
          </Callout>
          <div className="sm-actions">
            <ActionLink to="/store-manager/deliveries">Track remaining deliveries</ActionLink>
            <ActionLink variant="outline" to="/store-manager/orders/confirmed">
              View orders
            </ActionLink>
          </div>
        </>
      ) : (
        <>
          <label className="sm-confirm-check">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
            />
            I understand this order is deferred to the next run.
          </label>
          <Action
            disabled={!understood || action.isPending || !order.deferralReason}
            onClick={() =>
              action.send(
                { kind: 'acknowledge', orderId: order.id },
                `Acknowledge deferral of ${order.id}`,
                () => toast.success('Deferral acknowledged'),
              )
            }
          >
            Acknowledge deferral
          </Action>
          <p className="sm-footnote">
            The alert remains unacknowledged until you confirm. Acknowledging does not restore the{' '}
            {missed} delivery.
          </p>
        </>
      )}
    </section>
  )
}

/** Delivery updates and deferrals that need the store's acknowledgment. */
export default function AlertsPage() {
  const { orders, outletId, loaded } = useStoreOrders()
  const deferred = deferredOrders(orders)
  const first = deferred.find((order) => !order.deferralAcknowledged) ?? deferred[0]
  useBreadcrumb([{ label: 'Alerts', to: '/store-manager/alerts' }, { label: 'Deferral' }])
  if (!loaded) return null
  if (!first)
    return (
      <StorePage>
        <PageIntro title="Alerts" context={outletId} />
        <DeliveryAlerts />
        <section className="sm-panel">
          <h2>No deferral alerts</h2>
          <p className="sm-muted">
            Deferrals will appear here when the dispatcher moves an order to a later run.
          </p>
          <div className="sm-actions">
            <ActionLink variant="outline" to="/store-manager/notifications">
              See all notifications
            </ActionLink>
          </div>
        </section>
      </StorePage>
    )
  const acknowledged = Boolean(first.deferralAcknowledged)
  const at = acknowledged ? first.deferralAcknowledgedAt : first.deferredAt
  return (
    <StorePage>
      <PageIntro
        title={acknowledged ? 'Deferral acknowledged' : 'Delivery deferred'}
        context={
          at
            ? `${acknowledged ? 'Acknowledged' : 'Alert issued'} ${formatLongDate(at)} · ${formatClock(at)}`
            : undefined
        }
      />
      <DeliveryAlerts />
      {deferred.map((order) => (
        <DeferralCard key={order.id} order={order} outletId={outletId} />
      ))}
      <div className="sm-actions">
        <ActionLink variant="outline" to="/store-manager/notifications">
          See all notifications
        </ActionLink>
      </div>
    </StorePage>
  )
}
