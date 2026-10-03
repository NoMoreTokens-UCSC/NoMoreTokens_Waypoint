import { Check } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { AdminPage, Card, LinkBtn, Pill } from '../components/AdminKit'
import { roleLabels } from '../lib/team'
import type { Workspace } from '../../../../domain/models'

interface Sent {
  role: Workspace
  name: string
  mobile: string
  depot: string
  assignment: string
}

/** Invite sent: who was invited, how, and what happens next. */
export default function InvitedPage() {
  const { state } = useLocation() as { state: Sent | null }
  useBreadcrumb([{ label: 'Team & access', to: '/administration/team' }, { label: 'Invite sent' }])
  // Reloading loses the invitation just made; the Team list shows it as Invited.
  if (!state?.name) return <Navigate to="/administration/team" replace />
  const first = state.name.trim().split(/\s+/)[0]
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const label =
    state.role === 'driver' ? 'Vehicle' : state.role === 'store-manager' ? 'Outlet' : 'Assignment'
  return (
    <AdminPage>
      <Card className="ad-sent" label="Invite sent">
        <span className="ad-sent-check" aria-hidden="true">
          <Check size={28} />
        </span>
        <Pill tone="green">Invite sent {time}</Pill>
        <h2>{first} has been invited.</h2>
        <p>An SMS with a sign-in link went to {state.mobile}. The link expires in 48 hours.</p>
        <dl className="ad-facts">
          <div>
            <dt>Role</dt>
            <dd>{roleLabels[state.role]}</dd>
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
            <dd>Invited</dd>
          </div>
        </dl>
        <div className="ad-actions">
          <LinkBtn to="/administration/team/new">Add another user</LinkBtn>
          <LinkBtn variant="grey" to="/administration/team">
            Back to Team & access
          </LinkBtn>
          <p className="ad-note">They appear as Active once they sign in.</p>
          <p className="ad-note">Demo workspace: no SMS is actually sent.</p>
        </div>
      </Card>
    </AdminPage>
  )
}
