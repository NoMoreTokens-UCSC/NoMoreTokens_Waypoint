import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { Workspace } from '../../../../domain/models'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { AdminPage, Card, Credential, LinkBtn, Pill } from '../components/AdminKit'
import { roleLabels } from '../lib/team'

interface Created {
  role: Workspace
  name: string
  mobile: string
  email: string
  depot: string
  assignment: string
  username: string
  password: string
}

/**
 * Account created: the sign-in details to hand over. The password is shown only here, from memory;
 * reloading the page loses it, which is the point. The administrator passes it on outside this system.
 */
export default function InvitedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Keep the details in memory and wipe them from the browser history: otherwise a reload would
  // bring the password back, and it is meant to be shown once.
  const [state] = useState(() => location.state as Created | null)
  useEffect(() => {
    if (state) navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useBreadcrumb([
    { label: 'Team & access', to: '/administration/team' },
    { label: 'Account created' },
  ])
  // Reloading loses the password just shown; the Team list lists the person as Invited.
  if (!state?.name) return <Navigate to="/administration/team" replace />
  const first = state.name.trim().split(/\s+/)[0]
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const label =
    state.role === 'driver' ? 'Vehicle' : state.role === 'store-manager' ? 'Outlet' : 'Assignment'
  return (
    <AdminPage>
      <Card className="ad-sent" label="Account created">
        <span className="ad-sent-check" aria-hidden="true">
          <Check size={28} />
        </span>
        <Pill tone="green">Account created {time}</Pill>
        <h2>{first}’s account is ready.</h2>
        <p>
          Give {first} these sign-in details yourself. This system does not send them, and the
          password is shown only now.
        </p>
        <Credential label="Username" value={state.username} />
        <Credential label="Temporary password" value={state.password} />
        <p className="ad-warning">
          Copy the password before you leave this page. After that it cannot be shown again; reset
          access to set a new one.
        </p>
        <dl className="ad-facts">
          <div>
            <dt>Role</dt>
            <dd>{roleLabels[state.role]}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{state.email}</dd>
          </div>
          <div>
            <dt>Depot</dt>
            <dd>{state.depot}</dd>
          </div>
          <div>
            <dt>{label}</dt>
            <dd>{state.assignment}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Waiting for first sign-in</dd>
          </div>
        </dl>
        <div className="ad-actions">
          <LinkBtn to="/administration/team/new">Add another user</LinkBtn>
          <LinkBtn variant="grey" to="/administration/team">
            Back to Team & access
          </LinkBtn>
          <p className="ad-note">They appear as Active once they sign in.</p>
        </div>
      </Card>
    </AdminPage>
  )
}
