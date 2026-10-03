import { useNavigate } from 'react-router-dom'
import type { ChangeEvent } from 'react'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverScreen } from '../templates/DriverScreen'
import { DriverIssueForm } from '../organisms/DriverIssueForm'
import { DriverStoreContact } from '../organisms/DriverStoreContact'
import { DeliveryWindowNotice } from '../molecules/DeliveryWindowNotice'
import { DriverReportedIssue } from '../organisms/DriverReportedIssue'
import { Field, EmptyState } from '../../../shared/molecules/Common'

export default function DriverIssuePage() {
  const state = useDriverStop(),
    navigate = useNavigate()
  function selectStop(event: ChangeEvent<HTMLSelectElement>) {
    navigate(`/driver/issues?stop=${encodeURIComponent(event.target.value)}`)
  }
  return (
    <DriverScreen
      title="Delays & delivery issues"
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
      description="Report delays, vehicle breakdowns or unsuccessful attempts. Reports keep delivery open; dispatch decides rescheduling or cancellation."
    >
      {!state.stop ? (
        <EmptyState title="No assigned deliveries" />
      ) : (
        <>
          <Field label="Affected stop">
            <select className="native-select" value={state.stop.id} onChange={selectStop}>
              {state.data?.stops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.outlet} · {stop.name}
                </option>
              ))}
            </select>
          </Field>
          <DeliveryWindowNotice stop={state.stop} orders={state.data?.orders ?? []} />
          <DriverStoreContact stop={state.stop} />
          <div className="grid grid-cols-1 gap-4 min-[901px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <DriverIssueForm key={state.stop.id} state={state} />
            <DriverReportedIssue state={state} />
          </div>
        </>
      )}
    </DriverScreen>
  )
}
