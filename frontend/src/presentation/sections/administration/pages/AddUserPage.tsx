import { Check, Minus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { Workspace } from '../../../../domain/models'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useAction } from '../../../hooks/useOperations'
import { useApis } from '../../../providers/ApisContext'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { AdminIntro, AdminPage, Btn, Card, CardLabel, Field, Pill } from '../components/AdminKit'
import { invitableRoles, roleLabels, roleSummary, useCompactLayout, useMembers } from '../lib/team'

const depots = ['Peliyagoda', 'Kandy']
const docks = ['Dock bay 01', 'Dock bay 02', 'Dock bay 03', 'Dock bay 04']

/** What the assignment field is called and asks for, by role. */
const assignmentLabel: Record<Workspace, string> = {
  driver: 'Vehicle',
  loader: 'Dock bay',
  'store-manager': 'Outlet',
  dispatcher: 'Workplace',
  administration: 'Workplace',
}

const normalMobile = (text: string) => text.replace(/[^\d+]/g, '')
export const validMobile = (text: string) => /^\+947\d{8}$/.test(normalMobile(text))

interface Draft {
  role: Workspace
  name: string
  mobile: string
  depot: string
  assignment: string
}
type Errors = Partial<Record<'name' | 'mobile' | 'assignment', string>>

function check(draft: Draft): Errors {
  const errors: Errors = {}
  if (draft.name.trim().length < 2) errors.name = 'Enter their full name.'
  if (!validMobile(draft.mobile))
    errors.mobile = 'Enter a Sri Lankan mobile such as +94 77 123 4567.'
  if (draft.role === 'driver' && !/^VEH\d+$/.test(draft.assignment))
    errors.assignment = 'Choose a vehicle.'
  if (draft.role === 'store-manager' && !/^OUT\d+/.test(draft.assignment.trim()))
    errors.assignment = 'Enter the outlet, for example OUT001.'
  if (draft.role === 'loader' && !draft.assignment) errors.assignment = 'Choose a dock bay.'
  return errors
}

/** Add user: choose the role first, then the details the role needs. Phones do it in two steps. */
export default function AddUserPage() {
  const navigate = useNavigate()
  const apis = useApis()
  const action = useAction()
  const compact = useCompactLayout()
  const { members } = useMembers()
  const vehicles = useApiQuery(['vehicles'], (api) => api.fleet.listVehicles())
  const [draft, setDraft] = useState<Draft>({
    role: 'driver',
    name: '',
    mobile: '',
    depot: 'Peliyagoda',
    assignment: '',
  })
  const [step, setStep] = useState(1)
  const [attempted, setAttempted] = useState(false)
  useBreadcrumb([{ label: 'Team & access', to: '/administration/team' }, { label: 'Add user' }])

  const errors = attempted ? check(draft) : {}
  const taken = new Set(members.map((member) => member.vehicleId).filter(Boolean))
  const free = (vehicles.data ?? []).filter((vehicle) => !taken.has(vehicle.id))
  const here = free.filter((vehicle) => vehicle.location === draft.depot)
  const listed = here.length ? here : free
  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))
  const pickRole = (role: Workspace) =>
    change({
      role,
      assignment: role === 'dispatcher' ? 'Planning office' : '',
    })
  const summary = roleSummary[draft.role]

  const send = () => {
    setAttempted(true)
    if (Object.keys(check(draft)).length) {
      if (compact && (check(draft).name || !draft.name.trim())) setStep(1)
      toast.error('Check the highlighted details.')
      return
    }
    action.run(async () => {
      await apis.team.inviteByMobile({
        name: draft.name.trim(),
        mobile: draft.mobile.trim(),
        role: draft.role,
        depot: draft.depot,
        assignment: draft.assignment.trim(),
      })
      navigate('/administration/team/invited', { state: draft })
    })
  }
  const next = () => {
    setAttempted(true)
    if (draft.name.trim().length < 2) return
    setAttempted(false)
    setStep(2)
  }

  const roleCards = (
    <div className="ad-role-grid" role="radiogroup" aria-label="Role">
      {invitableRoles.map(({ role, summary: line }) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={draft.role === role}
          aria-pressed={draft.role === role}
          className="ad-role-card"
          onClick={() => pickRole(role)}
        >
          <strong>{roleLabels[role]}</strong>
          <span>{line}</span>
        </button>
      ))}
    </div>
  )
  const roleRows = (
    <div className="ad-options" role="radiogroup" aria-label="Role">
      {invitableRoles.map(({ role }) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={draft.role === role}
          className="ad-option"
          onClick={() => pickRole(role)}
        >
          <strong>{roleLabels[role]}</strong>
          <span className="ad-radio" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
  const nameField = (
    <Field label="Full name" hint="As it should appear on run sheets." error={errors.name}>
      <input
        value={draft.name}
        placeholder="Chamari Wijesinghe"
        autoComplete="off"
        aria-invalid={Boolean(errors.name)}
        onChange={(event) => change({ name: event.target.value })}
      />
    </Field>
  )
  const mobileField = (
    <Field label="Mobile number" hint="The invite is sent by SMS." error={errors.mobile}>
      <input
        type="tel"
        value={draft.mobile}
        placeholder="+94 77 123 4567"
        aria-invalid={Boolean(errors.mobile)}
        onChange={(event) => change({ mobile: event.target.value })}
      />
    </Field>
  )
  const depotField = (
    <Field label="Depot" hint="Peliyagoda or Kandy.">
      <select
        value={draft.depot}
        onChange={(event) =>
          change({
            depot: event.target.value,
            assignment: draft.role === 'driver' ? '' : draft.assignment,
          })
        }
      >
        {depots.map((depot) => (
          <option key={depot}>{depot}</option>
        ))}
      </select>
    </Field>
  )
  const assignmentField = (
    <Field
      label={assignmentLabel[draft.role]}
      error={errors.assignment}
      hint={
        draft.role === 'driver'
          ? `Only unassigned ${draft.depot} vehicles are listed.`
          : draft.role === 'store-manager'
            ? 'The outlet this person manages.'
            : draft.role === 'loader'
              ? 'Shared dock tablet.'
              : 'Plans from the central office.'
      }
    >
      {draft.role === 'driver' ? (
        <select
          value={draft.assignment}
          aria-invalid={Boolean(errors.assignment)}
          onChange={(event) => change({ assignment: event.target.value })}
        >
          <option value="">Choose a vehicle</option>
          {listed.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.id} · {vehicle.reefer ? 'Refrigerated ' : ''}
              {vehicle.type.toLowerCase()}
            </option>
          ))}
        </select>
      ) : draft.role === 'loader' ? (
        <select
          value={draft.assignment}
          aria-invalid={Boolean(errors.assignment)}
          onChange={(event) => change({ assignment: event.target.value })}
        >
          <option value="">Choose a dock bay</option>
          {docks.map((dock) => (
            <option key={dock}>{dock}</option>
          ))}
        </select>
      ) : draft.role === 'store-manager' ? (
        <input
          value={draft.assignment}
          placeholder="OUT001"
          aria-invalid={Boolean(errors.assignment)}
          onChange={(event) => change({ assignment: event.target.value.toUpperCase() })}
        />
      ) : (
        <input value={draft.assignment} readOnly />
      )}
    </Field>
  )

  if (compact)
    return (
      <AdminPage>
        <Pill tone="orange">
          Step {step} of 2 · {step === 1 ? 'Role and details' : 'Contact and assignment'}
        </Pill>
        <AdminIntro title="Add user" />
        {step === 1 ? (
          <>
            {roleRows}
            {nameField}
          </>
        ) : (
          <>
            <p className="ad-lead">
              {draft.name} · {roleLabels[draft.role]}
            </p>
            <div className="ad-form-grid">
              {mobileField}
              {depotField}
              {assignmentField}
            </div>
          </>
        )}
        <div className="ad-bottom-bar">
          {step === 1 ? (
            <Btn onClick={next}>Continue</Btn>
          ) : (
            <>
              <Btn onClick={send} disabled={action.isPending}>
                Send invite
              </Btn>
              <Btn variant="grey" onClick={() => setStep(1)}>
                Back
              </Btn>
            </>
          )}
        </div>
      </AdminPage>
    )

  return (
    <AdminPage>
      <AdminIntro
        kicker="Administration · Team & access"
        title="Add user"
        lead="Choose a role first. The form adapts to it."
      />
      <div className="ad-compose">
        <div className="ad-stack">
          <Card label="Role">
            <CardLabel>Step 1 · Role</CardLabel>
            {roleCards}
          </Card>
          <Card label="Details">
            <CardLabel>Step 2 · Details</CardLabel>
            <div className="ad-form-grid">
              {nameField}
              {mobileField}
              {depotField}
              {assignmentField}
            </div>
          </Card>
        </div>
        <div className="ad-stack">
          <Card label="What this role can do">
            <CardLabel>This person will</CardLabel>
            <ul className="ad-checks">
              {summary.will.map((line) => (
                <li key={line}>
                  <Check size={16} aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
            <CardLabel>This person will not</CardLabel>
            <ul className="ad-checks">
              {summary.willNot.map((line) => (
                <li key={line} className="ad-no">
                  <Minus size={16} aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </Card>
          <Card label="Access summary">
            <CardLabel>Access summary</CardLabel>
            <div className="ad-chips">
              <Pill>{roleLabels[draft.role]}</Pill>
              <Pill>{draft.depot}</Pill>
              {draft.assignment && <Pill>{draft.assignment}</Pill>}
            </div>
          </Card>
          <div className="ad-actions">
            <Btn onClick={send} disabled={action.isPending}>
              Send invite
            </Btn>
            <Btn variant="grey" onClick={() => navigate('/administration/team')}>
              Cancel
            </Btn>
            <p className="ad-note">The invite link expires in 48 hours.</p>
          </div>
        </div>
      </div>
    </AdminPage>
  )
}
