import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CloudUpload, Wifi, WifiOff, ArrowRight, CheckCircle2, Eye } from 'lucide-react'
import { useOperations, useAction, useConnectivity } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'
import { Button } from '../../../shared/atoms/button'
import {
  PageHeading,
  Panel,
  Metric,
  StatusBadge,
  Notice,
  Modal,
  EmptyState,
} from '../../../shared/molecules/Common'
import { EvidenceDetails } from '../../../shared/organisms/EvidenceDetails'
import { formatTime } from '../../../shared/lib/utils'
import { roleModules } from '../../../roles/registry'
import { useActiveRole } from '../../../session/useSession'

export default function RecoveryPage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction(),
    online = useConnectivity(),
    role = useActiveRole()
  const [evidenceId, setEvidenceId] = useState<string | null>(null),
    [reviewId, setReviewId] = useState<string | null>(null)
  if (!data) return null
  // This page is shared, so "back to work" goes to the active role's own workspace.
  const isDriver = role === 'driver',
    workspace = roleModules.find((module) => module.key === role),
    offline = !online || data.settings.simulatedOffline,
    pending = data.queue.filter((q) => !['accepted', 'superseded'].includes(q.status)),
    review = data.queue.find((q) => q.id === reviewId)
  return (
    <>
      <PageHeading
        eyebrow="Offline uploads"
        title="Saved records & sync"
        description="Resume interrupted uploads or review changed route instructions. This screen handles saved data; delivery incidents belong in Delays & issues."
        action={
          <Button
            disabled={
              offline ||
              action.isPending ||
              !data.queue.some((q) => ['pending', 'retry'].includes(q.status))
            }
            onClick={() =>
              action.run(
                () => service.sync(online),
                'Demo sync finished. Review the record outcomes below.',
              )
            }
          >
            <CloudUpload size={16} />
            {action.isPending ? 'Syncing…' : 'Sync demo records'}
          </Button>
        }
      />
      <div className="metrics">
        <Metric
          label="Waiting on this device"
          value={pending.length}
          detail="Evidence is retained until accepted"
        />
        <Metric
          label="Accepted"
          value={data.queue.filter((q) => q.status === 'accepted').length}
          detail="Demo acceptance recorded"
        />
        <Metric
          label="Connection"
          value={offline ? 'Offline' : 'Online'}
          detail={
            data.settings.simulatedOffline ? 'Demo offline mode is enabled' : 'Browser connectivity'
          }
          icon={offline ? <WifiOff size={18} /> : <Wifi size={18} />}
        />
      </div>
      <Notice
        title={offline ? 'Saved locally · upload paused' : 'Ready to sync with the demo adapter'}
        tone={offline ? 'warning' : 'neutral'}
      >
        {offline
          ? 'You can reload or change workspaces. Photographs and records stay in this browser.'
          : 'Demo sync does not contact a backend. Use Demo scenarios to test acceptance, interrupted uploads, and route review.'}
      </Notice>
      <Panel
        title="Evidence records"
        description={`Current route revision ${data.settings.routeRevision.toString().padStart(2, '0')}`}
      >
        {data.queue.length ? (
          [...data.queue].reverse().map((q) => {
            const stop = data.stops.find((s) => s.id === q.stopId)
            return (
              <div className="queue-record" key={q.id}>
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <strong>
                      {stop?.outlet} · {stop?.name}
                    </strong>
                    <p className="text-xs text-muted-foreground mt-2">
                      Saved {formatTime(q.createdAt)} · Revision {q.revision} · {q.attempts} attempt
                      {q.attempts === 1 ? '' : 's'}
                    </p>
                  </div>
                  <StatusBadge>{q.status}</StatusBadge>
                </div>
                {q.message && <p className="text-xs text-muted-foreground mt-3">{q.message}</p>}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setEvidenceId(q.evidenceId)}>
                    <Eye size={14} />
                    View saved proof
                  </Button>
                  {q.status === 'review' && (
                    <Button size="sm" onClick={() => setReviewId(q.id)}>
                      Review updated route
                    </Button>
                  )}
                  {q.status === 'retry' && (
                    <span className="text-xs text-muted-foreground self-center">
                      Retained · choose Sync demo records to retry
                    </span>
                  )}
                  {q.status === 'accepted' && (
                    <span className="text-xs text-success flex items-center gap-1">
                      <CheckCircle2 size={14} />
                      Accepted record preserved
                    </span>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <EmptyState
            title="All records synced"
            description={
              isDriver
                ? 'No evidence has been queued yet. Record a delivery after arriving at a stop.'
                : 'No evidence has been queued yet. Anything saved on this device while offline appears here.'
            }
            action={
              <Link to={isDriver ? '/driver/route' : (workspace?.home ?? '/workspaces')}>
                <Button variant="outline">
                  {isDriver ? 'Open current route' : `Open ${workspace?.label ?? 'workspace'}`}
                  <ArrowRight size={16} />
                </Button>
              </Link>
            }
          />
        )}
      </Panel>
      <Modal
        title="Saved evidence"
        description="The original photograph remains available on this device."
        open={!!evidenceId}
        onOpenChange={(v) => {
          if (!v) setEvidenceId(null)
        }}
      >
        {evidenceId && <EvidenceDetails evidenceId={evidenceId} />}
      </Modal>
      <Modal
        title="Review the revised route"
        description={`Original record revision ${review?.revision ?? ''} · current revision ${data.settings.routeRevision}`}
        open={!!review}
        onOpenChange={(v) => {
          if (!v) setReviewId(null)
        }}
      >
        <Notice title="Original proof is preserved">
          Acknowledging this revision allows a retry. It does not overwrite the photograph or mark
          the delivery accepted.
        </Notice>
        {data.stops.map((s) => (
          <div key={s.id} className="border-b py-3">
            <strong className="text-sm">
              {s.outlet} · {s.name}
            </strong>
            <p className="text-xs text-muted-foreground mt-1">
              Window {s.window} · ETA {s.eta}
            </p>
          </div>
        ))}
        <Button
          disabled={action.isPending}
          onClick={() =>
            action.run(async () => {
              await service.reviewQueuedRecord(reviewId!)
              setReviewId(null)
            }, 'Route acknowledged. Choose an acceptance outcome in Demo scenarios and retry.')
          }
        >
          Accept revised instructions
        </Button>
      </Modal>
    </>
  )
}
