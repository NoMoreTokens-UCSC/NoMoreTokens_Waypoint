import { DriverActions } from '../molecules/DriverActions'
import {
  managerSignOffErrors,
  signedManifestMatches,
} from '../../../../domain/deliveryVerification'
import { useApis } from '../../../providers/ApisContext'
import { useDriverAction } from '../hooks/useDriverAction'
import { DriverButton } from '../atoms/DriverButton'
import type { Evidence, Order, QueuedAction, Stop } from '../../../../domain/models'
import { Panel, StatusBadge } from '../../../shared/molecules/Common'
import { DriverLink } from '../molecules/DriverLink'

const labels: Record<QueuedAction['status'], string> = {
  superseded: 'Historical record · replaced for manager sign-off',
  pending: 'Saved locally · pending sync',
  syncing: 'Uploading · awaiting acknowledgement',
  retry: 'Upload interrupted · retry required',
  review: 'Paused · route review required',
  accepted: 'Demo acknowledgement accepted',
}
export function DriverSyncRecord({
  record,
  stop,
  evidence,
  orders,
}: {
  record: QueuedAction
  stop?: Stop
  evidence?: Evidence
  orders: Order[]
}) {
  const apis = useApis(),
    action = useDriverAction()
  const needsSignOff =
    evidence?.kind === 'delivery' &&
    stop?.proofId === evidence.id &&
    record.status !== 'superseded' &&
    (!signedManifestMatches(stop, orders, evidence.managerSignOff) ||
      !!managerSignOffErrors(
        {
          stopId: evidence.entityId,
          quantity: evidence.quantity ?? 0,
          receiver: evidence.receiver ?? '',
          exception: evidence.receiverException ?? '',
          fileName: evidence.fileName,
          revision: evidence.revision,
        },
        evidence.signature,
        evidence.managerSignOff,
      ).length)
  function restore() {
    action.runAndNavigate(
      () => apis.delivery.reopenProofForSignOff(record.id),
      `/driver/proof/attached?stop=${encodeURIComponent(record.stopId)}`,
    )
  }
  return (
    <Panel>
      <div className="panel-body flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 [&>div]:min-w-0 [&>div]:flex-[1_1_200px]">
          <div>
            <h2>
              {stop?.outlet ?? record.stopId} ·{' '}
              {record.kind === 'attempt' ? 'Attempt evidence' : 'Delivery proof'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {stop?.name} · Revision {record.revision} · {record.attempts} upload{' '}
              {record.attempts === 1 ? 'attempt' : 'attempts'}
            </p>
          </div>
          <StatusBadge
            tone={
              record.status === 'accepted'
                ? 'success'
                : record.status === 'retry'
                  ? 'danger'
                  : 'warning'
            }
          >
            {labels[record.status]}
          </StatusBadge>
        </div>
        {record.message && (
          <p className="text-sm leading-relaxed text-muted-foreground">{record.message}</p>
        )}
        <DriverActions>
          {needsSignOff ? (
            <DriverButton
              variant="outline"
              disabled={action.isPending || record.status === 'syncing'}
              onClick={restore}
            >
              Add manager sign-off
            </DriverButton>
          ) : record.status === 'review' ? (
            <DriverLink
              to={`/driver/route/revision?stop=${encodeURIComponent(record.stopId)}`}
              variant="outline"
            >
              Review updated route
            </DriverLink>
          ) : record.kind === 'delivery' && record.status === 'accepted' ? (
            <DriverLink
              to={`/driver/delivered?stop=${encodeURIComponent(record.stopId)}&record=${encodeURIComponent(record.id)}`}
              variant="outline"
            >
              View delivery photo
            </DriverLink>
          ) : record.kind === 'attempt' && record.status === 'accepted' ? (
            <DriverLink
              to={`/driver/issues?stop=${encodeURIComponent(record.stopId)}&record=${encodeURIComponent(record.id)}`}
              variant="outline"
            >
              View saved attempt
            </DriverLink>
          ) : null}
        </DriverActions>
      </div>
    </Panel>
  )
}
