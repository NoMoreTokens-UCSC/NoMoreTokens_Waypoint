import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { TeamMember } from '../../../../domain/models'
import { toast } from 'sonner'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useAction } from '../../../hooks/useOperations'
import { useApis } from '../../../providers/ApisContext'
import { Modal } from '../../../shared/molecules/Common'
import { AdminIntro, AdminPage, Avatar, Btn, Field, Pill } from '../components/AdminKit'
import {
  assignmentText,
  initials,
  roleLabels,
  sortMembers,
  statusTone,
  useMembers,
} from '../lib/team'

const depots = ['Peliyagoda', 'Kandy']

function ChangeAssignment({ member, close }: { member: TeamMember; close: () => void }) {
  const apis = useApis()
  const action = useAction()
  const { members } = useMembers()
  const vehicles = useApiQuery(['vehicles'], (api) => api.fleet.listVehicles())
  const [depot, setDepot] = useState(member.depot ?? 'Peliyagoda')
  const [assignment, setAssignment] = useState(member.vehicleId ?? member.assignment ?? '')
  const [attempted, setAttempted] = useState(false)
  const taken = new Set(
    members.filter((other) => other.id !== member.id).map((other) => other.vehicleId),
  )
  const free = (vehicles.data ?? []).filter((vehicle) => !taken.has(vehicle.id))
  const here = free.filter((vehicle) => vehicle.location === depot)
  const listed = here.length ? here : free
  const missing = attempted && assignment.trim().length < 2
  const driver = member.role === 'driver'
  return (
    <div className="ad-dialog">
      <div className="ad-form-grid">
        <Field label="Depot" hint="Peliyagoda or Kandy.">
          <select value={depot} onChange={(event) => setDepot(event.target.value)}>
            {depots.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </Field>
        <Field
          label={driver ? 'Vehicle' : member.role === 'store-manager' ? 'Outlet' : 'Assignment'}
          error={missing ? 'Choose an assignment.' : undefined}
          hint={driver ? `Only unassigned ${depot} vehicles are listed.` : undefined}
        >
          {driver ? (
            <select
              value={assignment}
              aria-invalid={missing}
              onChange={(event) => setAssignment(event.target.value)}
            >
              <option value="">Choose a vehicle</option>
              {listed.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.id} · {vehicle.reefer ? 'Refrigerated ' : ''}
                  {vehicle.type.toLowerCase()}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={assignment}
              aria-invalid={missing}
              onChange={(event) => setAssignment(event.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="ad-dialog-actions">
        <Btn
          disabled={action.isPending}
          onClick={() => {
            setAttempted(true)
            if (assignment.trim().length < 2) return
            action.run(async () => {
              await apis.team.changeAssignment(member.id, depot, assignment)
              toast.success('Assignment changed')
              close()
            })
          }}
        >
          Save assignment
        </Btn>
        <Btn variant="grey" onClick={close}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}

/** Assignments: who works where today, and a way to move someone to another vehicle, dock or outlet. */
export default function AssignmentsPage() {
  const navigate = useNavigate()
  const { members, loaded } = useMembers()
  const [editing, setEditing] = useState<TeamMember | null>(null)
  if (!loaded) return null
  const people = sortMembers(members).filter((member) => member.role !== 'administration')
  return (
    <AdminPage>
      <AdminIntro
        kicker="Administration · Assignments"
        title="Assignments"
        lead="Who works where: a vehicle for drivers, a dock for loaders, an outlet for store managers."
      />
      <div className="ad-table-card">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Assignment</th>
              <th>Depot</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((member) => (
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
                  <Pill tone={member.onRoute ? 'orange' : statusTone(member.status)}>
                    {member.onRoute ? 'On route' : member.status}
                  </Pill>
                </td>
                <td>
                  {member.onRoute ? (
                    <Btn
                      small
                      variant="grey"
                      onClick={() => navigate(`/administration/team/${member.id}?do=suspend`)}
                    >
                      Reassign trip
                    </Btn>
                  ) : (
                    <Btn
                      small
                      variant="grey"
                      aria-label={`Change assignment for ${member.name}`}
                      disabled={member.status === 'Suspended'}
                      onClick={() => setEditing(member)}
                    >
                      Change
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ad-table-foot">
          <span>{people.length} people with an assignment</span>
          <span>An on-route driver’s trip is handed over before they move</span>
        </div>
      </div>
      <ul className="ad-cards" aria-label="Assignments">
        {people.map((member) => (
          <li key={member.id}>
            <button
              type="button"
              className="ad-person"
              disabled={member.status === 'Suspended'}
              onClick={() =>
                member.onRoute
                  ? navigate(`/administration/team/${member.id}?do=suspend`)
                  : setEditing(member)
              }
            >
              <Avatar text={initials(member.name)} />
              <div>
                <strong>{member.name}</strong>
                <small>
                  {roleLabels[member.role]} · {assignmentText(member)}
                </small>
              </div>
              <Pill tone={member.onRoute ? 'orange' : statusTone(member.status)}>
                {member.onRoute ? 'On route' : member.status}
              </Pill>
            </button>
          </li>
        ))}
      </ul>
      <Modal
        title="Change assignment"
        description={editing?.name}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        {editing && <ChangeAssignment member={editing} close={() => setEditing(null)} />}
      </Modal>
    </AdminPage>
  )
}
