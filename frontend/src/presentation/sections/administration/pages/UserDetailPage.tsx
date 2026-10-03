import { useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import type { TeamMember, Workspace } from '../../../../domain/models'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { toast } from 'sonner'
import { useAction } from '../../../hooks/useOperations'
import { useApis } from '../../../providers/ApisContext'
import { Modal } from '../../../shared/molecules/Common'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { Avatar, Btn, Card, CardLabel, Credential, Field, Pill } from '../components/AdminKit'
import { generatePassword, passwordProblem } from '../lib/credentials'
import {
  initials,
  invitableRoles,
  roleLabels,
  statusTone,
  useActivity,
  useMembers,
  workspaceText,
} from '../lib/team'

type Dialog = 'role' | 'reset' | 'suspend' | null
type Way = 'reassign' | 'after' | 'now'

/** The trip number from an assignment such as "VEH055 · Trip 1". */
const tripOf = (member: TeamMember) => /Trip (\d+)/.exec(member.assignment ?? '')?.[1]

function ChangeRoleDialog({ member, close }: { member: TeamMember; close: () => void }) {
  const apis = useApis()
  const action = useAction()
  const [role, setRole] = useState<Workspace>(member.role)
  return (
    <div className="ad-dialog">
      <p>
        {member.name} signs in to the workspace for their role. Changing it takes effect the next
        time they sign in.
      </p>
      <div className="ad-options" role="radiogroup" aria-label="Role">
        {invitableRoles.map((option) => (
          <button
            key={option.role}
            type="button"
            role="radio"
            aria-checked={role === option.role}
            className="ad-option"
            onClick={() => setRole(option.role)}
          >
            <span>
              <strong>{roleLabels[option.role]}</strong>
              <small>{option.summary}</small>
            </span>
            <span className="ad-radio" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="ad-dialog-actions">
        <Btn
          disabled={role === member.role || action.isPending}
          onClick={() =>
            action.run(async () => {
              await apis.team.updateRole(member.id, role)
              // The dialog unmounts when it closes, so the message is shown from here.
              toast.success(`${member.name} is now a ${roleLabels[role].toLowerCase()}`)
              close()
            })
          }
        >
          Change role
        </Btn>
        <Btn variant="grey" onClick={close}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}

function ResetDialog({ member, close }: { member: TeamMember; close: () => void }) {
  const apis = useApis()
  const action = useAction()
  const [password, setPassword] = useState(generatePassword)
  const [done, setDone] = useState(false)
  if (done)
    return (
      <div className="ad-dialog">
        <p>
          {member.name}’s access was reset. Give them the new password yourself; this system does
          not send it, and it is shown only now.
        </p>
        {member.username && <Credential label="Username" value={member.username} />}
        <Credential label="Temporary password" value={password} />
        <div className="ad-dialog-actions">
          <Btn onClick={close}>Done</Btn>
        </div>
      </div>
    )
  return (
    <div className="ad-dialog">
      <p>
        This sets a new temporary password. Their current password stops working. You give the new
        one to {member.name} yourself; the reset is recorded in the audit log.
      </p>
      <Field label="New temporary password">
        <span className="ad-inline">
          <input
            value={password}
            spellCheck={false}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Btn variant="grey" onClick={() => setPassword(generatePassword())}>
            Generate
          </Btn>
        </span>
      </Field>
      <div className="ad-dialog-actions">
        <Btn
          disabled={action.isPending || Boolean(passwordProblem(password))}
          onClick={() =>
            action.run(async () => {
              await apis.team.resetAccess(member.id, password)
              setDone(true)
            })
          }
        >
          Reset access
        </Btn>
        <Btn variant="grey" onClick={close}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}

function SuspendDialog({
  member,
  members,
  close,
}: {
  member: TeamMember
  members: TeamMember[]
  close: () => void
}) {
  const apis = useApis()
  const action = useAction()
  const stops = useApiQuery(['stops-all'], (api) => api.delivery.listStops())
  const [way, setWay] = useState<Way>('reassign')
  const [replacement, setReplacement] = useState('')
  const [reason, setReason] = useState('')
  const [attempted, setAttempted] = useState(false)
  const cases = (stops.data ?? []).reduce((sum, stop) => sum + stop.cases, 0)
  const trip = tripOf(member)
  const available = members.filter(
    (other) =>
      other.role === 'driver' &&
      other.status === 'Active' &&
      !other.onRoute &&
      other.id !== member.id &&
      other.depot === member.depot,
  )
  const ends = (stops.data ?? []).at(-1)?.eta

  if (!member.onRoute)
    return (
      <div className="ad-dialog">
        <p>
          {member.name} will no longer be able to sign in. Anything they saved offline still
          uploads. The change is recorded in the audit log.
        </p>
        <div className="ad-dialog-actions">
          <Btn
            variant="danger"
            disabled={action.isPending || member.status === 'Suspended'}
            onClick={() =>
              action.run(async () => {
                await apis.team.suspend(member.id)
                toast.success(`${member.name} was suspended`)
                close()
              })
            }
          >
            Suspend user
          </Btn>
          <Btn variant="grey" onClick={close}>
            Cancel
          </Btn>
        </div>
      </div>
    )

  const errors = {
    replacement:
      way === 'reassign' && !replacement ? 'Choose a driver to take the trip.' : undefined,
    reason: way === 'now' && reason.trim().length < 4 ? 'Give a reason to suspend now.' : undefined,
  }
  const options: { way: Way; title: string; detail: string }[] = [
    {
      way: 'reassign',
      title: 'Reassign the trip first',
      detail: `Pick a ${member.depot} driver. The Dispatcher approves.`,
    },
    {
      way: 'after',
      title: 'Suspend after the trip ends',
      detail: `Scheduled for about ${ends ?? 'the end of the trip'}. Access stays until then.`,
    },
    {
      way: 'now',
      title: 'Suspend now',
      detail: 'Requires a reason. The Dispatcher is alerted and the route has no driver.',
    },
  ]
  const submit = () => {
    setAttempted(true)
    if (errors.replacement || errors.reason) return
    action.run(async () => {
      if (way === 'reassign') await apis.team.reassignTrip(member.id, replacement)
      else if (way === 'after') await apis.team.suspend(member.id, true)
      else await apis.team.suspend(member.id, false, reason)
      toast.success(
        way === 'reassign'
          ? 'Trip reassigned'
          : way === 'after'
            ? 'Suspension scheduled for after the trip'
            : `${member.name} was suspended`,
      )
      close()
    })
  }
  return (
    <div className="ad-dialog">
      <Pill tone="amber">Blocked · driver is on route</Pill>
      <h3 style={{ margin: 0, fontSize: 22, lineHeight: '30px' }}>
        {member.name.split(' ')[0]} is on Trip {trip ?? '1'} with {cases} cases on board.
      </h3>
      <p>
        Suspending now would cut off the route and any proof saved offline. Hand the trip over
        first.
      </p>
      <div className="ad-options" role="radiogroup" aria-label="How to suspend">
        {options.map((option) => (
          <button
            key={option.way}
            type="button"
            role="radio"
            aria-checked={way === option.way}
            className="ad-option"
            onClick={() => setWay(option.way)}
          >
            <span>
              <strong>{option.title}</strong>
              <small>{option.detail}</small>
            </span>
            <span className="ad-radio" aria-hidden="true" />
          </button>
        ))}
      </div>
      {way === 'reassign' && (
        <Field
          label="Available driver"
          error={attempted ? errors.replacement : undefined}
          hint={available.length ? undefined : `No ${member.depot} driver is free right now.`}
        >
          <select
            value={replacement}
            aria-invalid={Boolean(attempted && errors.replacement)}
            onChange={(event) => setReplacement(event.target.value)}
          >
            <option value="">Choose a driver</option>
            {available.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {way === 'now' && (
        <Field label="Reason" error={attempted ? errors.reason : undefined}>
          <textarea
            value={reason}
            aria-invalid={Boolean(attempted && errors.reason)}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      )}
      <p style={{ fontSize: 12 }}>Records saved offline still upload after suspension.</p>
      <div className="ad-dialog-actions">
        <Btn
          variant={way === 'now' ? 'danger' : 'primary'}
          disabled={action.isPending}
          onClick={submit}
        >
          {way === 'reassign'
            ? 'Reassign trip'
            : way === 'after'
              ? 'Schedule suspension'
              : 'Suspend now'}
        </Btn>
        <Btn variant="grey" onClick={close}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}

/** One person: who they are, where they work, their access and what they did lately. */
export default function UserDetailPage() {
  const { memberId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { members, loaded } = useMembers()
  const member = members.find((candidate) => candidate.id === memberId)
  const activity = useActivity(memberId).data ?? []
  const stops = useApiQuery(['stops-all'], (api) => api.delivery.listStops())
  const queue = useApiQuery(['queue'], (api) => api.delivery.listQueue())
  const [dialog, setDialog] = useState<Dialog>(() => {
    const requested = params.get('do')
    return requested === 'role' || requested === 'reset' || requested === 'suspend'
      ? requested
      : null
  })
  useBreadcrumb([
    { label: 'Team & access', to: '/administration/team' },
    { label: member?.name ?? 'User' },
  ])
  if (!loaded) return null
  if (!member) return <Navigate to="/administration/team" replace />
  const close = () => {
    setDialog(null)
    if (params.has('do')) setParams({}, { replace: true })
  }
  const trip = tripOf(member)
  const driver = member.role === 'driver'
  const stopList = stops.data ?? []
  const waiting = (queue.data ?? []).filter((record) => record.status !== 'accepted').length
  const assignmentRows: [string, string][] = [
    [
      driver ? 'Vehicle' : member.role === 'store-manager' ? 'Outlet' : 'Assignment',
      driver
        ? (member.vehicleId ?? '—')
        : member.role === 'store-manager'
          ? (member.outletId ?? member.assignment ?? '—')
          : (member.assignment ?? '—'),
    ],
    ['Depot', member.depot ?? '—'],
    ...(driver && trip
      ? ([
          [
            'Today',
            `Trip ${trip} · ${stopList.length} stops · ${stopList.reduce((n, stop) => n + stop.cases, 0)} cases`,
          ],
        ] as [string, string][])
      : []),
    ['Last seen', member.lastSeen ?? '—'],
  ]
  const accessRows: [string, string][] = [
    ['Role', roleLabels[member.role]],
    ['Workspace', workspaceText[member.role]],
    ['Username', member.username ?? '—'],
    [
      'Sign-in',
      member.status === 'Invited'
        ? 'Account created · not signed in yet'
        : member.status === 'Suspended'
          ? 'Suspended · cannot sign in'
          : `Invite accepted ${member.joined ?? '—'}`,
    ],
    ...(driver ? ([['Offline records', `${waiting} waiting to sync`]] as [string, string][]) : []),
  ]
  return (
    <div className="ad-page">
      <header className="ad-profile">
        <Avatar text={initials(member.name)} size={64} />
        <div className="ad-profile-text">
          <p className="ad-kicker">
            Administration · {roleLabels[member.role]} · {member.depot}
          </p>
          <h1>{member.name}</h1>
          <p className="ad-profile-sub">
            {member.mobile}
            {member.joined ? ` · Joined ${member.joined}` : ''}
          </p>
        </div>
      </header>
      <div className="ad-detail-bar">
        <div className="ad-detail-chips">
          <Pill>{roleLabels[member.role]}</Pill>
          <Pill tone={statusTone(member.status)}>
            {member.suspensionScheduled ? 'Suspends after trip' : member.status}
          </Pill>
          {member.onRoute && <Pill tone="orange">On route · Trip {trip ?? '1'}</Pill>}
        </div>
        <div className="ad-detail-actions">
          <Btn variant="grey" onClick={() => setDialog('role')}>
            Change role
          </Btn>
          <Btn variant="grey" onClick={() => setDialog('reset')}>
            Reset access
          </Btn>
          <Btn
            variant="grey"
            disabled={member.status === 'Suspended'}
            onClick={() => setDialog('suspend')}
          >
            Suspend user
          </Btn>
        </div>
      </div>
      <div className="ad-detail-grid">
        <div className="ad-stack">
          <Card label="Assignment">
            <CardLabel>Assignment</CardLabel>
            <dl className="ad-rows">
              {assignmentRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card label="Access">
            <CardLabel>Access</CardLabel>
            <dl className="ad-rows">
              {accessRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
        <Card label="Recent activity">
          <CardLabel>Recent activity</CardLabel>
          {activity.length === 0 ? (
            <p className="ad-lead">Nothing recorded yet.</p>
          ) : (
            <ul className="ad-activity">
              {activity.map((entry) => (
                <li key={`${entry.when}-${entry.title}`}>
                  <time>{entry.when}</time>
                  <div>
                    <strong>{entry.title}</strong>
                    <small>{entry.detail}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Modal
        title={
          dialog === 'role' ? 'Change role' : dialog === 'reset' ? 'Reset access' : 'Suspend user'
        }
        description={member.name}
        open={dialog !== null}
        onOpenChange={(open) => !open && close()}
      >
        {dialog === 'role' && <ChangeRoleDialog member={member} close={close} />}
        {dialog === 'reset' && <ResetDialog member={member} close={close} />}
        {dialog === 'suspend' && <SuspendDialog member={member} members={members} close={close} />}
      </Modal>
    </div>
  )
}
