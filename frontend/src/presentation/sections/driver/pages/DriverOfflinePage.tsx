import { DriverActions } from '../molecules/DriverActions'
import { useDriverData } from '../hooks/useDriverData'
import { DriverScreen } from '../templates/DriverScreen'
import { DriverLink } from '../molecules/DriverLink'
import { DriverSyncRecord } from '../organisms/DriverSyncRecord'
import { Notice, Panel, EmptyState } from '../../../shared/molecules/Common'

export default function DriverOfflinePage() {
  const state = useDriverData()
  const pending =
    state.data?.queue.filter((record) => !['accepted', 'superseded'].includes(record.status)) ?? []
  return (
    <DriverScreen
      title={state.online ? 'Back online · saved records' : 'Offline · saved on this phone'}
      narrow
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
    >
      <Notice
        title={state.online ? 'Connection available' : 'Your records are kept'}
        tone={state.online ? 'success' : 'warning'}
      >
        Photos, quantities and receiver details stay on this device. Pending records resume sync
        when connectivity returns. Failed uploads need an explicit retry.
      </Notice>
      {pending.map((record) => (
        <DriverSyncRecord
          key={record.id}
          record={record}
          orders={state.data?.orders ?? []}
          evidence={state.data?.evidenceById[record.evidenceId]}
          stop={state.data?.stops.find((stop) => stop.id === record.stopId)}
        />
      ))}
      {state.data?.drafts.map((draft) => (
        <Panel key={draft.stopId} title="Photo saved locally · not submitted">
          <div className="panel-body flex min-w-0 flex-col gap-4">
            <p>
              {draft.fileName} · {draft.quantity} cases
            </p>
            <DriverLink to={`/driver/delivery?stop=${encodeURIComponent(draft.stopId)}`}>
              Resume proof review
            </DriverLink>
          </div>
        </Panel>
      ))}
      {!pending.length && !state.data?.drafts.length && (
        <EmptyState
          title="No records waiting"
          description="Your saved manifest remains available without a connection."
        />
      )}
      <DriverActions>
        <DriverLink to="/driver/route">Keep working · current route</DriverLink>
        <DriverLink to="/driver/sync" variant="secondary">
          Open sync status
        </DriverLink>
      </DriverActions>
    </DriverScreen>
  )
}
