import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { formatLongDate } from '../../../../domain/calendar'
import { clock12 } from '../lib/timeText'
import { Action, ActionLink, Callout, PageIntro, Pill, StorePage } from '../components/StoreKit'
import { ProofDialog } from '../components/ProofPhoto'
import { countText, kindOf } from '../lib/orderView'
import { receiptDestination } from '../lib/receiptRoutes'
import { useProof } from '../lib/useProof'
import { useStoreOrders } from '../lib/useStore'

/** Receipt confirmed: the full quantity was counted and accepted. */
export default function ReceiptConfirmedPage() {
  const { orderId } = useParams()
  const { orders, outletId, loaded } = useStoreOrders()
  const [photo, setPhoto] = useState(false)
  const order = orders.find((candidate) => candidate.id === orderId)
  const proof = useProof(order)
  if (!loaded) return null
  if (!order || order.status !== 'Delivered')
    return <Navigate to="/store-manager/deliveries" replace />
  if (order.receipt !== 'Confirmed') return <Navigate to={receiptDestination(order)} replace />
  const at = order.receiptAt
  return (
    <StorePage>
      <PageIntro
        title="Receipt confirmed"
        context={`${order.id} · ${outletId}${at ? ` · ${formatLongDate(at)} · ${clock12(at)}` : ''}`}
      />
      <section className="sm-panel sm-result" aria-label="Receipt">
        <Pill>Receipt confirmed</Pill>
        <h2>All {countText(order.cases, order)} received.</h2>
        <p className="sm-result-lines">
          {kindOf(order).title}
          <br />
          {order.cases} received / {order.cases} expected
          <br />
          No damage or shortage reported
        </p>
        {order.pendingSync && (
          <Callout title="Saved on this device">
            You are offline. This will be sent automatically when your connection returns.
          </Callout>
        )}
        <Callout tone="success" title="Acknowledgment saved">
          The receipt record is linked to {order.id} and its driver delivery photograph.
        </Callout>
        <div className="sm-actions">
          <Action variant="outline" onClick={() => setPhoto(true)}>
            View delivery photograph
          </Action>
          <ActionLink to="/store-manager/overview">Return to orders</ActionLink>
          <ActionLink variant="outline" to={`/store-manager/deliveries/${order.id}/issue`}>
            Report an issue discovered later
          </ActionLink>
        </div>
      </section>
      <ProofDialog
        open={photo}
        onClose={() => setPhoto(false)}
        orderId={order.id}
        outletId={outletId}
        url={proof.url}
        capturedAt={proof.capturedAt}
        evidence={proof.evidence}
      />
    </StorePage>
  )
}
