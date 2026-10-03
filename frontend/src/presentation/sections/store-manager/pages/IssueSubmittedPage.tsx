import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { formatLongDate } from '../../../../domain/calendar'
import { clock12 } from '../lib/timeText'
import { Action, ActionLink, Callout, PageIntro, Pill, StorePage } from '../components/StoreKit'
import { ProofDialog } from '../components/ProofPhoto'
import { issueReference } from '../lib/orderView'
import { receiptDestination } from '../lib/receiptRoutes'
import { useProof } from '../lib/useProof'
import { useStoreOrders } from '../lib/useStore'

/** Issue submitted: the report is open and linked to the order and its delivery photograph. */
export default function IssueSubmittedPage() {
  const { orderId } = useParams()
  const { orders, outletId, loaded } = useStoreOrders()
  const [photo, setPhoto] = useState(false)
  const order = orders.find((candidate) => candidate.id === orderId)
  const proof = useProof(order)
  if (!loaded) return null
  const report = order?.receiptReport
  if (!order || order.status !== 'Delivered')
    return <Navigate to="/store-manager/deliveries" replace />
  if (!report) return <Navigate to={receiptDestination(order)} replace />
  const word = report.kind === 'Missing' ? 'missing' : 'damaged'
  return (
    <StorePage>
      <PageIntro
        title="Issue submitted"
        context={`${order.id} · ${outletId} · ${formatLongDate(report.recordedAt)} · ${clock12(report.recordedAt)}`}
      />
      <section className="sm-panel sm-result" aria-label="Issue">
        <Pill tone="amber">Open · Awaiting review</Pill>
        <h2>
          {report.kind === 'Missing' ? 'Missing-item report received.' : 'Damage report received.'}
        </h2>
        <div className="sm-value-row">
          <span>Issue reference</span>
          <strong>{issueReference(order, report.kind)}</strong>
        </div>
        <div className="sm-value-row">
          <span>Recorded receipt</span>
          <strong>
            {report.received} received · {report.affected} {word}
          </strong>
        </div>
        <p className="sm-muted">
          The dispatcher can review the report alongside the delivery record and photo. Follow-up
          will appear against this order.
        </p>
        {order.pendingSync && (
          <Callout title="Saved on this device">
            You are offline. This will be sent automatically when your connection returns.
          </Callout>
        )}
        <Callout title="Receipt recorded with an issue">
          This delivery is not marked as received in full without discrepancies.
        </Callout>
        <div className="sm-actions">
          <Action variant="outline" onClick={() => setPhoto(true)}>
            View delivery photograph
          </Action>
          <ActionLink to="/store-manager/overview">Return to orders</ActionLink>
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
