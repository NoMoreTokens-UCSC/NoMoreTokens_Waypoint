import { useDriverData } from '../hooks/useDriverData'
import { DriverScreen } from '../templates/DriverScreen'
import { DriverHomeOverview } from '../organisms/DriverHomeOverview'
import { useBusinessClock } from '../../../session/useBusinessClock'

export default function DriverHomePage() {
  const state = useDriverData()
  const clock = useBusinessClock()
  return (
    <DriverScreen
      title={`Good morning, ${state.session.name.split(' ')[0]}`}
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
      description={`${clock.deliveryDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Colombo' })} · ${state.session.depot ?? 'Assigned depot'} · Demo delivery day`}
    >
      <DriverHomeOverview state={state} />
    </DriverScreen>
  )
}
