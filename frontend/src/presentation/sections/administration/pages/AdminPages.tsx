import { useState } from 'react'
import { UserPlus, ShieldCheck, Users, Truck } from 'lucide-react'
import type { Workspace } from '../../../../domain/models'
import { useOperations, useAction } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'
import { Button } from '../../../shared/atoms/button'
import { Input } from '../../../shared/atoms/input'
import {
  PageHeading,
  Panel,
  Metric,
  SearchField,
  StatusBadge,
  Field,
  Modal,
  Notice,
  EmptyState,
} from '../../../shared/molecules/Common'
import { formatTime } from '../../../shared/lib/utils'
import { roleModules as workspaces } from '../../../roles/registry'

export function TeamPage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  const [search, setSearch] = useState(''),
    [inviteOpen, setInviteOpen] = useState(false),
    [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [role, setRole] = useState<Workspace>('driver')
  if (!data) return null
  const members = data.members.filter((m) =>
      `${m.name} ${m.email} ${m.role}`.toLowerCase().includes(search.toLowerCase()),
    ),
    member = data.members.find((m) => m.id === selected)
  return (
    <>
      <PageHeading
        title="Team & access"
        description="Waypoint Group · Peliyagoda depot"
        action={
          <Button
            onClick={() => {
              setName('')
              setEmail('')
              setRole('driver')
              setInviteOpen(true)
            }}
          >
            <UserPlus size={16} />
            Add user
          </Button>
        }
      />
      <div className="metrics">
        <Metric
          label="Team members"
          value={data.members.length}
          detail="All workspaces"
          icon={<Users size={17} />}
        />
        <Metric
          label="Active"
          value={data.members.filter((m) => m.status === 'Active').length}
          detail="Demo account status"
        />
        <Metric
          label="Invitations"
          value={data.members.filter((m) => m.status === 'Invited').length}
          detail="Created locally · no email sent"
        />
      </div>
      <div className="toolbar">
        <div className="toolbar-search">
          <SearchField value={search} onChange={setSearch} placeholder="Search users or roles" />
        </div>
        <span className="text-xs text-muted-foreground">
          Role switching is a demo feature, not permission enforcement.
        </span>
      </div>
      <Panel>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Assignment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="flex gap-3 items-center">
                      <span className="avatar">
                        {m.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')}
                      </span>
                      <div>
                        <button
                          className="table-link"
                          onClick={() => {
                            setSelected(m.id)
                            setRole(m.role)
                          }}
                        >
                          {m.name}
                        </button>
                        <small>{m.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{workspaces.find((w) => w.key === m.role)?.label}</td>
                  <td>
                    <StatusBadge>{m.status}</StatusBadge>
                  </td>
                  <td>
                    {m.onRoute
                      ? 'On route · Trip 1'
                      : m.suspensionScheduled
                        ? 'Suspension scheduled'
                        : '—'}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelected(m.id)
                        setRole(m.role)
                      }}
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!members.length && <EmptyState title="No matching team members" />}
        </div>
      </Panel>
      <Modal
        title="Add a team member"
        description="This creates a local demo invitation. No email is sent."
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      >
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Workspace role">
          <select
            className="native-select"
            value={role}
            onChange={(e) => setRole(e.target.value as Workspace)}
          >
            {workspaces.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>
        <Button
          disabled={action.isPending}
          onClick={() =>
            action.run(async () => {
              await service.invite(name, email, role)
              setInviteOpen(false)
            }, 'Demo invitation created')
          }
        >
          Create demo invitation
        </Button>
      </Modal>
      <Modal
        side
        title={member?.name ?? 'User details'}
        description={member?.email}
        open={!!member}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {member && (
          <>
            <div className="flex gap-2">
              <StatusBadge>{member.status}</StatusBadge>
              {member.onRoute && <StatusBadge tone="warning">On route · Trip 1</StatusBadge>}
            </div>
            <Field label="Workspace role">
              <select
                className="native-select"
                value={role}
                disabled={member.onRoute}
                onChange={(e) => setRole(e.target.value as Workspace)}
              >
                {workspaces.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              variant="outline"
              disabled={member.onRoute || action.isPending || role === member.role}
              onClick={() =>
                action.run(() => service.updateMember(member.id, role), 'Demo role updated')
              }
            >
              Save role
            </Button>
            {member.onRoute && (
              <Notice title="Driver is on route">
                Suspending now would interrupt the handoff. Keep access until the trip ends; saved
                evidence remains available.
              </Notice>
            )}
            {member.suspensionScheduled && (
              <Notice title="Suspension scheduled" tone="neutral">
                Demo access changes after all trip proof is accepted.
              </Notice>
            )}
            <Button
              variant="destructive"
              disabled={
                action.isPending || member.status === 'Suspended' || member.suspensionScheduled
              }
              onClick={() =>
                action.run(
                  () => service.suspend(member.id, member.onRoute),
                  member.onRoute ? 'Suspension scheduled after the trip' : 'Demo user suspended',
                )
              }
            >
              {member.onRoute ? 'Suspend after trip ends' : 'Suspend demo user'}
            </Button>
          </>
        )}
      </Modal>
    </>
  )
}
export function RolesPage() {
  return (
    <>
      <PageHeading
        title="Roles & access"
        description="The operational responsibilities represented in the Figma journeys."
      />
      <Notice title="Access reference for the frontend demo" tone="neutral">
        Production authentication and authorization must be enforced by the future backend.
      </Notice>
      <Panel>
        {workspaces.map((w) => (
          <div className="list-row" key={w.key}>
            <ShieldCheck size={22} className="text-primary" />
            <div className="flex-1">
              <h3>{w.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{w.description}</p>
            </div>
            <StatusBadge tone="neutral">
              {w.key === 'administration' ? 'Team management' : 'Operational role'}
            </StatusBadge>
          </div>
        ))}
      </Panel>
    </>
  )
}
export function AssignmentsPage() {
  const { data } = useOperations()
  if (!data) return null
  return (
    <>
      <PageHeading
        title="Assignments"
        description="Current demo loading and delivery responsibilities."
      />
      <Panel
        title="VEH055 · Trip 1"
        action={<StatusBadge>{data.settings.routeStarted ? 'En route' : 'Preparing'}</StatusBadge>}
      >
        <div className="panel-body">
          <div className="check-row">
            <Truck size={20} />
            <div>
              <strong>Sanjeewa Bandara · Driver</strong>
              <small>
                {data.stops.length} stops · {data.stops.reduce((n, s) => n + s.cases, 0)} cases ·
                Peliyagoda
              </small>
            </div>
          </div>
          <div className="check-row">
            <Users size={20} />
            <div>
              <strong>Kasun Fernando · Loader</strong>
              <small>Bay 03 · Manifest revision {data.loads[0].revision}</small>
            </div>
          </div>
          <div className="check-row">
            <ShieldCheck size={20} />
            <div>
              <strong>Nadeesha Perera · Dispatcher</strong>
              <small>Plan review and gated departure release</small>
            </div>
          </div>
        </div>
      </Panel>
    </>
  )
}
export function AuditPage() {
  const { data } = useOperations()
  if (!data) return null
  return (
    <>
      <PageHeading title="Audit log" description="Local demo activity across every workspace." />
      <Panel title="Recent activity">
        <div className="panel-body">
          {data.audit.map((entry) => (
            <div key={entry.id} className="timeline-row">
              <span className="timeline-dot" />
              <div className="flex-1">
                <strong className="text-sm">{entry.action}</strong>
                <p className="text-xs text-muted-foreground mt-1">{entry.detail}</p>
              </div>
              <time className="text-xs text-muted-foreground" dateTime={entry.at}>
                {formatTime(entry.at)}
              </time>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
