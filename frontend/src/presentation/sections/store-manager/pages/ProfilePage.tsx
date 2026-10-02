import { useApiQuery } from '../../../hooks/useApiQuery'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { useSession } from '../../../session/useSession'
import { PageIntro, StorePage } from '../components/StoreKit'
import { cutoffLabel } from '../lib/cutoff'
import { useStoreProfile } from '../lib/useStore'
import { formatTime12 } from '../lib/windows'

/** Profile: who is signed in, the outlet they run and the ordering rules that apply to it. */
export default function ProfilePage() {
  const session = useSession()
  const clock = useBusinessClock()
  const { profile } = useStoreProfile()
  const members = useApiQuery(['members'], (apis) => apis.team.listMembers())
  const member = members.data?.find((candidate) => candidate.id === session.memberId)
  const rows: [string, string][] = [
    ['Name', session.name],
    ['Role', 'Store manager'],
    ['Outlet', session.outletId ?? 'Not assigned'],
    ['Brand', `Waypoint ${profile?.brand ?? 'Fresh'}`],
    ['Outlet name', profile?.name ?? '—'],
    ['Depot', session.depot ?? 'Not assigned'],
    ['Phone', member?.mobile ?? 'Not recorded'],
    ['Email', member?.email ?? 'Not recorded'],
  ]
  return (
    <StorePage>
      <PageIntro title="Profile" context={`${session.outletId ?? 'No outlet'} · Store manager`} />
      <section className="sm-panel" aria-label="Your details">
        <h2 className="sm-h22">Your details</h2>
        <div className="sm-facts">
          {rows.map(([label, value]) => (
            <div className="sm-fact" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <p className="sm-muted sm-small">
          To change your name, phone or outlet, ask your administrator. They are managed in Team.
        </p>
      </section>
      <section className="sm-panel" aria-label="Ordering rules">
        <h2 className="sm-h22">Ordering rules for your outlet</h2>
        <div className="sm-facts">
          <div className="sm-fact">
            <span>Order cutoff</span>
            <strong>{cutoffLabel(clock.cutoff)} daily</strong>
          </div>
          <div className="sm-fact">
            <span>Delivery days</span>
            <strong>Monday to Saturday</strong>
          </div>
          <div className="sm-fact">
            <span>Receiving window</span>
            <strong>
              {profile
                ? `${formatTime12(profile.receiving.earliest)} to ${formatTime12(profile.receiving.latest)}`
                : '—'}
            </strong>
          </div>
        </div>
        <p className="sm-muted sm-small">
          {profile?.receiving.reason} {profile?.schedule}.
        </p>
      </section>
    </StorePage>
  )
}
