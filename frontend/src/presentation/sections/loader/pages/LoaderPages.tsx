import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Truck, ArrowRight, ClipboardCheck, PackageCheck, Camera } from 'lucide-react'
import { useOperations, useAction } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'
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
} from '../../../shared/molecules/Common'
import { PhotoCapture } from '../../../shared/organisms/PhotoCapture'
import { loadErrors } from '../../../../domain/rules'
import type { Load } from '../../../../domain/models'

export function LoaderQueuePage() {
  const { data } = useOperations()
  if (!data) return null
  return (
    <>
      <PageHeading
        eyebrow="Loading · Peliyagoda depot"
        title="Shift dashboard"
        description="Prepare the assigned load, record shortfalls, and hand off safely."
      />
      <div className="metrics">
        <Metric
          label="Assigned loads"
          value={data.loads.length}
          detail="Current demo shift"
          icon={<Truck size={17} />}
        />
        <Metric
          label="Ready for departure"
          value={data.loads.filter((l) => l.completed).length}
          detail="Safety checks and proof complete"
          icon={<ClipboardCheck size={17} />}
        />
        <Metric
          label="Cases to prepare"
          value={data.loads.reduce(
            (n, l) => n + l.items.reduce((m, i) => m + i.expected - i.loaded, 0),
            0,
          )}
          detail="Follow rear-to-front stop order"
          icon={<PackageCheck size={17} />}
        />
      </div>
      <Panel
        title="Your loading queue"
        description="Shared dock workspace · current manifest revisions"
      >
        {data.loads.map((load) => (
          <div className="list-row" key={load.id}>
            <div className="p-3 rounded-lg bg-muted">
              <Truck size={25} />
            </div>
            <div className="flex-1">
              <strong>
                {load.vehicleId} · Trip {load.trip}
              </strong>
              <p className="text-xs text-muted-foreground mt-1">
                Refrigerated van · Bay {load.bay} · Revision{' '}
                {load.revision.toString().padStart(2, '0')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {load.items.reduce((n, i) => n + i.loaded, 0)} /{' '}
                {load.items.reduce((n, i) => n + i.expected, 0)} cases loaded
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <StatusBadge>
                {load.released
                  ? 'En route'
                  : load.completed
                    ? 'Ready'
                    : load.issue && !load.issueResolved
                      ? 'Held'
                      : 'Loading'}
              </StatusBadge>
              <Link to="/loader/loading">
                <Button size="sm">
                  Open load
                  <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </Panel>
    </>
  )
}

export function LoaderWorkspacePage({ proofOnly = false }: { proofOnly?: boolean }) {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  const [issueOpen, setIssueOpen] = useState(false),
    [issue, setIssue] = useState('')
  if (!data) return null
  const load = data.loads[0],
    total = load.items.reduce((n, i) => n + i.expected, 0),
    loaded = load.items.reduce((n, i) => n + i.loaded, 0)
  const errors = loadErrors(load),
    checks = [
      ['refrigeration', 'Refrigeration working for chilled goods'],
      ['condition', 'Goods condition checked'],
      ['restraints', 'Restraints secured and stop order checked'],
    ] as [keyof Load['checks'], string][]
  return (
    <>
      <PageHeading
        eyebrow={`Active load · Bay ${load.bay}`}
        title={proofOnly ? 'Loading photograph & handoff' : 'Loading workspace'}
        description={`VEH055 · Trip 1 · Revision ${load.revision.toString().padStart(2, '0')} · Departure 05:00`}
        action={
          <StatusBadge>
            {load.released ? 'En route' : load.completed ? 'Ready' : 'Loading'}
          </StatusBadge>
        }
      />
      {load.issue && (
        <Notice
          title={
            load.issueResolved
              ? `Revision ${load.revision} · recheck the manifest`
              : 'Load held · shortfall reported'
          }
          tone={load.issueResolved ? 'neutral' : 'danger'}
        >
          {load.issue}
          {!load.issueResolved && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={action.isPending}
                onClick={() =>
                  action.run(
                    () => service.resolveLoadIssue(load.id),
                    'Demo replacement decision recorded. Recheck quantities and safety.',
                  )
                }
              >
                Demo dispatcher decision · replacement approved
              </Button>
            </div>
          )}
        </Notice>
      )}
      {load.released && (
        <Notice title="Vehicle has departed" tone="success">
          The loading record is locked. Evidence remains saved on this device.
        </Notice>
      )}
      <div className="split-grid">
        <div className="space-y-5">
          {!proofOnly && (
            <Panel
              title={`${loaded} / ${total} cases loaded`}
              description="Rear-to-front sequence · last delivery stop loaded first"
            >
              <div className="panel-body">
                {load.items.map((item, i) => (
                  <div
                    key={item.outlet}
                    className="flex flex-wrap items-center gap-4 py-5 border-b last:border-0"
                  >
                    <span className="avatar avatar-orange">0{i + 1}</span>
                    <div className="flex-1 min-w-32">
                      <strong>{item.outlet}</strong>
                      <p className="text-xs text-muted-foreground mt-1">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Stop {item.stop} · {i === 0 ? 'Rear section' : 'Door access'}
                      </p>
                    </div>
                    <label className="field w-24">
                      <span className="text-[11px]">Cases loaded</span>
                      <Input
                        aria-label={`${item.outlet} cases loaded`}
                        type="number"
                        min={0}
                        max={item.expected}
                        value={item.loaded}
                        disabled={load.released || action.isPending}
                        onChange={(e) => {
                          const quantity = Number(e.target.value)
                          action.run(() => service.setLoaded(load.id, item.outlet, quantity))
                        }}
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={load.released || action.isPending || item.loaded === item.expected}
                      onClick={() =>
                        action.run(() => service.setLoaded(load.id, item.outlet, item.expected))
                      }
                    >
                      Confirm {item.expected}
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <Panel
            title="Complete three safety checks"
            description="Photo capture unlocks after the quantities and checks are complete."
          >
            <div className="panel-body">
              {checks.map(([key, label]) => (
                <label className="check-row cursor-pointer" key={key}>
                  <Checkbox
                    checked={load.checks[key]}
                    disabled={load.released || action.isPending}
                    onCheckedChange={(v) =>
                      action.run(() => service.setCheck(load.id, key, v === true))
                    }
                    aria-label={label}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <Button
                variant="outline"
                className="mt-4"
                disabled={load.released || action.isPending}
                onClick={() => {
                  setIssue('')
                  setIssueOpen(true)
                }}
              >
                Report an issue
              </Button>
            </div>
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Vehicle capacity" description={`${load.vehicleId} · refrigerated van`}>
            <div className="panel-body">
              <CapacityBar label="Loading progress" used={loaded} total={total} unit="cases" />
              <CapacityBar
                label="Volume"
                used={data.orders
                  .filter((o) =>
                    data.settings.published
                      ? o.vehicleId === load.vehicleId && o.trip === load.trip
                      : data.stops.some((stop) => stop.orderIds.includes(o.id)),
                  )
                  .reduce((n, o) => n + o.volume, 0)}
                total={4}
                unit="m³"
              />
              <CapacityBar
                label="Weight"
                used={data.orders
                  .filter((o) =>
                    data.settings.published
                      ? o.vehicleId === load.vehicleId && o.trip === load.trip
                      : data.stops.some((stop) => stop.orderIds.includes(o.id)),
                  )
                  .reduce((n, o) => n + o.weight, 0)}
                total={800}
                unit="kg"
              />
            </div>
          </Panel>
          <Panel
            title="Photograph the loaded truck"
            description="A clear view of the reconciled load is required."
          >
            <div className="panel-body">
              <PhotoCapture
                evidenceId={load.photoId}
                disabled={!!loadErrors(load, false).length || load.released}
                busy={action.isPending}
                onSave={(file) =>
                  action.mutateAsync(() => service.attachLoadingPhoto(load.id, file))
                }
              />
              {!load.completed && errors.length > 0 && (
                <p className="text-xs text-muted-foreground mt-4">{errors[0]}</p>
              )}
              <Button
                className="w-full mt-5"
                disabled={!!errors.length || load.completed || load.released || action.isPending}
                onClick={() =>
                  action.run(
                    () => service.completeLoading(load.id),
                    'Loading complete. Dispatcher readiness has updated.',
                  )
                }
              >
                <Camera size={16} />
                {load.completed ? 'Loading complete' : 'Confirm loading complete'}
              </Button>
              {load.completed && (
                <Link to="/dispatcher/release">
                  <Button className="w-full mt-3" variant="outline">
                    Dispatcher handoff
                    <ArrowRight size={16} />
                  </Button>
                </Link>
              )}
            </div>
          </Panel>
        </div>
      </div>
      <Modal
        title="Report missing or damaged goods"
        description="Departure stays held until the revised manifest is checked."
        open={issueOpen}
        onOpenChange={setIssueOpen}
      >
        <Field label="Stop, item, affected quantity, and issue">
          <Textarea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="OUT001 · 1 milk case damaged"
          />
        </Field>
        <Button
          disabled={issue.trim().length < 4 || action.isPending}
          onClick={() =>
            action.run(async () => {
              await service.reportLoadIssue(load.id, issue)
              setIssueOpen(false)
            }, 'Shortfall recorded. Load held.')
          }
        >
          Report and hold load
        </Button>
      </Modal>
    </>
  )
}
