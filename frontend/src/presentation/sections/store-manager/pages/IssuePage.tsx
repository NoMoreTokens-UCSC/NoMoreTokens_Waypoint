import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStoreAction } from '../lib/useStoreAction'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import {
  Action,
  ActionLink,
  Callout,
  FieldInput,
  PageIntro,
  StorePage,
} from '../components/StoreKit'
import { countText, kindSlash } from '../lib/orderView'
import { checkIssue, issueSummary, type IssueDraft, type IssueKind } from '../lib/receiptIssue'
import { useStoreOrders } from '../lib/useStore'

/** Report a delivery issue: structured counts so the dispatcher can act on the discrepancy. */
export default function IssuePage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const action = useStoreAction()
  const { orders, loaded } = useStoreOrders()
  const order = orders.find((candidate) => candidate.id === orderId)
  const [draft, setDraft] = useState<IssueDraft>({
    kind: 'Missing',
    received: '',
    affected: '',
    description: '',
  })
  const [attempted, setAttempted] = useState(false)
  useBreadcrumb([{ label: 'Report a delivery issue' }])
  if (!loaded) return null
  if (!order || order.status !== 'Delivered')
    return <Navigate to="/store-manager/deliveries" replace />
  const errors = attempted ? checkIssue(draft, order.cases) : {}
  const label = draft.kind === 'Missing' ? 'Missing' : 'Damaged'
  const base = `/store-manager/deliveries/${order.id}`
  const change = (patch: Partial<IssueDraft>) => setDraft((current) => ({ ...current, ...patch }))
  const choose = (kind: IssueKind) => change({ kind })
  const submit = () => {
    setAttempted(true)
    if (Object.keys(checkIssue(draft, order.cases)).length) return
    action.send(
      {
        kind: 'issue',
        orderId: order.id,
        issue: {
          kind: draft.kind,
          received: Number(draft.received),
          affected: Number(draft.affected),
          description: draft.description.trim(),
        },
      },
      `Report ${draft.kind.toLowerCase()} items on ${order.id}`,
      () => navigate(`${base}/issue/submitted`),
    )
  }
  return (
    <StorePage>
      <PageIntro
        title="Report a delivery issue"
        context={`${order.id} · ${kindSlash(order)} · ${countText(order.cases, order)} expected`}
      />
      <section className="sm-panel" aria-label="Issue report">
        <h2 className="sm-h22">What needs attention?</h2>
        <div className="sm-segments" role="group" aria-label="Type of issue">
          {(['Missing', 'Damaged'] as const).map((kind) => (
            <Action
              key={kind}
              variant={draft.kind === kind ? 'primary' : 'grey'}
              aria-pressed={draft.kind === kind}
              onClick={() => choose(kind)}
            >
              {kind} items
            </Action>
          ))}
        </div>
        <div className="sm-pair">
          <FieldInput
            label="Cases received · required"
            inputMode="numeric"
            value={draft.received}
            error={errors.received}
            onChange={(event) => change({ received: event.target.value })}
          />
          <FieldInput
            label={`${label} cases · required`}
            inputMode="numeric"
            value={draft.affected}
            error={errors.affected}
            onChange={(event) => change({ affected: event.target.value })}
          />
        </div>
        <FieldInput
          label="What happened · required"
          value={draft.description}
          error={errors.description}
          placeholder={
            draft.kind === 'Missing'
              ? 'Example: Two cases are missing from the delivery.'
              : 'Example: Two cases arrived crushed, with damaged contents.'
          }
          onChange={(event) => change({ description: event.target.value })}
        />
        <div className="sm-summary">
          <h3>Receipt record after submission</h3>
          <p>{issueSummary(draft, order.cases)}</p>
          <p className="sm-muted">
            Your report stays linked to the original order and delivery photograph.
          </p>
        </div>
        <Callout title="Reporting does not mean all goods are accepted">
          The discrepancy is recorded for follow-up. No replacement or refund is promised
          automatically.
        </Callout>
        <div className="sm-actions">
          <Action onClick={submit} disabled={action.isPending}>
            Submit {draft.kind === 'Missing' ? 'missing-item' : 'damage'} report
          </Action>
          <ActionLink
            variant="outline"
            to={order.receipt === 'Pending' ? `${base}/receipt` : '/store-manager/deliveries'}
          >
            Cancel and return to receipt
          </ActionLink>
        </div>
      </section>
    </StorePage>
  )
}
