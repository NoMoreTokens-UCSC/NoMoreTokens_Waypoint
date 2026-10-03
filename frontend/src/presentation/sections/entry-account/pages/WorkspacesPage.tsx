import { ArrowRight, LogOut, UserCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { roleModules } from '../../../roles/registry'
import { BackLink, Wordmark, fieldRoles, rolePhotos, roleTitle } from '../components/EntryChrome'
import { getUser, logout } from '../../../../infrastructure/http/apiClient'

const ROLE_HOME_MAP: Record<string, string> = {
  DISPATCHER: '/dispatcher/orders',
  LOADER: '/loader/queue',
  DRIVER: '/driver/home',
  STORE_MANAGER: '/store-manager/overview',
  ADMIN: '/administration/team',
}

export default function WorkspacesPage() {
  const navigate = useNavigate()
  const user = getUser()
  const userHome = user ? (ROLE_HOME_MAP[user.role] ?? '/workspaces') : null
  const others = roleModules.filter((role) => !fieldRoles.includes(role))
  return (
    <div className="entry-page entry-workspaces">
      <header className="entry-bar">
        <Wordmark />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {user && (
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          )}
          <Link to="/welcome" className="entry-bar-link">
            Welcome
          </Link>
        </div>
      </header>
      <main className="entry-workspaces-body">
        <BackLink trail={['Workspaces']} />
        {user && (
          <div
            style={{
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#1e3a8a' }}>
                <UserCheck size={18} /> Signed in as {user.full_name} ({user.role})
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#3b82f6' }}>
                {user.depot_id ? `Depot: ${user.depot_id}` : user.outlet_id ? `Outlet: ${user.outlet_id}` : user.vehicle_id ? `Vehicle: ${user.vehicle_id}` : ''}
              </p>
            </div>
            {userHome && (
              <Link
                to={userHome}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                Go to your workspace <ArrowRight size={14} />
              </Link>
            )}
          </div>
        )}
        <h1>Your workspace.</h1>
        <p className="entry-workspaces-lead">Choose a role to explore the prototype.</p>
        <div className="entry-role-grid">
          {fieldRoles.map((role) => (
            <Link key={role.key} to={role.home} className="entry-role-card">
              <div className="entry-role-text">
                <h2>{roleTitle(role.label)}</h2>
                <p>{role.description}</p>
                <span className="entry-role-open">
                  Open workspace <ArrowRight size={12} />
                </span>
              </div>
              <img src={rolePhotos[role.key]} alt="" />
            </Link>
          ))}
        </div>
        {others.length > 0 && (
          <p className="entry-workspaces-more">
            Also available:{' '}
            {others.map((role) => (
              <Link key={role.key} to={role.home}>
                {role.label}
              </Link>
            ))}
            {' · '}
            <Link to="/recovery">Saved records</Link>
          </p>
        )}
        <p className="entry-workspaces-note">
          Prototype role switcher. Production access follows the signed-in account’s permissions.
        </p>
      </main>
    </div>
  )
}
