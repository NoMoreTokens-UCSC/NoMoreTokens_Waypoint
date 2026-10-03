import { ArrowRight, LogOut, UserCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { roleModules } from '../../../roles/registry'
import { BackLink, Wordmark, fieldRoles, rolePhotos, roleTitle } from '../components/EntryChrome'
import { getUser, logout } from '../../../../infrastructure/http/apiClient'
import { ROLE_HOME_MAP, ROLE_ALLOWED_WORKSPACES } from '../../../shared/guards/RoleRouteGuard'

export default function WorkspacesPage() {
  const navigate = useNavigate()
  const user = getUser()
  const roleUpper = (user?.role || '').toUpperCase()
  const allowedWorkspaces = user ? ROLE_ALLOWED_WORKSPACES[roleUpper] ?? [] : null
  const userHome = user ? (ROLE_HOME_MAP[roleUpper] ?? '/workspaces') : null
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
          {fieldRoles.map((role) => {
            const isAllowed = !user || allowedWorkspaces?.includes(role.key)
            const isUserCurrentRole = user && allowedWorkspaces?.includes(role.key)

            if (!isAllowed) {
              return (
                <div
                  key={role.key}
                  className="entry-role-card"
                  style={{ opacity: 0.55, cursor: 'not-allowed', filter: 'grayscale(0.3)' }}
                >
                  <div className="entry-role-text">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <h2>{roleTitle(role.label)}</h2>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: '#e2e8f0',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        Restricted
                      </span>
                    </div>
                    <p>{role.description}</p>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      Requires {role.label} access
                    </span>
                  </div>
                  <img src={rolePhotos[role.key]} alt="" />
                </div>
              )
            }

            return (
              <Link
                key={role.key}
                to={role.home}
                className="entry-role-card"
                style={isUserCurrentRole ? { outline: '2px solid #2563eb', outlineOffset: '2px' } : undefined}
              >
                <div className="entry-role-text">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <h2>{roleTitle(role.label)}</h2>
                    {isUserCurrentRole && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        Your Role
                      </span>
                    )}
                  </div>
                  <p>{role.description}</p>
                  <span className="entry-role-open">
                    Open workspace <ArrowRight size={12} />
                  </span>
                </div>
                <img src={rolePhotos[role.key]} alt="" />
              </Link>
            )
          })}
        </div>
        {others.length > 0 && (
          <p className="entry-workspaces-more">
            Also available:{' '}
            {others.map((role) => {
              const isAllowed = !user || allowedWorkspaces?.includes(role.key)
              if (!isAllowed) {
                return (
                  <span key={role.key} style={{ color: '#94a3b8' }}>
                    {role.label} (restricted)
                  </span>
                )
              }
              return (
                <Link key={role.key} to={role.home}>
                  {role.label}
                </Link>
              )
            })}
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
