import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Circle, WandSparkles, Truck, ShieldCheck } from 'lucide-react'
import { useOperations, useAction, useEvidence } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'
import { Button } from '../../../shared/atoms/button'
import {
  PageHeading,
  Metric,
  Panel,
  Notice,
  StatusBadge,
  Modal,
  Field,
  CapacityBar,
  EmptyState,
} from '../../../shared/molecules/Common'
import { PlanningSteps } from '../organisms/PlanningSteps'
import { publicationErrors, departureErrors } from '../../../../domain/rules'

export function AllocationPage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  const [selected, setSelected] = useState<string | null>(null),
    [vehicle, setVehicle] = useState('VEH055'),
    [trip, setTrip] = useState(1)
  if (!data) return null
  const order = data.orders.find((o) => o.id === selected)
  return (
    <>
      <PageHeading
        title="Planning & allocation"
        description="Build compatible trips. Weight, volume, temperature, and priority are checked together."
        action={
          <Button
            disabled={action.isPending || data.settings.published}
            onClick={() =>
              action.run(
                () => service.autoAllocate(),
                'Allocation proposed. Review the checks before publishing.',
              )
            }
          >
            <WandSparkles size={16} />
            Propose allocations
          </Button>
        }
      />
      <PlanningSteps current={1} />
      <div className="metrics">
        <Metric
          label="Allocated"
          value={data.orders.filter((o) => o.vehicleId).length}
          detail="Orders assigned to valid trips"
        />
        <Metric
          label="Awaiting allocation"
          value={data.orders.filter((o) => o.status === 'Confirmed').length}
          detail="Allocate or record a deferral"
        />
        <Metric
          label="Priority outlets"
          value={data.orders.filter((o) => o.priority).length}
          detail="Previously skipped · must be served"
        />
      </div>
      {data.settings.published && (
        <Notice tone="success" title="Plan published">
          Allocations are locked. Continue to departure readiness.
        </Notice>
      )}
      <Panel
        title="Trip allocation"
        description="Select an order to choose its vehicle and trip."
        action={
          <Link to="/dispatcher/review">
            <Button variant="outline" size="sm">
              Review plan
              <ArrowRight size={14} />
            </Button>
          </Link>
        }
      >
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order / outlet</th>
                <th>Demand</th>
                <th>Required capacity</th>
                <th>Vehicle / trip</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.id}</strong>
                    <small>
                      {o.outlet}
                      {o.priority ? ' · priority' : ''}
                    </small>
                  </td>
                  <td>
                    <span className={`brand-pill ${o.brand.toLowerCase()}`}>{o.brand}</span>
                    <small>{o.temperature}</small>
                  </td>
                  <td>
                    {o.weight} kg · {o.volume} m³
                  </td>
                  <td>{o.vehicleId ? `${o.vehicleId} · Trip ${o.trip}` : '—'}</td>
                  <td>
                    <StatusBadge>{o.status}</StatusBadge>
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.settings.published}
                      onClick={() => {
                        setSelected(o.id)
                        setVehicle(o.vehicleId ?? 'VEH055')
                        setTrip(o.trip ?? 1)
                      }}
                    >
                      Allocate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Modal
        title="Allocate order"
        description={
          order
            ? `${order.id} · ${order.weight} kg · ${order.volume} m³ · ${order.temperature}`
            : undefined
        }
        open={!!order}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        <Field label="Vehicle">
          <select
            className="native-select"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
          >
            {data.vehicles
              .filter((v) => v.brand === order?.brand)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id} · {v.reefer ? 'Reefer' : 'Ambient'} {v.type} · {v.volumeCapacity} m³
                </option>
              ))}
          </select>
        </Field>
        <Field label="Daily trip">
          <select
            className="native-select"
            value={trip}
            onChange={(e) => setTrip(Number(e.target.value))}
          >
            <option value={1}>Trip 1</option>
            <option value={2}>Trip 2</option>
            <option value={3}>Trip 3 · demonstrates limit</option>
          </select>
        </Field>
        <Notice title="Capacity is enforced">
          Assignments cannot exceed weight, volume, temperature, demand compatibility, or two trips.
        </Notice>
        <Button
          disabled={action.isPending}
          onClick={() =>
            action.run(async () => {
              await service.allocate(selected!, vehicle, trip)
              setSelected(null)
            }, 'Order allocated')
          }
        >
          Confirm allocation
        </Button>
      </Modal>
    </>
  )
}

export function DeferralsPage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  const [selected, setSelected] = useState(''),
    [reason, setReason] = useState('Volume capacity unavailable')
  if (!data) return null
  const deferred = data.orders.filter((o) => o.status === 'Deferred')
  return (
    <>
      <PageHeading
        title="Deferrals"
        description="Every unserved order needs an explicit reason. Previously skipped outlets keep their priority."
        action={
          <Button
            variant="outline"
            disabled={data.settings.published}
            onClick={() => {
              setSelected(data.orders.find((o) => !o.priority)?.id ?? '')
              setReason('Volume capacity unavailable')
            }}
          >
            Record a deferral
          </Button>
        }
      />
      <PlanningSteps current={2} />
      <div className="metrics">
        <Metric
          label="Deferred orders"
          value={deferred.length}
          detail="Scheduled for the next eligible run"
        />
        <Metric
          label="Reasons recorded"
          value={deferred.filter((o) => o.deferralReason).length}
          detail="Required before publication"
        />
        <Metric
          label="Priority violations"
          value={deferred.filter((o) => o.priority).length}
          detail="Restore allocation before review"
        />
      </div>
      <Panel title="Deferred demand">
        {deferred.length ? (
          deferred.map((o) => (
            <div key={o.id} className="list-row">
              <div className="flex-1">
                <strong>
                  {o.id} · {o.outlet}
                </strong>
                <p className="text-xs text-muted-foreground mt-1">
                  {o.deferralReason ?? 'Reason required'} · {o.weight} kg · {o.volume} m³
                </p>
              </div>
              <StatusBadge tone={o.deferralReason ? 'neutral' : 'warning'}>
                {o.deferralReason ? 'Reason recorded' : 'Reason required'}
              </StatusBadge>
              <Button
                variant="outline"
                size="sm"
                disabled={data.settings.published}
                onClick={() => setSelected(o.id)}
              >
                Edit
              </Button>
            </div>
          ))
        ) : (
          <EmptyState
            title="No deferred orders"
            description="When a trip cannot serve an order, record its reason here before publication."
          />
        )}
      </Panel>
      <div className="flex justify-end mt-5">
        <Link to="/dispatcher/review">
          <Button>
            Continue to review
            <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
      <Modal
        title="Record deferral reason"
        description="The store sees this reason and the next eligible delivery run."
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected('')
        }}
      >
        <Field label="Order">
          <select
            className="native-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {data.orders
              .filter((o) => !o.priority)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id} · {o.outlet}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Reason">
          <select
            className="native-select"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {[
              'Volume capacity unavailable',
              'Weight capacity unavailable',
              'Refrigerated vehicle unavailable',
              'Two-trip limit reached',
              'Delivery window cannot be met',
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Button
          disabled={action.isPending}
          onClick={() =>
            action.run(async () => {
              await service.defer(selected, reason)
              setSelected('')
            }, 'Deferral reason recorded')
          }
        >
          Save reason
        </Button>
      </Modal>
    </>
  )
}

export function ReviewPage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  if (!data) return null
  const errors = publicationErrors(data),
    deferred = data.orders.filter((o) => o.status === 'Deferred')
  const checks = [
    ['Intake closed', data.settings.cutoffClosed, '16:00 cutoff · confirmed demand locked'],
    [
      'Vehicle constraints valid',
      !errors.some((e) => /limit|refrigerated|demand/.test(e)),
      'Weight, volume, temperature, and trip limits checked',
    ],
    [
      'Every order accounted for',
      !data.orders.some((o) => o.status === 'Confirmed'),
      'Every order has an allocation or explicit deferral',
    ],
    [
      'Deferral reasons complete',
      deferred.every((o) => o.deferralReason),
      'Stores receive a clear reason for the next run',
    ],
    [
      'Priority outlets protected',
      !deferred.some((o) => o.priority),
      'No outlet is unserved on consecutive delivery days',
    ],
  ] as const
  return (
    <>
      <PageHeading
        title="Review allocation"
        description={`Revision ${data.settings.routeRevision.toString().padStart(2, '0')} · Saturday, 26 September · ${data.orders.length} confirmed orders`}
      />
      <PlanningSteps current={3} />
      <div className="metrics">
        <Metric
          label="Allocated"
          value={data.orders.filter((o) => o.vehicleId).length}
          detail="Trips checked against capacity"
        />
        <Metric label="Deferred" value={deferred.length} detail="Reasons communicated to stores" />
        <Metric
          label="Priority violations"
          value={deferred.filter((o) => o.priority).length}
          detail="Previously skipped outlets protected"
        />
      </div>
      <Panel
        title={
          data.settings.published
            ? 'Plan published'
            : !errors.length
              ? 'Ready to publish'
              : 'Complete the review'
        }
      >
        <div className="panel-body">
          {checks.map(([title, valid, desc]) => (
            <div className="check-row" key={title}>
              {valid ? (
                <CheckCircle2 className="text-success shrink-0" size={20} />
              ) : (
                <Circle className="text-muted-foreground shrink-0" size={20} />
              )}
              <div>
                <strong>{title}</strong>
                <small>{desc}</small>
              </div>
              <StatusBadge tone={valid ? 'success' : 'warning'}>
                {valid ? 'Passed' : 'Required'}
              </StatusBadge>
            </div>
          ))}
        </div>
      </Panel>
      {errors.length > 0 && !data.settings.published && (
        <Notice title={errors[0]}>
          {errors.length > 1
            ? `${errors.length - 1} additional check${errors.length > 2 ? 's' : ''} require attention.`
            : 'Use the demo panel to advance the cutoff, or return to allocation.'}
        </Notice>
      )}
      <div className="flex justify-between gap-3 mt-6">
        <Link to="/dispatcher/planning">
          <Button variant="outline">Edit allocation</Button>
        </Link>
        {data.settings.published ? (
          <Link to="/dispatcher/release">
            <Button>
              Departure readiness
              <ArrowRight size={16} />
            </Button>
          </Link>
        ) : (
          <Button
            disabled={!!errors.length || action.isPending}
            onClick={() =>
              action.run(
                () => service.publish(),
                'Plan published. Loading proof is still required for departure.',
              )
            }
          >
            <ShieldCheck size={16} />
            Publish plan
          </Button>
        )}
      </div>
    </>
  )
}

export function ReleasePage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  const load = data?.loads[0],
    { url } = useEvidence(load?.photoId)
  if (!data || !load) return null
  const errors = departureErrors(data, load),
    cases = load.items.reduce((n, i) => n + i.loaded, 0),
    total = load.items.reduce((n, i) => n + i.expected, 0)
  return (
    <>
      <PageHeading
        title="Departure readiness"
        description={`Revision ${load.revision.toString().padStart(2, '0')} · Release vehicles after loading evidence is complete`}
      />
      <PlanningSteps current={4} />
      {errors.length > 0 && !load.released && (
        <Notice title="Awaiting loading evidence">{errors.join(' ')}</Notice>
      )}
      {load.released && (
        <Notice title="Vehicle released for departure" tone="success">
          The Driver workspace can now start the assigned route.
        </Notice>
      )}
      <div className="split-grid">
        <Panel
          title={`${load.vehicleId} · Trip ${load.trip} · Reefer van`}
          action={
            <StatusBadge>
              {load.released ? 'En route' : errors.length ? 'Held for proof' : 'Ready'}
            </StatusBadge>
          }
        >
          <div className="panel-body">
            <div className="check-row">
              <Truck size={19} />
              <div>
                <strong>Load sequence</strong>
                <small>
                  {cases} / {total} cases reconciled · OUT008 → OUT001
                </small>
              </div>
            </div>
            <div className="check-row">
              <ShieldCheck size={19} />
              <div>
                <strong>Safety checks</strong>
                <small>
                  {Object.values(load.checks).filter(Boolean).length} / 3 confirmed ·{' '}
                  {load.issue && !load.issueResolved
                    ? 'Shortfall unresolved'
                    : 'No unresolved shortfalls'}
                </small>
              </div>
            </div>
            <CapacityBar
              label="Weight"
              used={data.orders
                .filter((o) => o.vehicleId === load.vehicleId && o.trip === load.trip)
                .reduce((n, o) => n + o.weight, 0)}
              total={800}
              unit="kg"
            />
            <CapacityBar
              label="Volume"
              used={data.orders
                .filter((o) => o.vehicleId === load.vehicleId && o.trip === load.trip)
                .reduce((n, o) => n + o.volume, 0)}
              total={4}
              unit="m³"
            />
            <Button
              className="w-full mt-5"
              disabled={!!errors.length || load.released || action.isPending}
              onClick={() => action.run(() => service.release(load.id), 'Demo departure released')}
            >
              {load.released
                ? 'Departure released'
                : `Dispatch ${load.vehicleId} · Trip ${load.trip}`}
            </Button>
          </div>
        </Panel>
        <Panel title="Loader handoff">
          <div className="panel-body">
            {url ? (
              <img src={url} alt="Loading proof attached by the Loader" className="proof-image" />
            ) : (
              <Notice title="Loading photograph not attached">
                The loader must complete checks and attach a clear photograph of the load.
              </Notice>
            )}
            <Link to="/loader/loading">
              <Button variant="outline" className="w-full">
                Open Loader workspace
                <ArrowRight size={16} />
              </Button>
            </Link>
            {load.released && (
              <Link to="/driver/home">
                <Button variant="outline" className="w-full mt-3">
                  Open Driver workspace
                  <ArrowRight size={16} />
                </Button>
              </Link>
            )}
          </div>
        </Panel>
      </div>
    </>
  )
}
