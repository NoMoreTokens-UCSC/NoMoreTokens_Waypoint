import { DriverActions } from '../molecules/DriverActions'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverScreen } from '../templates/DriverScreen'
import { DriverSyncRecord } from '../organisms/DriverSyncRecord'
import { DriverLink } from '../molecules/DriverLink'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { useApis } from '../../../providers/ApisContext'
import { useAction } from '../../../hooks/useOperations'
import { DriverButton as Button } from '../atoms/DriverButton'
import { Notice, EmptyState, Panel } from '../../../shared/molecules/Common'
import type { ConnectivityStatus } from '../../../../domain/driverProof'

export default function DriverSyncPage() {
  const state = useDriverStop(),
    apis = useApis(),
    action = useAction()
  const queue = state.data?.queue ?? []
  const activeCount = queue.filter((record) => record.status !== 'superseded').length
  const connectivity: ConnectivityStatus = !state.online
    ? 'offline'
    : queue.some((record) => record.status === 'syncing')
      ? 'syncing'
      : 'online'
  const failed = queue.some((record) => record.status === 'retry')
  const review = queue.some((record) => record.status === 'review')
  const pending = queue.some((record) => !['accepted', 'superseded'].includes(record.status))
  const retryable = queue.some((record) => record.status === 'pending' || record.status === 'retry')
  function retryUpload() {
    action.run(() => apis.delivery.sync(state.online), 'Demo sync attempt complete')
  }
  const title =
    connectivity === 'offline'
      ? pending
        ? 'Proof saved locally · pending sync'
        : 'Offline · saved delivery records'
      : connectivity === 'syncing'
        ? 'Back online · syncing'
        : review
          ? 'Route changed while offline'
          : failed
            ? 'Upload interrupted'
            : pending
              ? 'Awaiting acknowledgement'
              : activeCount
                ? 'All records synced'
                : 'Saved delivery records'
  return (
    <DriverScreen
      title={title}
      narrow
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
    >
      <Notice
        title={
          connectivity === 'offline'
            ? 'Saved on this device'
            : connectivity === 'syncing'
              ? 'Uploading · pending acknowledgement'
              : review
                ? 'Your saved proof is retained'
                : failed
                  ? 'The photo did not upload. It is safe.'
                  : pending
                    ? 'Delivery remains incomplete'
                    : activeCount
                      ? 'All delivery events synced'
                      : 'No submitted proof yet'
        }
        tone={failed ? 'danger' : !pending && activeCount ? 'success' : 'warning'}
      >
        {pending
          ? 'A local save is awaiting upload. Delivered appears once the server confirms receipt.'
          : 'Manager quantities, remarks, and signature remain attached to the saved proof. All delivery events are synchronized with the server.'}
      </Notice>
      {state.syncError && (
        <Notice title="Sync could not start" tone="danger">
          {state.syncError}
        </Notice>
      )}
      {state.evidence && (
        <DriverPhotoPreview photo={state.evidence.photo} fileName={state.evidence.fileName} />
      )}
      {queue.map((record) => (
        <DriverSyncRecord
          key={record.id}
          record={record}
          orders={state.data?.orders ?? []}
          evidence={state.data?.evidenceById[record.evidenceId]}
          stop={state.data?.stops.find((stop) => stop.id === record.stopId)}
        />
      ))}
      {state.data?.drafts.map((draft) => (
        <Panel title="Photo draft · not submitted" key={draft.stopId}>
          <div className="panel-body flex min-w-0 flex-col gap-4">
            <p>{draft.fileName}</p>
            <DriverLink to={`/driver/delivery?stop=${encodeURIComponent(draft.stopId)}`}>
              Resume photo review
            </DriverLink>
          </div>
        </Panel>
      ))}
      {!queue.length && !state.data?.drafts.length && (
        <EmptyState
          title="No saved records"
          description="Capture and submit a proof after confirming you are safely parked."
        />
      )}
      <DriverActions>
        {retryable && (
          <Button
            onClick={retryUpload}
            disabled={!state.online || connectivity === 'syncing' || action.isPending}
          >
            {failed ? 'Retry upload' : 'Sync pending proof'}
          </Button>
        )}
        {state.proof === 'accepted' && (
          <DriverLink to={state.href('/driver/delivered')}>View delivered stop</DriverLink>
        )}
        <DriverLink to="/driver/route" variant="secondary">
          Keep working
        </DriverLink>
        <DriverLink to="/driver/sync/history" variant="outline">
          View sync history
        </DriverLink>
      </DriverActions>
      {!state.online && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Reconnect to upload. Your proof remains pending.
        </p>
      )}
      {review && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Open the updated-route review on the saved record before retrying.
        </p>
      )}
    </DriverScreen>
  )
}
