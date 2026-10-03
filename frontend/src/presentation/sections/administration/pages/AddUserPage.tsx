import { Check, Minus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { Workspace } from '../../../../domain/models'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useAction } from '../../../hooks/useOperations'
import { useApis } from '../../../providers/ApisContext'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import { AdminIntro, AdminPage, Btn, Card, CardLabel, Field, Pill } from '../components/AdminKit'
import { vehicleDepot } from '../../../../domain/fleet'
import { managerOf, outletAssignment, useOutlets } from '../lib/outlets'
import { useVehicles } from '../lib/vehicles'
import {
  generatePassword,
  passwordProblem,
  suggestUsername,
  usernameProblem,
} from '../lib/credentials'
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
  username: string
  password: string
}
type Errors = Partial<Record<'name' | 'mobile' | 'assignment' | 'username' | 'password', string>>

function check(draft: Draft, taken: Set<string>): Errors {
  const errors: Errors = {}
  errors.username = usernameProblem(draft.username, taken)
  errors.password = passwordProblem(draft.password)
  if (!errors.username) delete errors.username
  if (!errors.password) delete errors.password
  if (draft.name.trim().length < 2) errors.name = 'Enter their full name.'
  if (!validMobile(draft.mobile))
    errors.mobile = 'Enter a Sri Lankan mobile such as +94 77 123 4567.'
  if (draft.role === 'driver' && !/^VEH\d+$/.test(draft.assignment))
    errors.assignment = 'Choose a vehicle.'
  if (draft.role === 'store-manager' && !/^OUT\d+/.test(draft.assignment.trim()))
    errors.assignment = 'Choose an outlet.'
  if (draft.role === 'loader' && !draft.assignment) errors.assignment = 'Choose a dock bay.'
  return errors
}

/** Add user: choose the role first, then the details the role needs. Phones do it in two steps. */
function AddUserForm() {
  const navigate = useNavigate()
  const apis = useApis()
  const action = useAction()
  const compact = useCompactLayout()
  const { members } = useMembers()
  const { outlets } = useOutlets()
  const [params] = useSearchParams()
  const vehicles = useApiQuery(['vehicles'], (api) => api.fleet.listVehicles())
  // `?role=store-manager&outlet=OUT121` (from an outlet's page) starts the form on that outlet.
  const [draft, setDraft] = useState<Draft>(() => {
    const outlet = outlets.find((candidate) => candidate.id === params.get('outlet'))
    const vehicle = vehicles.data?.find((candidate) => candidate.id === params.get('vehicle'))
    return {
      role: outlet || params.get('role') === 'store-manager' ? 'store-manager' : 'driver',
      name: '',
      mobile: '',
      depot: outlet?.depot ?? (vehicle ? vehicleDepot(vehicle) : 'Peliyagoda'),
      assignment: outlet ? outletAssignment(outlet) : (vehicle?.id ?? ''),
      username: '',
      password: generatePassword(),
    }
  })
  // The username follows the name until the administrator types their own.
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [step, setStep] = useState(1)
  const [attempted, setAttempted] = useState(false)
  useBreadcrumb([{ label: 'Team & access', to: '/administration/team' }, { label: 'Add user' }])

  const usernames = new Set(members.map((member) => member.username).filter(Boolean) as string[])
  const errors = attempted ? check(draft, usernames) : {}
  // A store manager is assigned to an outlet that exists and has no manager yet.
  const openOutlets = outlets.filter((outlet) => !managerOf(outlet, members))
  const taken = new Set(members.map((member) => member.vehicleId).filter(Boolean))
  const free = (vehicles.data ?? []).filter((vehicle) => !taken.has(vehicle.id))
  const listed = free.filter((vehicle) => vehicleDepot(vehicle) === draft.depot)
  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))
  const pickRole = (role: Workspace) =>
    change({
      role,
      assignment: role === 'dispatcher' ? 'Planning office' : '',
    })
  const summary = roleSummary[draft.role]

  const send = () => {
    setAttempted(true)
    const problems = check(draft, usernames)
    if (Object.keys(problems).length) {
      if (compact && problems.name) setStep(1)
      toast.error('Check the highlighted details.')
      return
    }
    action.run(async () => {
      await apis.team.createUser({
        name: draft.name.trim(),
        mobile: draft.mobile.trim(),
        role: draft.role,
        depot: draft.depot,
        assignment: draft.assignment.trim(),
        username: draft.username.trim().toLowerCase(),
        password: draft.password,
      })
      // The password is passed on in memory only, to show once on the next screen.
      navigate('/administration/team/created', { state: draft })
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
        onChange={(event) =>
          change({
            name: event.target.value,
            ...(usernameEdited ? {} : { username: suggestUsername(event.target.value) }),
          })
        }
      />
    </Field>
  )
  const mobileField = (
    <Field
      label="Mobile number"
      hint="Shown in the team list and on run sheets."
      error={errors.mobile}
    >
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
            ? openOutlets.length
              ? 'Outlets that do not have a store manager yet.'
              : 'Every outlet has a manager. Add an outlet first.'
            : draft.role === 'loader'
              ? 'Shared dock tablet.'
              : 'Plans from the central office.'
      }
    >
      {draft.role === 'store-manager' && openOutlets.length === 0 && (
        <Link className="ad-inline-link" to="/administration/outlets/new">
          Add an outlet
        </Link>
      )}
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
        <select
          value={draft.assignment}
          aria-invalid={Boolean(errors.assignment)}
          onChange={(event) => {
            const outlet = outlets.find(
              (candidate) => outletAssignment(candidate) === event.target.value,
            )
            change({ assignment: event.target.value, ...(outlet ? { depot: outlet.depot } : {}) })
          }}
        >
          <option value="">Choose an outlet</option>
          {openOutlets.map((outlet) => (
            <option key={outlet.id} value={outletAssignment(outlet)}>
              {outlet.id} · {outlet.name} · {outlet.brand}
            </option>
          ))}
        </select>
      ) : (
        <input value={draft.assignment} readOnly />
      )}
    </Field>
  )

  const usernameField = (
    <Field
      label="Username"
      hint="They sign in with this. Letters, numbers, dots and dashes."
      error={errors.username}
    >
      <input
        value={draft.username}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={Boolean(errors.username)}
        onChange={(event) => {
          setUsernameEdited(true)
          change({ username: event.target.value.toLowerCase() })
        }}
      />
    </Field>
  )
  const passwordField = (
    <Field
      label="Temporary password"
      hint="You give these sign-in details to them yourself. This system does not send them."
      error={errors.password}
    >
      <span className="ad-inline">
        <input
          value={draft.password}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(errors.password)}
          onChange={(event) => change({ password: event.target.value })}
        />
        <Btn variant="grey" onClick={() => change({ password: generatePassword() })}>
          Generate
        </Btn>
      </span>
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
              {usernameField}
              {passwordField}
            </div>
          </>
        )}
        <div className="ad-bottom-bar">
          {step === 1 ? (
            <Btn onClick={next}>Continue</Btn>
          ) : (
            <>
              <Btn onClick={send} disabled={action.isPending}>
                Create user
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
          <Card label="Sign-in details">
            <CardLabel>Step 3 · Sign-in</CardLabel>
            <div className="ad-form-grid">
              {usernameField}
              {passwordField}
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
              {draft.username && <Pill>{draft.username}</Pill>}
            </div>
          </Card>
          <div className="ad-actions">
            <Btn onClick={send} disabled={action.isPending}>
              Create user
            </Btn>
            <Btn variant="grey" onClick={() => navigate('/administration/team')}>
              Cancel
            </Btn>
            <p className="ad-note">You give them the username and password yourself.</p>
          </div>
        </div>
      </div>
    </AdminPage>
  )
}

export default function AddUserPage() {
  // The form starts from the outlets, so wait until they are known.
  const { loaded } = useOutlets()
  const fleet = useVehicles()
  return loaded && fleet.loaded ? <AddUserForm /> : null
}
