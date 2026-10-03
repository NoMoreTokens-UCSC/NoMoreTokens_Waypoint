import { MoreHorizontal, Search } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { TeamMember, Workspace } from '../../../../domain/models'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { AdminIntro, AdminPage, Avatar, LinkBtn, Pill } from '../components/AdminKit'
import {
  assignmentText,
  initials,
  invitableRoles,
  lastActive,
  roleLabels,
  sortMembers,
  statusTone,
  useCompactLayout,
  useMembers,
  useSummary,
} from '../lib/team'

/** The short line under a name on a phone: where this person works. */
const shortAssignment = (member: TeamMember) =>
  member.role === 'driver'
    ? (member.vehicleId ?? member.depot)
    : member.role === 'store-manager'
      ? (member.outletId ?? member.depot)
      : member.depot

const depots = ['Peliyagoda', 'Kandy']

/** A filter chip that opens a short list: "All roles", "All depots". */
function FilterChip<T extends string>({
  label,
  dot,
  value,
  options,
  onChange,
}: {
  label: string
  dot: string
  value: T | 'all'
  options: { value: T; label: string }[]
  onChange: (value: T | 'all') => void
}) {
  const current = options.find((option) => option.value === value)?.label ?? label
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="ad-chip" aria-label={`Filter by ${label.split(' ')[1]}`}>
        <i className={`ad-dot ad-dot-${dot}`} aria-hidden="true" />
        {current}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="ad-menu" align="start" sideOffset={6}>
          {[{ value: 'all' as const, label }, ...options].map((option) => (
            <DropdownMenu.Item
              key={option.value}
              data-checked={option.value === value}
              onSelect={() => onChange(option.value)}
            >
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Team & access: everyone with a workspace, who they are, where they work and whether they can sign in. */
export default function TeamPage() {
  const navigate = useNavigate()
  const compact = useCompactLayout()
  const { members, loaded } = useMembers()
  const summary = useSummary().data
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<Workspace | 'all'>('all')
  const [depot, setDepot] = useState<string>('all')
  useBreadcrumb([{ label: 'Team & access' }])
  if (!loaded || !summary) return null
  const text = search.trim().toLowerCase()
  const shown = sortMembers(members).filter(
    (member) =>
      (!text ||
        `${member.name} ${member.mobile ?? ''} ${member.assignment ?? ''}`
          .toLowerCase()
          .includes(text)) &&
      (role === 'all' || member.role === role) &&
      (depot === 'all' || member.depot === depot),
  )
  const stats = [
    { label: 'Total users', value: summary.total, tone: '' },
    { label: 'Active', value: summary.active, tone: 'green' },
    { label: 'Suspended', value: summary.suspended, tone: 'red' },
    { label: 'Invited', value: summary.invited, tone: 'orange' },
  ]
  return (
    <AdminPage>
      <AdminIntro
        kicker="Administration · Waypoint Group"
        title="Team & access"
        lead="Add people, assign roles and keep every delivery accountable."
        aside={
          <>
            <i className="ad-live" aria-hidden="true" />
            Updated just now
          </>
        }
      />
      <section className="ad-stats" aria-label="Team totals">
        {stats.map((stat) => (
          <div key={stat.label} className={`ad-stat${stat.tone ? ` ad-stat-${stat.tone}` : ''}`}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
            <i aria-hidden="true" />
          </div>
        ))}
      </section>
      <div className="ad-toolbar">
        <label className="ad-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Search name, mobile or outlet"
            placeholder="Search name, mobile or outlet"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <FilterChip
          label="All roles"
          dot="orange"
          value={role}
          options={invitableRoles.map(({ role: value }) => ({
            value,
            label: roleLabels[value],
          }))}
          onChange={setRole}
        />
        <FilterChip
          label="All depots"
          dot="green"
          value={depot}
          options={depots.map((name) => ({ value: name, label: name }))}
          onChange={setDepot}
        />
        <div className="ad-toolbar-end">
          <LinkBtn to="/administration/team/new">Add user</LinkBtn>
        </div>
      </div>
      {compact && (
        <p className="ad-counts">
          {summary.active} active · {summary.invited} invited · {summary.suspended} suspended
        </p>
      )}

      <div className="ad-table-card">
        <table className="ad-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Assignment</th>
              <th>Depot</th>
              <th>Status</th>
              <th>Last active</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="ad-user">
                    <Avatar text={initials(member.name)} />
                    <div>
                      <Link to={`/administration/team/${member.id}`}>{member.name}</Link>
                      <small>{member.mobile}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <Pill>{roleLabels[member.role]}</Pill>
                </td>
                <td className="ad-strong">{assignmentText(member)}</td>
                <td>{member.depot}</td>
                <td>
                  <Pill tone={statusTone(member.status)}>
                    {member.suspensionScheduled ? 'Suspends after trip' : member.status}
                  </Pill>
                </td>
                <td>{lastActive(member)}</td>
                <td>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                      className="ad-more"
                      aria-label={`Actions for ${member.name}`}
                    >
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content className="ad-menu" align="end" sideOffset={4}>
                        {[
                          ['View details', ''],
                          ['Change role', '?do=role'],
                          ['Reset access', '?do=reset'],
                          ['Suspend user', '?do=suspend'],
                        ].map(([label, query]) => (
                          <DropdownMenu.Item
                            key={label}
                            onSelect={() => navigate(`/administration/team/${member.id}${query}`)}
                          >
                            {label}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="ad-empty">No one matches these filters.</p>}
        <div className="ad-table-foot">
          <span>
            Showing {shown.length} of {summary.total} users
          </span>
          <span>Sorted by role · then status</span>
        </div>
      </div>
      <ul className="ad-cards" aria-label="Team members">
        {shown.map((member) => (
          <li key={member.id}>
            <Link to={`/administration/team/${member.id}`} className="ad-person">
              <Avatar text={initials(member.name)} />
              <div>
                <strong>{member.name}</strong>
                <small>
                  {roleLabels[member.role]} · {shortAssignment(member)}
                </small>
              </div>
              <Pill tone={statusTone(member.status)}>{member.status}</Pill>
            </Link>
          </li>
        ))}
      </ul>
      <p className="ad-legend">
        Active can sign in · Invited has not opened the link yet · Suspended cannot sign in.
      </p>
      <div className="ad-bottom-bar">
        <LinkBtn to="/administration/team/new">Add user</LinkBtn>
      </div>
    </AdminPage>
  )
}
