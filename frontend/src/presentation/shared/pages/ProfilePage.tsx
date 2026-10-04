import '../../sections/store-manager/store.css'
import './profile.css'
import { roleModules } from '../../roles/registry'
import { useSession } from '../../session/useSession'

/**
 * The signed-in account's details, the same page for every role. An administrator sets these, so the page
 * only shows them. It borrows the store manager's page styling.
 */
export default function ProfilePage() {
  const session = useSession()
  const role = roleModules.find((module) => module.key === session.role)?.label ?? 'User'
  const facts: [string, string][] = [
    ['Full name', session.name],
    ...(session.username ? ([['Username', session.username]] as [string, string][]) : []),
    ['Role', role],
    ...(session.outletId ? ([['Outlet', session.outletId]] as [string, string][]) : []),
    ...(session.vehicleId ? ([['Vehicle', session.vehicleId]] as [string, string][]) : []),
    ['Depot', session.role === 'dispatcher' ? 'All depots' : (session.depot ?? 'All depots')],
  ]
  return (
    <div className="sm-page profile-page">
      <header className="sm-intro">
        <h1>Profile</h1>
        <p>{[session.outletId ?? session.vehicleId, role].filter(Boolean).join(' · ')}</p>
      </header>
      <section className="sm-panel" aria-label="Your details">
        <h2 className="sm-h22">Your details</h2>
        <div className="sm-facts">
          {facts.map(([label, value]) => (
            <div className="sm-fact" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <p className="sm-muted sm-small">
          Your administrator sets these details. Ask them if something needs to change.
        </p>
      </section>
    </div>
  )
}
