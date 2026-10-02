import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { formatClock, formatLongDate } from '../../../../domain/calendar'
import { useStoreAction } from '../lib/useStoreAction'
import { useApis } from '../../../providers/ApisContext'
import {
  Action,
  ActionLink,
  Callout,
  PageIntro,
  Pill,
  StorePage,
  Tile,
} from '../components/StoreKit'
import { ProofImage } from '../components/ProofPhoto'
import { orderKinds } from '../lib/orderView'
import { receiptDestination } from '../lib/receiptRoutes'
import { useProof } from '../lib/useProof'
import { useStoreOrders } from '../lib/useStore'

/** Confirm receipt: the store's own count, separate from the driver's proof of delivery. */
export default function ReceiptPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const apis = useApis()
  const action = useStoreAction()
  const { orders, outletId, loaded } = useStoreOrders()
  const order = orders.find((candidate) => candidate.id === orderId)
  const proof = useProof(order)
  if (!loaded) return null
  if (!order || order.status !== 'Delivered')
    return <Navigate to="/store-manager/deliveries" replace />
  // Already answered (or just answered): show the result, never this question again.
  if (order.receipt !== 'Pending') return <Navigate to={receiptDestination(order)} replace />
  const kind = orderKinds[order.temperature]
  const deliveredAt = order.deliveredAt ?? proof.capturedAt
  const captured = proof.capturedAt ?? order.deliveredAt
  const base = `/store-manager/deliveries/${order.id}`
  return (
    <StorePage>
      <PageIntro
        title="Confirm receipt"
        context={`${order.id} · ${outletId}${deliveredAt ? ` · Delivered ${formatLongDate(deliveredAt)} at ${formatClock(deliveredAt)}` : ''}`}
      />
      <Callout tone="success" title="Delivery recorded by the driver">
        A delivery photo is attached. Count and inspect the goods before confirming receipt.
      </Callout>
      <div className="sm-receipt">
        <section className="sm-card" aria-label="Receipt check">
          <h2>Did all {order.cases} cases arrive in good condition?</h2>
          <Pill>{kind.title}</Pill>
          <div className="sm-pair">
            <Tile size="md" big label="Expected" value={`${order.cases} cases`} />
            <Tile size="md" label="Shipment" value={`${order.weight} kg · ${order.volume} m³`} />
          </div>
          <p className="sm-muted">
            Confirm receipt only when the full quantity is present and acceptable. If anything is
            missing or damaged, report the discrepancy instead.
          </p>
          <div className="sm-actions">
            <Action
              disabled={action.isPending}
              onClick={() =>
                action.runThen(
                  () => apis.orders.confirmReceipt(order.id),
                  () => navigate(`${base}/receipt/confirmed`),
                )
              }
            >
              Confirm all {order.cases} cases received
            </Action>
            <ActionLink variant="grey" to={`${base}/issue`}>
              Report missing or damaged items
            </ActionLink>
          </div>
        </section>
        <section className="sm-card sm-photo" aria-label="Delivery photograph">
          <h2>Delivery photograph</h2>
          <ProofImage url={proof.url} alt={`Delivery photograph for ${order.id}`} />
          <p className="sm-photo-caption">
            {order.id}
            {captured ? ` · Captured ${formatClock(captured)}` : ''}
            <br />
            Submitted by the driver{order.vehicleId ? ` · Vehicle ${order.vehicleId}` : ''}
          </p>
        </section>
      </div>
    </StorePage>
  )
}
