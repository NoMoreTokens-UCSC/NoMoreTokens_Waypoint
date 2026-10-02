import { Navigate, useParams } from 'react-router-dom'
import { formatClock, formatShortDate } from '../../../../domain/calendar'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { ActionLink, Callout, PageIntro, Pill, StorePage } from '../components/StoreKit'
import { Timeline } from '../components/Timeline'
import { deliveryDayLabel, receiptLabel } from '../lib/orderList'
import {
  issueReference,
  kindSlash,
  orderKinds,
  quantityText,
  statusTone,
  storeStatus,
  windowText,
} from '../lib/orderView'
import { useStoreHistory, useStoreOrders } from '../lib/useStore'

const stamp = (at?: string) => (at ? `${formatShortDate(at)} · ${formatClock(at)}` : '—')

/** One order: what was ordered, how its delivery went and what happened to it afterwards. */
export default function OrderDetailPage() {
  const { orderId } = useParams()
  const clock = useBusinessClock()
  const { orders, loaded } = useStoreOrders()
  const { history, loaded: historyLoaded } = useStoreHistory()
  const order = [...orders, ...history].find((candidate) => candidate.id === orderId)
  useBreadcrumb([{ label: 'Orders', to: '/store-manager/orders' }, { label: orderId ?? 'Order' }])
  if (!loaded || !historyLoaded) return null
  if (!order) return <Navigate to="/store-manager/orders" replace />
  const kind = orderKinds[order.temperature]
  const receipt = receiptLabel(order)
  const live = orders.some((candidate) => candidate.id === order.id)
  const delivered = order.status === 'Delivered'
  const report = order.receiptReport
  const waiting = live && delivered && order.receipt === 'Pending'
  return (
    <StorePage>
      <PageIntro
        title={`Order ${order.id}`}
        context={`${kindSlash(order.temperature)} · ${deliveryDayLabel(order, clock)}`}
      />
      <section className="sm-panel" aria-label="Order">
        <div className="sm-pills">
          <Pill tone={statusTone(order)}>{storeStatus(order)}</Pill>
          {receipt && <Pill tone={receipt.tone}>{receipt.text}</Pill>}
        </div>
        <h2 className="sm-h22">{kind.title}</h2>
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
          </div>
        </div>
      </section>

      {order.status === 'Deferred' ? (
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
        {live && order.status === 'Deferred' && !order.deferralAcknowledged && (
          <ActionLink to="/store-manager/alerts">Acknowledge deferral</ActionLink>
        )}
        {live && order.status !== 'Deferred' && !waiting && (
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
