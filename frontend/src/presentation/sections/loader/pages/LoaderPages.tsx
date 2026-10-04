import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Camera, ClipboardCheck, PackageCheck, Truck } from 'lucide-react'
import { useAction, useConnectivity } from '../../../hooks/useOperations'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useApis } from '../../../providers/ApisContext'
import { useSession } from '../../../session/useSession'
import { Button } from '../../../shared/atoms/button'
import { Input } from '../../../shared/atoms/input'
import { Checkbox } from '../../../shared/atoms/checkbox'
import { Textarea } from '../../../shared/atoms/textarea'
import {
  PageHeading,
  Metric,
  Panel,
  StatusBadge,
  Notice,
  CapacityBar,
  Modal,
  Field,
  EmptyState,
} from '../../../shared/molecules/Common'
import { PhotoCapture } from '../../../shared/organisms/PhotoCapture'
import { loadErrors } from '../../../../domain/rules'
import type { Load, LoadIssueInput } from '../../../../domain/models'
import '../loader.css'

function loadStatus(load: Load, published: boolean) {
  if (load.released) return 'En route'
  if (!published) return 'Awaiting publication'
  if (!load.issueResolved) return 'Held'
  if (load.acknowledgedRevision !== undefined && load.acknowledgedRevision !== load.revision)
    return 'Review required'
  if (load.completed) return 'Awaiting Dispatcher release'
  return load.items.some((item) => item.loaded > 0) ? 'Loading' : 'Not started'
}

function LocalSaveNotice() {
  const online = useConnectivity()
  return (
    <Notice
      tone="neutral"
      title={online ? 'Saved on this device · Not synced' : 'Offline · saved on this device'}
    />
  )
}

export function LoaderLegacyPage() {
  return <Navigate to="/loader/queue" replace />
}

export function LoaderQueuePage() {
  const session = useSession()
  const query = useApiQuery(['loading', 'queue', session.depot], async (apis) => {
    if (!session.depot) return { loads: [], published: false }
    const loads = await apis.loading.listLoads({ depot: session.depot })
    const status = await apis.orders.getIntakeStatus()
    return { loads, published: status.published }
  })
  const loads = query.data?.loads ?? []
  return (
    <div className="loader-page">
      <PageHeading
        eyebrow={session.depot ? `Loading · ${session.depot} depot` : 'Loading'}
        title="Shift dashboard"
      />
      <LocalSaveNotice />
      {query.isPending ? (
        <Notice title="Loading shift queue…" />
      ) : query.isError ? (
        <Notice tone="danger" title="Could not load the shift queue">
          <p>{query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </Notice>
      ) : !session.depot ? (
        <EmptyState
          title="No depot assigned"
          description="Ask your administrator to assign a depot."
        />
      ) : (
        <>
          <div className="metrics">
            <Metric label="Assigned loads" value={loads.length} icon={<Truck size={17} />} />
            <Metric
              label="Awaiting release"
              value={loads.filter((load) => load.completed && !load.released).length}
              icon={<ClipboardCheck size={17} />}
            />
            <Metric
              label="Cases remaining"
              value={loads
                .filter((load) => !load.released)
                .reduce(
                  (sum, load) =>
                    sum +
                    load.items.reduce((total, item) => total + item.expected - item.loaded, 0),
                  0,
                )}
              icon={<PackageCheck size={17} />}
            />
          </div>
          <Panel title="Your loading queue">
            {!loads.length && (
              <EmptyState
                title="No loads assigned"
                description="Published loads for your depot will appear here."
              />
            )}
            {loads.map((load) => (
              <div className="loader-queue-row" key={load.id}>
                <Truck size={24} aria-hidden="true" />
                <div className="loader-queue-details">
                  <strong>
                    {load.vehicleId} · Trip {load.trip}
                  </strong>
                  <p>
                    Bay {load.bay} · Revision {load.revision} · Departure{' '}
                    {load.departureTime ?? 'Not scheduled'}
                  </p>
                  <p>
                    {load.items.reduce((total, item) => total + item.loaded, 0)} /{' '}
                    {load.items.reduce((total, item) => total + item.expected, 0)} cases loaded
                  </p>
                </div>
                <div className="loader-queue-actions">
                  <StatusBadge>{loadStatus(load, query.data?.published ?? false)}</StatusBadge>
                  <Link to={`/loader/loading/${load.id}`}>
                    <Button>
                      <ArrowRight size={16} />
                      Open load
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </Panel>
        </>
      )}
    </div>
  )
}

const checks: [keyof Load['checks'], string][] = [
  ['refrigeration', 'Refrigeration working for chilled goods'],
  ['condition', 'Goods condition checked'],
  ['restraints', 'Restraints secured and stop order checked'],
]

export function LoaderWorkspacePage({ proofOnly = false }: { proofOnly?: boolean }) {
  const { loadId = '' } = useParams()
  const session = useSession()
  const apis = useApis()
  const action = useAction()
  const query = useApiQuery(['loading', 'workspace', loadId, session.depot], async (apis) =>
    session.depot ? ((await apis.loading.getWorkspace(loadId, session.depot)) ?? null) : null,
  )
  const [issueOpen, setIssueOpen] = useState(false)
  const [issue, setIssue] = useState<LoadIssueInput>({
    kind: 'Missing',
    outlet: '',
    affectedCases: 1,
    description: '',
  })
  const heading = (
    <PageHeading title={proofOnly ? 'Loading photograph & handoff' : 'Loading workspace'} />
  )
  if (!loadId) return <Navigate to="/loader/queue" replace />
  if (query.isPending)
    return (
      <div className="loader-page">
        {heading}
        <Notice title="Loading manifest…" />
      </div>
    )
  if (query.isError)
    return (
      <div className="loader-page">
        {heading}
        <Notice title="Could not load the manifest" tone="danger">
          {query.error.message}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </Notice>
      </div>
    )
  if (!query.data)
    return (
      <div className="loader-page">
        {heading}
        <EmptyState
          title="Load unavailable"
          description="This load does not exist or is not assigned to your depot."
          action={
            <Link to="/loader/queue">
              <Button>Return to queue</Button>
            </Link>
          }
        />
      </div>
    )
  const { load, vehicle, published, weight, volume } = query.data
  const errors = loadErrors(load)
  const total = load.items.reduce((sum, item) => sum + item.expected, 0)
  const loaded = load.items.reduce((sum, item) => sum + item.loaded, 0)
  const needsReview =
    load.acknowledgedRevision !== undefined && load.acknowledgedRevision !== load.revision
  const locked = !published || load.released || needsReview || action.isPending
  const issueItem = load.items.find((item) => item.outlet === issue.outlet)
  const validIssue =
    !!issueItem &&
    Number.isInteger(issue.affectedCases) &&
    issue.affectedCases > 0 &&
    issue.affectedCases <= issueItem.expected &&
    issue.description.trim().length > 3
  return (
    <div className="loader-page">
      <Link to="/loader/queue" className="loader-back">
        <ArrowLeft size={16} />
        Shift dashboard
      </Link>
      <PageHeading
        eyebrow={`${load.depot} · Bay ${load.bay}`}
        title={proofOnly ? 'Loading photograph & handoff' : 'Loading workspace'}
        description={`${load.vehicleId} · Trip ${load.trip} · Revision ${load.revision} · Departure ${load.departureTime ?? 'Not scheduled'}`}
        action={<StatusBadge>{loadStatus(load, published)}</StatusBadge>}
      />
      <LocalSaveNotice />
      {!published && (
        <Notice title="Awaiting published instructions">
          Dispatcher must review and publish the allocation before loading can begin.
        </Notice>
      )}
      {!load.issueResolved && (
        <Notice title="Load held · awaiting Dispatcher decision" tone="danger">
          {load.issue}
          <p>Do not complete loading or depart until the shortfall is resolved.</p>
        </Notice>
      )}
      {needsReview && (
        <Notice title={`Review changed instructions · Revision ${load.revision}`}>
          <ul>
            {(load.revisionChanges ?? ['Review the current manifest and repeat all checks.']).map(
              (change) => (
                <li key={change}>{change}</li>
              ),
            )}
          </ul>
          <Button
            disabled={action.isPending || !load.issueResolved || load.released}
            onClick={() =>
              action.run(
                () => apis.loading.acknowledgeRevision(load.id, load.revision),
                'Revision acknowledged on this device. Reconcile the load again.',
              )
            }
          >
            Acknowledge revised instructions
          </Button>
        </Notice>
      )}
      {load.released ? (
        <Notice title="Vehicle has departed" tone="success">
          The loading record is locked. Saved evidence remains available.
        </Notice>
      ) : (
        load.completed && (
          <Notice title="Loading complete · awaiting Dispatcher release" tone="success">
            Loading proof is saved on this device. Only Dispatcher can authorize departure.
          </Notice>
        )
      )}
      <div className="loader-workspace-grid">
        <div className="loader-column">
          {proofOnly ? (
            <Link to={`/loader/loading/${load.id}`}>
              <Button variant="outline">
                <ArrowLeft size={16} />
                Return to manifest
              </Button>
            </Link>
          ) : (
            <Panel
              title={`${loaded} / ${total} cases loaded`}
              description="Rear-to-front sequence · last delivery stop first"
            >
              <div className="panel-body">
                {!load.items.length && <EmptyState title="No manifest items" />}
                {load.items.map((item, index) => (
                  <div className="loader-case-row" key={item.outlet}>
                    <span className="loader-sequence">{index + 1}</span>
                    <div className="loader-case-details">
                      <strong>
                        {item.outlet} · {item.name}
                      </strong>
                      <p>
                        Delivery stop {item.stop} ·{' '}
                        {index === 0
                          ? 'Rear section'
                          : index === load.items.length - 1
                            ? 'Door access'
                            : 'Middle section'}
                      </p>
                    </div>
                    <Field label={`Cases loaded · expected ${item.expected}`}>
                      <Input
                        key={`${load.revision}-${item.loaded}`}
                        aria-label={`${item.outlet} cases loaded`}
                        type="number"
                        min={0}
                        max={item.expected}
                        defaultValue={item.loaded}
                        disabled={locked}
                        onBlur={(event) => {
                          const quantity = Number(event.target.value)
                          if (quantity !== item.loaded)
                            action.run(() =>
                              apis.loading.setLoaded(load.id, item.outlet, quantity, load.revision),
                            )
                        }}
                      />
                    </Field>
                    <Button
                      variant="outline"
                      disabled={locked || item.loaded === item.expected}
                      onClick={() =>
                        action.run(() =>
                          apis.loading.setLoaded(
                            load.id,
                            item.outlet,
                            item.expected,
                            load.revision,
                          ),
                        )
                      }
                    >
                      <PackageCheck size={16} />
                      Confirm {item.expected}
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <Panel title="Safety checks">
            <div className="panel-body">
              {checks.map(([key, originalLabel]) => {
                const label =
                  key === 'refrigeration' && !vehicle.reefer
                    ? 'Ambient cargo verified · refrigeration not required'
                    : originalLabel
                return (
                  <label className="loader-check-row" key={key}>
                    <Checkbox
                      aria-label={label}
                      checked={load.checks[key]}
                      disabled={locked}
                      onCheckedChange={(checked) =>
                        action.run(() =>
                          apis.loading.setCheck(load.id, key, checked === true, load.revision),
                        )
                      }
                    />
                    <span>{label}</span>
                  </label>
                )
              })}
              <Button
                variant="outline"
                disabled={locked || !load.issueResolved || !load.items.length}
                onClick={() => {
                  setIssue({
                    kind: 'Missing',
                    outlet: load.items[0]?.outlet ?? '',
                    affectedCases: 1,
                    description: '',
                  })
                  setIssueOpen(true)
                }}
              >
                Report an issue
              </Button>
            </div>
          </Panel>
          {locked && !action.isPending && (
            <p className="loader-disabled-reason">
              {load.released
                ? 'Loading is locked after departure.'
                : needsReview
                  ? 'Acknowledge the revised instructions to continue.'
                  : 'Loading unlocks after publication.'}
            </p>
          )}
        </div>
        <div className="loader-column">
          <Panel
            title="Vehicle capacity"
            description={`${vehicle.id} · ${vehicle.reefer ? 'Refrigerated' : 'Ambient'} ${vehicle.type.toLowerCase()}`}
          >
            <div className="panel-body">
              <CapacityBar label="Loading progress" used={loaded} total={total} unit="cases" />
              <CapacityBar label="Volume" used={volume} total={vehicle.volumeCapacity} unit="m³" />
              <CapacityBar label="Weight" used={weight} total={vehicle.weightCapacity} unit="kg" />
            </div>
          </Panel>
          <Panel title="Loading photograph">
            <div className="panel-body">
              <PhotoCapture
                key={`${load.id}-${load.revision}`}
                evidenceId={load.photoId}
                disabled={locked || !!loadErrors(load, false).length}
                busy={action.isPending}
                onSave={(file) =>
                  action.mutateAsync(() => apis.loading.attachPhoto(load.id, file, load.revision))
                }
              />
              {!load.completed && errors.length > 0 && (
                <p className="loader-disabled-reason">{errors[0]}</p>
              )}
              <Button
                className="loader-complete"
                disabled={locked || !!errors.length || load.completed}
                onClick={() =>
                  action.run(
                    () => apis.loading.complete(load.id, load.revision),
                    'Loading complete on this device. Await Dispatcher release.',
                  )
                }
              >
                <ClipboardCheck size={16} />
                {load.completed ? 'Loading complete' : 'Confirm loading complete'}
              </Button>
              {!proofOnly && (
                <Link className="loader-proof-link" to={`/loader/proof/${load.id}`}>
                  <Button variant="outline">
                    <Camera size={16} />
                    Review loading proof
                  </Button>
                </Link>
              )}
            </div>
          </Panel>
        </div>
      </div>
      <Modal
        title="Report missing or damaged goods"
        description="Dispatcher must resolve the shortfall before loading is completed."
        open={issueOpen}
        onOpenChange={setIssueOpen}
      >
        <Field label="Delivery stop">
          <select
            aria-label="Delivery stop"
            className="loader-select"
            value={issue.outlet}
            onChange={(event) => setIssue({ ...issue, outlet: event.target.value })}
          >
            {load.items.map((item) => (
              <option value={item.outlet} key={item.outlet}>
                {item.outlet} · {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Issue type">
          <select
            aria-label="Issue type"
            className="loader-select"
            value={issue.kind}
            onChange={(event) =>
              setIssue({ ...issue, kind: event.target.value as LoadIssueInput['kind'] })
            }
          >
            <option>Missing</option>
            <option>Damaged</option>
          </select>
        </Field>
        <Field label="Affected cases">
          <Input
            className="min-h-11"
            type="number"
            min={1}
            max={issueItem?.expected}
            value={issue.affectedCases}
            onChange={(event) => setIssue({ ...issue, affectedCases: Number(event.target.value) })}
          />
        </Field>
        <Field label="Item and issue description">
          <Textarea
            value={issue.description}
            onChange={(event) => setIssue({ ...issue, description: event.target.value })}
          />
        </Field>
        <Button
          className="min-h-11"
          disabled={!validIssue || locked || !load.issueResolved}
          onClick={() =>
            action.run(async () => {
              await apis.loading.reportIssue(load.id, issue, load.revision)
              setIssueOpen(false)
            }, 'Shortfall saved on this device. Load held.')
          }
        >
          Report and hold load
        </Button>
      </Modal>
    </div>
  )
}
