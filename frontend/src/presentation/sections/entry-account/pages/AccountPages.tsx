import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, Save, User } from 'lucide-react'
import { useOperations, useAction } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'
import { Button } from '../../../shared/atoms/button'
import { Input } from '../../../shared/atoms/input'
import { Switch } from '../../../shared/atoms/switch'
import { PageHeading, Panel, Field, Notice } from '../../../shared/molecules/Common'
import { formatTime } from '../../../shared/lib/utils'

function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const service = useServices(),
    action = useAction()
  const [profileName, setName] = useState(name),
    [profilePhone, setPhone] = useState(phone)
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        action.run(
          () =>
            service.updateSettings({
              profileName: profileName.trim(),
              profilePhone: profilePhone.trim(),
            }),
          'Profile saved locally',
        )
      }}
    >
      <Field label="Full name">
        <Input
          required
          minLength={2}
          value={profileName}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Phone">
        <Input
          required
          type="tel"
          value={profilePhone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <Field label="Assigned role">
        <Input value="Driver · Peliyagoda" readOnly />
      </Field>
      <Button
        type="submit"
        disabled={
          action.isPending || profileName.trim().length < 2 || profilePhone.trim().length < 7
        }
      >
        <Save size={16} />
        Save profile
      </Button>
    </form>
  )
}
export function ProfilePage() {
  const { data } = useOperations()
  if (!data) return null
  return (
    <>
      <PageHeading
        title="Your profile"
        description="Personal details saved in this demo workspace."
      />
      <Panel className="max-w-2xl" title={data.settings.profileName} action={<User size={20} />}>
        <div className="panel-body">
          <ProfileForm
            key={data.settings.profileName + data.settings.profilePhone}
            name={data.settings.profileName}
            phone={data.settings.profilePhone}
          />
        </div>
      </Panel>
      <Link to="/account/settings">
        <Button variant="ghost" className="mt-4">
          Preferences
          <ArrowRight size={16} />
        </Button>
      </Link>
    </>
  )
}
export function SettingsPage() {
  const { data } = useOperations(),
    service = useServices(),
    action = useAction()
  if (!data) return null
  return (
    <>
      <PageHeading
        title="Preferences"
        description="These settings apply to this browser’s demo workspace."
      />
      <Panel title="Display & notifications" className="max-w-2xl">
        <div className="panel-body">
          <div className="flex justify-between items-center py-4 border-b">
            <div>
              <strong>Show operational notifications</strong>
              <p className="text-xs text-muted-foreground mt-1">
                The notification feed remains available in your account.
              </p>
            </div>
            <Switch
              checked={data.settings.notifications}
              aria-label="Show operational notifications"
              onCheckedChange={(v) =>
                action.run(() => service.updateSettings({ notifications: v }))
              }
            />
          </div>
          <div className="flex justify-between items-center py-4">
            <div>
              <strong>Compact order rows</strong>
              <p className="text-xs text-muted-foreground mt-1">
                Fit more records in the desktop order queue.
              </p>
            </div>
            <Switch
              checked={data.settings.compactRows}
              aria-label="Compact order rows"
              onCheckedChange={(v) => action.run(() => service.updateSettings({ compactRows: v }))}
            />
          </div>
        </div>
      </Panel>
      <Notice title="Device storage" tone="neutral">
        Evidence and queued records are stored in this browser. Clearing site data removes them. Use
        Recovery to review pending records before leaving.
      </Notice>
    </>
  )
}
export function NotificationsPage() {
  const { data } = useOperations()
  if (!data) return null
  return (
    <>
      <PageHeading
        title="Latest updates"
        description="Activity from your shared operational workspace."
      />
      <Panel>
        {data.audit.slice(0, 20).map((a) => (
          <div className="list-row" key={a.id}>
            <Bell size={18} className="text-muted-foreground shrink-0" />
            <div className="flex-1">
              <strong className="text-sm">{a.action}</strong>
              <p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
            </div>
            <time className="text-xs text-muted-foreground" dateTime={a.at}>
              {formatTime(a.at)}
            </time>
          </div>
        ))}
      </Panel>
    </>
  )
}
