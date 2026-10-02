import { lazy, Suspense, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { MapPin, Truck, ArrowRight, Navigation, Package, CheckCircle2, Camera } from 'lucide-react'
import {
  useOperations,
  useAction,
  useConnectivity,
  useEvidence,
} from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'
import { Button } from '../../../shared/atoms/button'
import { Input } from '../../../shared/atoms/input'
import { Textarea } from '../../../shared/atoms/textarea'
import { Checkbox } from '../../../shared/atoms/checkbox'
import {
  PageHeading,
  Panel,
  Metric,
  Notice,
  StatusBadge,
  Field,
  EmptyState,
} from '../../../shared/molecules/Common'
import { PhotoCapture } from '../../../shared/organisms/PhotoCapture'
const OperationsMap = lazy(() => import('../../../shared/organisms/OperationsMap'))

export function DriverHomePage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction(),
    navigate = useNavigate(),
    online = useConnectivity()
  const [checked, setChecked] = useState(false)
  if (!data) return null
  const next = data.stops.find((s) => s.status !== 'Delivered'),
    delivered = data.stops.filter((s) => s.status === 'Delivered').length
  return (
    <>
      <PageHeading
        eyebrow="Saturday 26 Sep · On shift"
        title={`Good morning, ${data.settings.profileName.split(' ')[0]}`}
        description={`${!online || data.settings.simulatedOffline ? 'Offline · records saved locally' : 'Online'} · VEH055 · Trip 1`}
      />
      <div className="metrics">
        <Metric
          label="Stops complete"
          value={`${delivered} / ${data.stops.length}`}
          detail="Accepted proof only"
          icon={<MapPin size={17} />}
        />
        <Metric
          label="Cases"
          value={data.stops.reduce((n, s) => n + s.cases, 0)}
          detail="Chilled + ambient goods"
          icon={<Package size={17} />}
        />
        <Metric
          label="Saved records"
          value={data.queue.filter((q) => q.status !== 'accepted').length}
          detail="Waiting for sync acceptance"
          icon={<Camera size={17} />}
        />
      </div>
      {next ? (
        <Panel title={`Up next · ${next.outlet}`} action={<StatusBadge>{next.status}</StatusBadge>}>
          <div className="panel-body">
            <h2>{next.name}</h2>
            <p className="text-sm text-muted-foreground mt-3">
              Window {next.window} · ETA {next.eta}
            </p>
            <p className="text-sm text-muted-foreground mt-2">{next.address}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <StatusBadge tone="neutral">Rear dock</StatusBadge>
              <StatusBadge tone="orange">{next.cases} cases</StatusBadge>
            </div>
            <div className="mt-6">
              {!data.settings.routeStarted ? (
                <>
                  <label className="flex items-start gap-3 text-sm mb-4">
                    <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />I
                    checked the assigned vehicle and load before departure.
                  </label>
                  <Button
                    disabled={!checked || !data.loads[0].released || action.isPending}
                    onClick={() =>
                      action.run(async () => {
                        await service.startRoute()
                        navigate('/driver/route')
                      }, 'Demo route started')
                    }
                  >
                    <Navigation size={16} />
                    Start route
                  </Button>
                  {!data.loads[0].released && (
                    <Notice title="Awaiting dispatcher release">
                      Loading checks and photograph must be completed first.{' '}
                      <Link to="/loader/loading" className="underline">
                        Open loading
                      </Link>
                    </Notice>
                  )}
                </>
              ) : (
                <Link to="/driver/route">
                  <Button>
                    Open current route
                    <ArrowRight size={16} />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Panel>
      ) : (
        <Panel>
          <EmptyState
            title="Trip complete"
            description="All stop evidence has been accepted. The outlet receipt remains a separate action."
            action={
              <Link to="/store-manager/deliveries">
                <Button variant="outline">View store handoff</Button>
              </Link>
            }
          />
        </Panel>
      )}
      <Panel className="mt-6" title="From dispatch · 05:12">
        <div className="panel-body">
          <p className="text-sm text-muted-foreground">
            Rear dock opens at 05:30. Use the curb until then. Follow the published manifest and
            delivery windows.
          </p>
        </div>
      </Panel>
    </>
  )
}

export function DriverRoutePage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction(),
    navigate = useNavigate()
  if (!data) return null
  return (
    <>
      <PageHeading
        title="Current route"
        description={`VEH055 · Trip 1 · Revision ${data.settings.routeRevision.toString().padStart(2, '0')} · ${data.stops.length} stops`}
        action={
          <Link to="/recovery">
            <Button variant="outline">Saved records</Button>
          </Link>
        }
      />
      {!data.settings.routeStarted && !data.stops.every((s) => s.status === 'Delivered') && (
        <Notice title="Before you leave">
          Complete your load check and start the route from{' '}
          <Link to="/driver/home" className="underline">
            Driver home
          </Link>
          .
        </Notice>
      )}
      <div className="split-grid">
        <Panel>
          <Suspense fallback={<div className="h-80 grid place-items-center">Opening route…</div>}>
            <OperationsMap stops={data.stops} offline={data.settings.simulatedOffline} />
          </Suspense>
          <div className="panel-body border-t">
            <h3>Delivery manifest</h3>
            <p className="text-xs text-muted-foreground mt-2">
              {data.stops.reduce((n, s) => n + s.cases, 0)} cases · stop order and windows are saved
              on this device.
            </p>
          </div>
        </Panel>
        <div className="space-y-4">
          {data.stops.map((stop, i) => (
            <Panel key={stop.id}>
              <div className="panel-body">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">
                    Stop {i + 1} · {stop.outlet}
                  </span>
                  <StatusBadge>{stop.status}</StatusBadge>
                </div>
                <h3 className="mt-3">{stop.name}</h3>
                <p className="text-xs text-muted-foreground mt-2">
                  Window {stop.window} · ETA {stop.eta}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {stop.cases} cases · {stop.address}
                </p>
                <div className="flex flex-wrap gap-2 mt-5">
                  <a
                    href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=6.953%2C79.884%3B${stop.lat}%2C${stop.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <Navigation size={14} />
                      Directions
                    </Button>
                  </a>
                  {stop.status === 'Upcoming' ? (
                    <Button
                      size="sm"
                      disabled={!data.settings.routeStarted || action.isPending}
                      onClick={() =>
                        action.run(async () => {
                          await service.arrive(stop.id)
                          navigate(`/driver/delivery?stop=${stop.id}`)
                        }, 'Arrival recorded')
                      }
                    >
                      Arrive & park
                    </Button>
                  ) : stop.status === 'Delivered' ? (
                    <CheckCircle2 className="text-success" size={21} />
                  ) : stop.status === 'Cannot deliver' ? (
                    <Link to="/driver/issues">
                      <Button variant="outline" size="sm">
                        View attempt
                      </Button>
                    </Link>
                  ) : (
                    <Link to={`/driver/delivery?stop=${stop.id}`}>
                      <Button size="sm">Record handoff</Button>
                    </Link>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </>
  )
}

export function DriverDeliveryPage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction(),
    [params] = useSearchParams()
  const [selected, setSelected] = useState(params.get('stop') ?? 'STOP001'),
    [quantity, setQuantity] = useState<number | null>(null),
    [receiver, setReceiver] = useState(''),
    [exception, setException] = useState(''),
    [acknowledged, setAcknowledged] = useState(false)
  const savedStop = data?.stops.find((s) => s.id === selected)
  const { evidence } = useEvidence(savedStop?.proofId)
  if (!data) return null
  if (!data.stops.length)
    return (
      <EmptyState
        title="No assigned deliveries"
        description="Allocate demand to VEH055 Trip 1 and publish the plan."
      />
    )
  const stop = data.stops.find((s) => s.id === selected) ?? data.stops[0],
    count = quantity ?? evidence?.quantity ?? stop.cases
  const pending = data.queue.find((q) => q.stopId === stop.id && q.status !== 'accepted')
  return (
    <>
      <PageHeading
        title="Delivery evidence"
        description={`${stop.outlet} · ${stop.name} · ${stop.cases} cases`}
      />
      <div className="max-w-3xl space-y-5">
        <Field label="Delivery stop">
          <select
            className="native-select"
            value={stop.id}
            onChange={(e) => {
              setSelected(e.target.value)
              setQuantity(null)
              setReceiver('')
              setException('')
              setAcknowledged(false)
            }}
          >
            {data.stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.outlet} · {s.name}
              </option>
            ))}
          </select>
        </Field>
        {stop.status === 'Upcoming' ? (
          <Notice title="Arrive and park before recording evidence">
            Open the route and confirm arrival at this outlet.{' '}
            <Link to="/driver/route" className="underline">
              Current route
            </Link>
          </Notice>
        ) : stop.status === 'Delivered' ? (
          <Notice title="Delivery proof accepted" tone="success">
            The store can now confirm receipt independently.
          </Notice>
        ) : (
          <Notice title="Local attachment is not yet an accepted delivery" tone="neutral">
            Save the photo, quantity, and receiver acknowledgment, then sync the record from
            Recovery.
          </Notice>
        )}
        <Panel title="Verify the handoff">
          <div className="panel-body space-y-5">
            <div className="form-grid">
              <Field label="Cases delivered">
                <Input
                  type="number"
                  min={0}
                  max={stop.cases}
                  value={count}
                  disabled={!!pending || stop.status === 'Delivered'}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </Field>
              <Field label="Receiver name">
                <Input
                  value={
                    pending || stop.status === 'Delivered' ? (evidence?.receiver ?? '') : receiver
                  }
                  disabled={!!pending || stop.status === 'Delivered'}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="Person receiving the goods"
                />
              </Field>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={
                  pending || stop.status === 'Delivered' ? !!evidence?.receiver : acknowledged
                }
                disabled={!!pending || stop.status === 'Delivered'}
                onCheckedChange={(v) => setAcknowledged(v === true)}
              />
              The named receiver acknowledged the quantity and handoff.
            </label>
            <Field
              label="Quantity or receiver exception"
              hint="Required if cases are missing or the receiver cannot acknowledge."
            >
              <Textarea
                value={
                  pending || stop.status === 'Delivered'
                    ? (evidence?.receiverException ?? '')
                    : exception
                }
                disabled={!!pending || stop.status === 'Delivered'}
                onChange={(e) => setException(e.target.value)}
                placeholder="Explain a shortfall or unavailable sign-off"
              />
            </Field>
            <PhotoCapture
              evidenceId={stop.proofId}
              disabled={!['Arrived', 'Proof pending'].includes(stop.status) || !!pending}
              busy={action.isPending}
              saveLabel="Save proof on this device"
              onSave={(file) =>
                action.mutateAsync(() =>
                  service.saveDeliveryProof(
                    stop.id,
                    file,
                    count,
                    acknowledged ? receiver : '',
                    exception,
                  ),
                )
              }
            />
            {pending && (
              <Link to="/recovery">
                <Button className="w-full">
                  Open Recovery to sync proof
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

export function DriverIssuesPage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  const [stop, setStop] = useState('STOP001'),
    [issue, setIssue] = useState('')
  if (!data) return null
  const reported = data.stops.filter((s) => s.issue)
  const current = data.stops.find((s) => s.id === stop)
  if (!current) return <EmptyState title="No assigned deliveries" />
  const hasPending = data.queue.some((q) => q.stopId === stop && q.status !== 'accepted')
  return (
    <>
      <PageHeading
        title="Delivery issues"
        description="Preserve the reason and attempt photograph. Delivery remains incomplete."
      />
      <div className="split-grid">
        <Panel title="Cannot deliver">
          <div className="panel-body space-y-4">
            <Field label="Affected stop">
              <select
                className="native-select"
                value={stop}
                onChange={(e) => {
                  setStop(e.target.value)
                  setIssue('')
                }}
              >
                {data.stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.outlet} · {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reason and attempt details">
              <Textarea
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="Outlet closed; attempted rear dock at 05:40"
              />
            </Field>
            <PhotoCapture
              evidenceId={current.status === 'Cannot deliver' ? current.proofId : undefined}
              disabled={
                !data.settings.routeStarted ||
                issue.trim().length < 4 ||
                hasPending ||
                ['Delivered', 'Proof pending'].includes(current.status)
              }
              busy={action.isPending}
              saveLabel="Save unsuccessful attempt"
              onSave={(file) =>
                action.mutateAsync(() => service.saveAttemptProof(stop, file, issue))
              }
            />
            {hasPending && (
              <Link to="/recovery">
                <Button variant="outline">Sync saved attempt evidence</Button>
              </Link>
            )}
          </div>
        </Panel>
        <Panel title="Reported attempts">
          {reported.length ? (
            reported.map((s) => (
              <div key={s.id} className="list-row">
                <div className="flex-1">
                  <strong>
                    {s.outlet} · {s.name}
                  </strong>
                  <p className="text-xs text-muted-foreground mt-2">{s.issue}</p>
                  <Button
                    className="mt-3"
                    variant="outline"
                    size="sm"
                    disabled={
                      action.isPending ||
                      data.queue.some((q) => q.stopId === s.id && q.status !== 'accepted')
                    }
                    onClick={() =>
                      action.run(
                        () => service.retryStop(s.id),
                        'Stop reopened. Previous evidence retained.',
                      )
                    }
                  >
                    Retry delivery stop
                  </Button>
                </div>
                <StatusBadge>{s.status}</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              title="No delivery issues"
              description="Recorded attempts will remain visible here."
            />
          )}
        </Panel>
      </div>
      <div className="mt-5">
        <Link to="/recovery">
          <Button variant="outline">
            Offline evidence & retries
            <Truck size={16} />
          </Button>
        </Link>
      </div>
    </>
  )
}
