import { useState } from 'react'
import { toast } from 'sonner'
import type { TeamMember } from '../../../../domain/models'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useApis } from '../../../providers/ApisContext'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { useSession } from '../../../session/useSession'
import { Action, FieldInput, PageIntro, StorePage } from '../components/StoreKit'
import { checkContact, sameContact, type Contact } from '../lib/contact'
import { cutoffLabel } from '../lib/cutoff'
import { useOutbox } from '../lib/outbox'
import { useStoreOutlet, useStoreProfile } from '../lib/useStore'
import { useStoreAction } from '../lib/useStoreAction'
import { formatTime12 } from '../lib/windows'

/** The person's own contact details, which they can change. */
function ContactForm({ member }: { member: TeamMember }) {
  const action = useStoreAction()
  const waiting = useOutbox(useStoreOutlet()).some(
    (item) => item.request.kind === 'profile' && item.status !== 'failed',
  )
  const saved: Contact = { name: member.name, mobile: member.mobile ?? '', email: member.email }
  const [draft, setDraft] = useState<Contact>(saved)
  const [attempted, setAttempted] = useState(false)
  const errors = attempted ? checkContact(draft) : {}
  const changed = !sameContact(draft, saved)
  const change = (patch: Partial<Contact>) => setDraft((current) => ({ ...current, ...patch }))
  const save = () => {
    setAttempted(true)
    if (Object.keys(checkContact(draft)).length) return
    action.send(
      { kind: 'profile', memberId: member.id, ...draft },
      'Update your contact details',
      () => {
        setAttempted(false)
        toast.success('Contact details saved')
      },
    )
  }
  return (
    <section className="sm-panel" aria-label="Your details">
      <h2 className="sm-h22">Your details</h2>
      <div className="sm-pair">
        <FieldInput
          label="Full name"
          value={draft.name}
          error={errors.name}
          autoComplete="name"
          onChange={(event) => change({ name: event.target.value })}
        />
        <FieldInput
          label="Phone"
          type="tel"
          value={draft.mobile}
          error={errors.mobile}
          autoComplete="tel"
          hint="Dispatch and drivers call this number about deliveries."
          onChange={(event) => change({ mobile: event.target.value })}
        />
      </div>
      <FieldInput
        label="Email"
        type="email"
        value={draft.email}
        error={errors.email}
        autoComplete="email"
        onChange={(event) => change({ email: event.target.value })}
      />
      {waiting && <p className="sm-note">Your last change is waiting to send.</p>}
      <div className="sm-actions">
        <Action onClick={save} disabled={!changed || action.isPending || waiting}>
          Save changes
        </Action>
        <Action
          variant="outline"
          onClick={() => {
            setDraft(saved)
            setAttempted(false)
          }}
          disabled={!changed}
        >
          Discard changes
        </Action>
      </div>
    </section>
  )
}

/** Things only an administrator can change: ask for the change, and say what it should be. */
function ChangeRequest({ member }: { member: TeamMember }) {
  const apis = useApis()
  const action = useStoreAction()
  const [detail, setDetail] = useState('')
  const [attempted, setAttempted] = useState(false)
  const error = attempted && detail.trim().length < 4 ? 'Describe what should change.' : undefined
  return (
    <section className="sm-panel" aria-label="Request a change">
      <h2 className="sm-h22">Change your outlet or role</h2>
      <p className="sm-muted">
        Your role, outlet and depot are set by an administrator. Tell them what should change and
        they will update it in Team.
      </p>
      <FieldInput
        label="What should change?"
        value={detail}
        error={error}
        placeholder="Example: I now manage OUT009 instead of OUT001."
        onChange={(event) => setDetail(event.target.value)}
      />
      <div className="sm-actions">
        <Action
          variant="outline"
          disabled={action.isPending}
          onClick={() => {
            setAttempted(true)
            if (detail.trim().length < 4) return
            action.runThen(
              () => apis.team.requestAccountChange(member.id, detail),
              () => {
                setDetail('')
                setAttempted(false)
                toast.success('Request sent to your administrator')
              },
            )
          }}
        >
          Send request
        </Action>
      </div>
    </section>
  )
}

/** Profile: edit your contact details, see the outlet you run and the ordering rules that apply. */
export default function ProfilePage() {
  const session = useSession()
  const clock = useBusinessClock()
  const { profile } = useStoreProfile()
  const members = useApiQuery(['members'], (apis) => apis.team.listMembers())
  const member = members.data?.find((candidate) => candidate.id === session.memberId)
  const fixed: [string, string][] = [
    ['Role', 'Store manager'],
    ['Outlet', session.outletId ?? 'Not assigned'],
    ['Outlet name', profile?.name ?? '—'],
    ['Brand', `Waypoint ${profile?.brand ?? 'Fresh'}`],
    ['Depot', session.depot ?? 'Not assigned'],
  ]
  return (
    <StorePage>
      <PageIntro title="Profile" context={`${session.outletId ?? 'No outlet'} · Store manager`} />
      {member && (
        // Remounts with the saved values after a change has been sent.
        <ContactForm key={`${member.name}|${member.mobile}|${member.email}`} member={member} />
      )}
      <section className="sm-panel" aria-label="Your outlet">
        <h2 className="sm-h22">Your outlet</h2>
        <div className="sm-facts">
          {fixed.map(([label, value]) => (
            <div className="sm-fact" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>
      {member && <ChangeRequest member={member} />}
      <section className="sm-panel" aria-label="Ordering rules">
        <h2 className="sm-h22">Ordering rules for your outlet</h2>
        <div className="sm-facts">
          <div className="sm-fact">
            <span>Order cutoff</span>
            <strong>{cutoffLabel(clock.cutoff)} daily</strong>
          </div>
          <div className="sm-fact">
            <span>Delivery days</span>
            <strong>Monday to Saturday</strong>
          </div>
          <div className="sm-fact">
            <span>Receiving window</span>
            <strong>
              {profile
                ? `${formatTime12(profile.receiving.earliest)} to ${formatTime12(profile.receiving.latest)}`
                : '—'}
            </strong>
          </div>
        </div>
        <p className="sm-muted sm-small">
          {profile?.receiving.reason} {profile?.schedule}.
        </p>
      </section>
    </StorePage>
  )
}
