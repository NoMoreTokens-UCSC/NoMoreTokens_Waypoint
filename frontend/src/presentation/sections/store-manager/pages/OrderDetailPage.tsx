import { realBackend } from '../../../session/realBackend'
import { orderNumber } from '../lib/orderView'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { formatClock, formatShortDate } from '../../../../domain/calendar'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { useBusinessClock } from '../../../session/useBusinessClock'
import {
  Action,
  ActionLink,
  Callout,
  PlannedNotice,
  PageIntro,
  Pill,
  StorePage,
} from '../components/StoreKit'
import { Timeline } from '../components/Timeline'
import { deliveredLate, durationText, runningLate } from '../lib/lateness'
import { deliveryDayLabel, receiptLabel } from '../lib/orderList'
import {
  issueReference,
  kindSlash,
  kindOf,
  quantityText,
  statusTone,
  storeStatus,
  windowText,
} from '../lib/orderView'
import type { StoreOrder } from '../lib/outbox'
import { useStoreAction } from '../lib/useStoreAction'
import { useStoreHistory, useStoreOrders, useStoreStops } from '../lib/useStore'

const stamp = (at?: string) => (at ? `${formatShortDate(at)} · ${formatClock(at)}` : '—')

/** One order: what was ordered, how its delivery went and what happened to it afterwards. */
export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const action = useStoreAction()
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const clock = useBusinessClock()
  const { orders, loaded } = useStoreOrders()
  const { history, loaded: historyLoaded } = useStoreHistory()
  const { stops } = useStoreStops()
  const order = ([...orders, ...history] as StoreOrder[]).find(
    (candidate) => candidate.id === orderId,
  )
  useBreadcrumb([{ label: 'Orders', to: '/store-manager/orders' }, { label: order ? orderNumber(order) : (orderId ?? 'Order') }])
  if (!loaded || !historyLoaded) return null
  if (!order) return <Navigate to="/store-manager/orders" replace />
  const kind = kindOf(order)
  const receipt = receiptLabel(order)
  const live = orders.some((candidate) => candidate.id === order.id)
  const delivered = order.status === 'Delivered'
  const report = order.receiptReport
  const late = runningLate(
    order,
    stops.find((stop) => stop.orderIds.includes(order.id)),
  )
  const wasLate = deliveredLate(order)
  // Until the cutoff an order that is still waiting for the plan can be changed or withdrawn.
  // After the cutoff the planned day is locked, but an order placed for the following run is open.
  const forLaterRun =
    realBackend &&
    !!order.deliveryDate &&
    new Date(`${order.deliveryDate}T00:00:00+05:30`) > clock.deliveryDate
  const editable =
    live &&
    ['Confirmed', 'Allocated'].includes(order.status) &&
    (!clock.cutoffPassed || forLaterRun) &&
    !order.pendingSync
  const locked = live && ['Confirmed', 'Allocated'].includes(order.status) && !editable
  const waiting = live && delivered && order.receipt === 'Pending'
  return (
    <StorePage>
      <PageIntro
        title={`Order ${orderNumber(order)}`}
        context={`${kindSlash(order)} · ${deliveryDayLabel(order, clock)}`}
      />
      <section className="sm-panel" aria-label="Order">
        <div className="sm-pills">
          <Pill tone={statusTone(order)}>{storeStatus(order)}</Pill>
          {receipt && <Pill tone={receipt.tone}>{receipt.text}</Pill>}
        </div>
        {late && (
          <Callout
            tone="danger"
            title={`Expected ${durationText(late.minutesLate)} after your window closes`}
          >
            Now expected at {late.expected}; your window ends at {late.windowEnd}.
          </Callout>
        )}
        <h2 className="sm-h22">{kind.title}</h2>
        {order.status === 'Allocated' && live && !order.cancelledAt && (
          <PlannedNotice action="Changing or cancelling" />
        )}
        <div className="sm-facts">
          <div className="sm-fact">
            <span>Quantity</span>
            <strong>{quantityText(order)}</strong>
          </div>
          <div className="sm-fact">
            <span>Receiving window</span>
            <strong>{windowText(order)}</strong>
          </div>
          <div className="sm-fact">
            <span>Placed</span>
            <strong>{stamp(order.placedAt)}</strong>
          </div>
          <div className="sm-fact">
            <span>Delivery day</span>
            <strong>{deliveryDayLabel(order, clock)}</strong>
          </div>
          <div className="sm-fact">
            <span>Vehicle</span>
            <strong>{order.vehicleId ?? 'Not assigned yet'}</strong>
          </div>
          <div className="sm-fact">
            <span>Delivered</span>
            <strong>{stamp(order.deliveredAt)}</strong>
            {wasLate && <small>{durationText(wasLate)} after the window closed</small>}
          </div>
        </div>
      </section>

      {order.cancelledAt ? (
        <section className="sm-panel" aria-label="Cancellation">
          <h2 className="sm-h22">Cancelled</h2>
          <p className="sm-muted">
            You cancelled this order {stamp(order.cancelledAt)}, before the cutoff. It is not in the
            plan and no vehicle will be sent for it.
          </p>
        </section>
      ) : order.status === 'Deferred' ? (
        <section className="sm-panel" aria-label="Deferral">
          <h2 className="sm-h22">Deferred to the next run</h2>
          <p className="sm-muted">
            {order.deferralReason ?? 'The dispatcher is recording the reason.'}
            {order.deferredAt ? ` · Told to you ${stamp(order.deferredAt)}` : ''}
          </p>
          <p className="sm-muted sm-small">
            {order.deferralAcknowledged
              ? `You acknowledged this ${stamp(order.deferralAcknowledgedAt)}.`
              : 'This notice still needs your acknowledgment.'}
          </p>
        </section>
      ) : (
        <section className="sm-panel sm-journey" aria-label="Order journey">
          <h2 className="sm-h22">Order journey</h2>
          <Timeline order={order} />
        </section>
      )}

      {report && (
        <section className="sm-panel" aria-label="Issue">
          <Pill tone="amber">Open · Awaiting review</Pill>
          <h2 className="sm-h22">
            {report.kind === 'Missing' ? 'Missing items reported' : 'Damaged items reported'}
          </h2>
          <div className="sm-value-row">
            <span>Issue reference</span>
            <strong>{issueReference(order, report.kind)}</strong>
          </div>
          <div className="sm-value-row">
            <span>Recorded receipt</span>
            <strong>
              {report.received} received · {report.affected}{' '}
              {report.kind === 'Missing' ? 'missing' : 'damaged'}
            </strong>
          </div>
          <p className="sm-muted sm-small">
            “{report.description}” · reported {stamp(report.recordedAt)}
          </p>
        </section>
      )}

      {confirmingCancel && editable && (
        <Callout tone="danger" title={`Cancel order ${orderNumber(order)}?`}>
          Dispatch will remove it from the next run and you will have no {kind.short.toLowerCase()}{' '}
          groceries ordered for that day. You can place a new order until the cutoff.
          {order.status === 'Allocated' &&
            ' The dispatcher has already planned it, so they will plan that run again.'}
        </Callout>
      )}
      {locked && !order.pendingSync && (
        <Callout title="This order is locked">
          Orders can be changed or cancelled until the cutoff. After that the dispatcher plans
          around them; ask the dispatcher if something has to change.
        </Callout>
      )}
      {waiting && (
        <Callout title="Waiting for you">
          Count the goods and confirm receipt, or report what is missing or damaged.
        </Callout>
      )}
      <div className="sm-actions-row">
        {waiting && (
          <ActionLink to={`/store-manager/deliveries/${order.id}/receipt`}>
            Confirm receipt
          </ActionLink>
        )}
        {editable && !confirmingCancel && (
          <>
            <ActionLink to={`/store-manager/orders/new?order=${order.id}`}>Edit order</ActionLink>
            <Action variant="grey" onClick={() => setConfirmingCancel(true)}>
              Cancel order
            </Action>
          </>
        )}
        {editable && confirmingCancel && (
          <>
            <Action
              disabled={action.isPending}
              onClick={() =>
                action.send(
                  { kind: 'cancel', orderId: order.id },
                  `Cancel order ${orderNumber(order)}`,
                  () => {
                    toast.success(`Order ${orderNumber(order)} cancelled`)
                    navigate('/store-manager/orders')
                  },
                )
              }
            >
              Yes, cancel order
            </Action>
            <Action variant="outline" onClick={() => setConfirmingCancel(false)}>
              Keep order
            </Action>
          </>
        )}
        {live && order.status === 'Deferred' && !order.deferralAcknowledged && (
          <ActionLink to="/store-manager/alerts">Acknowledge deferral</ActionLink>
        )}
        {live && order.status !== 'Deferred' && !waiting && !editable && (
          <ActionLink variant="grey" to={`/store-manager/deliveries?order=${order.id}`}>
            Track delivery
          </ActionLink>
        )}
        <ActionLink variant="outline" to="/store-manager/orders">
          Back to orders
        </ActionLink>
      </div>
    </StorePage>
  )
}
