import { useState } from 'react'
import { useDriverData } from '../hooks/useDriverData'
import { DriverScreen } from '../templates/DriverScreen'
import { DriverRouteTimeline } from '../organisms/DriverRouteTimeline'
import { Field } from '../../../shared/molecules/Common'
import { DriverLink } from '../molecules/DriverLink'

export default function DriverRouteHistoryPage() {
  const state = useDriverData()
  const [selectedDay, setSelectedDay] = useState('')
  const events = state.data?.history ?? []
  const days = [...new Set(events.map((event) => event.day))].sort().reverse()
  const day = days.includes(selectedDay) ? selectedDay : (days[0] ?? '')
  return (
    <DriverScreen
      title="Route history"
      description="Daily activity for your assigned truck. Times use Asia/Colombo and are saved on this device."
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
      narrow
    >
      {!!days.length && (
        <Field label="Route day">
          <select
            className="native-select"
            value={day}
            onChange={(event) => setSelectedDay(event.target.value)}
          >
            {days.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
      )}
      <DriverRouteTimeline events={events.filter((event) => event.day === day)} />
      <DriverLink to="/driver/sync/history" variant="outline">
        View saved proof and upload history
      </DriverLink>
    </DriverScreen>
  )
}
