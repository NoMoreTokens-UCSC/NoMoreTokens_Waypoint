import { useDriverData } from '../hooks/useDriverData'
import { DriverScreen } from '../templates/DriverScreen'
import { DriverSyncRecord } from '../organisms/DriverSyncRecord'
import { DriverLink } from '../molecules/DriverLink'
import { EmptyState } from '../../../shared/molecules/Common'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'

export default function DriverSyncHistoryPage() {
  const state = useDriverData()
  useBreadcrumb([{ label: 'Saved records', to: '/driver/sync' }, { label: 'Sync history' }])
  return (
    <DriverScreen
      title="Sync history"
      narrow
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
      description="Local delivery and attempt records, with their actual acknowledgement state."
    >
      {state.data?.queue.map((record) => (
        <DriverSyncRecord
          key={record.id}
          record={record}
          orders={state.data?.orders ?? []}
          evidence={state.data?.evidenceById[record.evidenceId]}
          stop={state.data?.stops.find((stop) => stop.id === record.stopId)}
        />
      ))}
      {!state.data?.queue.length && <EmptyState title="No upload history yet" />}
      <DriverLink to="/driver/sync" variant="secondary">
        Back to saved records
      </DriverLink>
    </DriverScreen>
  )
}
