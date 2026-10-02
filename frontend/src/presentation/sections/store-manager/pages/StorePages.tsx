import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Snowflake, ArrowRight, Truck, CheckCircle2 } from 'lucide-react'
import { useOperations, useAction } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'
import { Button } from '../../../shared/atoms/button'
import { Input } from '../../../shared/atoms/input'
import { Textarea } from '../../../shared/atoms/textarea'
import {
  PageHeading,
  Panel,
  Notice,
  StatusBadge,
  Field,
  Modal,
  Metric,
  EmptyState,
} from '../../../shared/molecules/Common'
import { EvidenceDetails } from '../../../shared/organisms/EvidenceDetails'
const OperationsMap = lazy(() => import('../../../shared/organisms/OperationsMap'))

export function StoreOrdersPage({ overview = false }: { overview?: boolean }) {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  const [open, setOpen] = useState(false),
    [editId, setEditId] = useState<string | null>(null),
    [cases, setCases] = useState(18),
    [temperature, setTemperature] = useState<'Chilled' | 'Ambient'>('Chilled'),
    [window, setWindow] = useState('05:30'),
    [review, setReview] = useState(false)
  if (!data) return null
  const orders = data.orders.filter((o) => o.outlet === 'OUT001'),
    closed = data.settings.cutoffClosed
  const begin = (id?: string) => {
    const order = orders.find((o) => o.id === id)
    setEditId(id ?? null)
    setCases(order?.cases ?? 18)
    setTemperature(order?.temperature ?? 'Chilled')
    setWindow(order?.window ?? '05:30')
    setReview(false)
    setOpen(true)
  }
  return (
    <>
      <PageHeading
        eyebrow="OUT001 · Fresh Wattala"
        title={overview ? 'Your store overview' : 'Order placement'}
        description="Delivery Saturday, 26 September · Friday intake, 15:42"
        action={
          <Button onClick={() => begin()}>
            <Package size={16} />
            {closed ? 'Save next-run draft' : 'Create orders'}
          </Button>
        }
      />
      <Notice
        title={closed ? 'The 4 PM cutoff has passed' : '18 minutes to place tomorrow’s orders'}
        tone={closed ? 'warning' : 'neutral'}
      >
        {closed
          ? 'New demand is saved as a draft for the next eligible run.'
          : 'Daily cutoff · 4:00 PM Sri Lanka time. Chilled and dry groceries are separate records.'}
      </Notice>
      {overview && (
        <div className="metrics">
          <Metric label="Your orders" value={orders.length} detail="Chilled and ambient demand" />
          <Metric
            label="On the way"
            value={orders.filter((o) => o.status === 'En route').length}
            detail="Released by dispatch"
          />
          <Metric
            label="Delivered"
            value={orders.filter((o) => o.status === 'Delivered').length}
            detail="Receipt confirmation is a separate step"
          />
        </div>
      )}
      <Panel title="Tomorrow’s orders" description="OUT001 offers dry groceries and chilled goods.">
        {orders.map((o) => (
          <div className="list-row" key={o.id}>
            <div className="p-3 rounded-lg bg-muted text-muted-foreground">
              {o.temperature === 'Chilled' ? <Snowflake size={22} /> : <Package size={22} />}
            </div>
            <div className="flex-1">
              <div className="eyebrow !mb-1">
                Fresh · {o.temperature === 'Chilled' ? 'Chilled' : 'Dry'}
              </div>
              <h3>
                {o.temperature === 'Chilled' ? 'Chilled groceries' : 'Dry groceries · Ambient'}
              </h3>
              <p className="text-xs text-muted-foreground mt-2">
                {o.cases} cases · {o.weight} kg · {o.volume} m³
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {o.id} · Window {o.window}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <StatusBadge>{o.status}</StatusBadge>
              <Button variant="outline" size="sm" disabled={closed} onClick={() => begin(o.id)}>
                Edit order
              </Button>
            </div>
          </div>
        ))}
      </Panel>
      {data.drafts.length > 0 && (
        <Panel className="mt-6" title="Saved for the next run">
          {data.drafts.map((d) => (
            <div key={d.id} className="list-row">
              <div className="flex-1">
                <strong>Fresh · {d.temperature}</strong>
                <p className="text-xs text-muted-foreground mt-1">
                  {d.cases} cases · {d.window} · saved locally
                </p>
              </div>
              <StatusBadge tone="neutral">Draft</StatusBadge>
            </div>
          ))}
        </Panel>
      )}
      <div className="flex gap-3 mt-6">
        <Link to="/store-manager/deliveries">
          <Button variant="outline">
            View deliveries
            <Truck size={16} />
          </Button>
        </Link>
        <Link to="/store-manager/alerts">
          <Button variant="ghost">
            View alerts
            <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
      <Modal
        title={review ? 'Review order' : editId ? 'Edit order' : 'Create a separate order'}
        description="Dry and chilled goods are submitted as separate order records."
        open={open}
        onOpenChange={setOpen}
      >
        {review ? (
          <>
            <Panel>
              <div className="panel-body">
                <strong>Fresh · {temperature}</strong>
                <p className="text-sm text-muted-foreground mt-2">
                  {cases} cases · Window {window}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {closed
                    ? 'Draft for the next eligible run'
                    : 'Will be added to the Dispatcher queue'}
                </p>
              </div>
            </Panel>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setReview(false)}>
                Edit
              </Button>
              <Button
                disabled={action.isPending}
                onClick={() =>
                  action.run(
                    async () => {
                      if (closed) await service.saveDraft(temperature, cases, window)
                      else if (editId) await service.editOrder(editId, cases, window)
                      else await service.createOrder(temperature, cases, window)
                      setOpen(false)
                    },
                    closed ? 'Draft saved for the next run' : 'Order confirmed',
                  )
                }
              >
                {closed ? 'Save draft' : 'Confirm order'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label="Demand">
              <select
                className="native-select"
                value={temperature}
                disabled={!!editId}
                onChange={(e) => setTemperature(e.target.value as 'Ambient' | 'Chilled')}
              >
                <option value="Chilled">Fresh · Chilled groceries</option>
                <option value="Ambient">Fresh · Dry groceries</option>
              </select>
            </Field>
            <Field label="Cases">
              <Input
                type="number"
                min={1}
                max={100}
                value={cases}
                onChange={(e) => setCases(Number(e.target.value))}
              />
            </Field>
            <Field label="Delivery window starts">
              <select
                className="native-select"
                value={window}
                onChange={(e) => setWindow(e.target.value)}
              >
                {['05:30', '06:00', '06:30', '07:00', '08:30', '10:00'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Button
              disabled={!Number.isInteger(cases) || cases < 1 || cases > 100}
              onClick={() => setReview(true)}
            >
              Review order
              <ArrowRight size={16} />
            </Button>
          </>
        )}
      </Modal>
    </>
  )
}

export function StoreDeliveriesPage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  const [proof, setProof] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null),
    [mode, setMode] = useState<'receipt' | 'issue'>('receipt'),
    [issue, setIssue] = useState(''),
    [checked, setChecked] = useState(false)
  if (!data) return null
  const orders = data.orders.filter((o) => o.outlet === 'OUT001'),
    order = orders.find((o) => o.id === selected)
  return (
    <>
      <PageHeading
        title="Deliveries"
        description="Track your assigned vehicle, then confirm the physical handoff."
      />
      <div className="split-grid">
        <div className="space-y-5">
          {orders.map((o) => (
            <Panel
              key={o.id}
              title={`${o.id} · Fresh ${o.temperature}`}
              action={<StatusBadge>{o.status}</StatusBadge>}
            >
              <div className="panel-body">
                <p className="text-sm">
                  {o.cases} cases · {o.weight} kg · {o.volume} m³
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Window {o.window} · {o.vehicleId ?? 'Vehicle assignment pending'}
                </p>
                <div className="flex justify-between mt-5 items-center">
                  <span className="text-xs text-muted-foreground">Store receipt</span>
                  <StatusBadge>{o.receipt}</StatusBadge>
                </div>
                {o.issue && <Notice title="Issue recorded">{o.issue}</Notice>}
                <div className="flex flex-wrap gap-2 mt-4">
                  {data.stops.find((stop) => stop.orderIds.includes(o.id))?.proofId && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setProof(data.stops.find((stop) => stop.orderIds.includes(o.id))!.proofId!)
                      }
                    >
                      View driver evidence
                    </Button>
                  )}
                  <Button
                    disabled={o.status !== 'Delivered' || o.receipt !== 'Pending'}
                    onClick={() => {
                      setSelected(o.id)
                      setMode('receipt')
                      setChecked(false)
                    }}
                  >
                    Confirm receipt
                  </Button>
                  <Button
                    variant="outline"
                    disabled={o.status !== 'Delivered' || o.receipt !== 'Pending'}
                    onClick={() => {
                      setSelected(o.id)
                      setMode('issue')
                      setIssue('')
                    }}
                  >
                    Report missing / damaged
                  </Button>
                </div>
                {o.status !== 'Delivered' && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Receipt becomes available after delivery proof is accepted.
                  </p>
                )}
              </div>
            </Panel>
          ))}
        </div>
        <Panel title="Assigned delivery route" description="OUT001 · receiving at the rear dock">
          <div className="p-3">
            <Suspense fallback={<div className="h-80 grid place-items-center">Opening map…</div>}>
              <OperationsMap
                stops={data.stops}
                vehicles={
                  data.settings.routeStarted ? data.vehicles.filter((v) => v.id === 'VEH055') : []
                }
                offline={data.settings.simulatedOffline}
              />
            </Suspense>
          </div>
          <div className="panel-body border-t">
            <strong className="text-sm">ETA 05:40 · Window 05:30–07:30</strong>
            <p className="text-xs text-muted-foreground mt-2">
              Demo route · actual GPS and ETA updates require backend integration.
            </p>
          </div>
        </Panel>
      </div>
      <Modal
        title="Driver evidence"
        open={!!proof}
        onOpenChange={(open) => {
          if (!open) setProof(null)
        }}
      >
        {proof && <EvidenceDetails evidenceId={proof} />}
      </Modal>
      <Modal
        title={mode === 'receipt' ? 'Confirm physical receipt' : 'Report a delivery issue'}
        description={order ? `${order.id} · ${order.cases} cases` : undefined}
        open={!!order}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {mode === 'receipt' ? (
          <>
            <Notice title="Driver proof and store receipt are separate" tone="neutral">
              Check quantities and condition before closing the handoff.
            </Notice>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1 accent-orange-600"
              />
              I checked the physical delivery and received all goods in acceptable condition.
            </label>
          </>
        ) : (
          <Field label="Affected items, quantities, and issue">
            <Textarea
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="Example: 2 milk cases damaged on arrival"
            />
          </Field>
        )}
        <Button
          disabled={action.isPending || (mode === 'receipt' ? !checked : issue.trim().length < 4)}
          onClick={() =>
            action.run(
              async () => {
                await service.confirmReceipt(selected!, mode === 'issue' ? issue : undefined)
                setSelected(null)
              },
              mode === 'receipt'
                ? 'Receipt confirmed'
                : 'Issue recorded; resolution is still pending',
            )
          }
        >
          {mode === 'receipt' ? 'Confirm receipt' : 'Submit issue'}
        </Button>
      </Modal>
    </>
  )
}

export function StoreAlertsPage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  if (!data) return null
  const deferred = data.orders.filter((o) => o.outlet === 'OUT001' && o.status === 'Deferred')
  return (
    <>
      <PageHeading
        title="Store alerts"
        description="Allocation notices, delivery issues, and actions that need acknowledgment."
      />
      <Panel>
        {deferred.map((o) => (
          <div className="panel-body border-b" key={o.id}>
            <StatusBadge tone="warning">Deferred</StatusBadge>
            <h3 className="mt-3">{o.id} · Next eligible run</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {o.deferralReason ?? 'Dispatcher is recording the reason.'}
            </p>
            <Button
              className="mt-4"
              variant="outline"
              disabled={!o.deferralReason || o.deferralAcknowledged || action.isPending}
              onClick={() =>
                action.run(() => service.acknowledgeDeferral(o.id), 'Notice acknowledged')
              }
            >
              {o.deferralAcknowledged ? (
                <>
                  <CheckCircle2 size={16} />
                  Acknowledged
                </>
              ) : (
                'Acknowledge notice'
              )}
            </Button>
          </div>
        ))}
        {data.orders
          .filter((o) => o.outlet === 'OUT001' && o.issue)
          .map((o) => (
            <div className="panel-body border-b" key={o.id}>
              <h3>{o.id} · Issue submitted</h3>
              <p className="text-sm text-muted-foreground mt-2">{o.issue}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Recorded locally · awaiting operational resolution
              </p>
            </div>
          ))}
        {!deferred.length && !data.orders.some((o) => o.outlet === 'OUT001' && o.issue) && (
          <EmptyState
            title="No store alerts"
            description="Deferrals and receiving issues will appear here when they need attention."
          />
        )}
      </Panel>
    </>
  )
}
