import { Bell } from 'lucide-react'
import { useOperations, useAction } from '../../../hooks/useOperations'
import { useApis } from '../../../providers/ApisContext'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { Switch } from '../../../shared/atoms/switch'
import { PageHeading, Panel, Notice } from '../../../shared/molecules/Common'
import { formatTime } from '../../../shared/lib/utils'

export function SettingsPage() {
  const action = useAction()
  const apis = useApis()
  const settings = useApiQuery(['settings'], (api) => api.account.getSettings())
  if (!settings.data) return null
  return (
    <>
      <PageHeading title="Preferences" description="These settings apply to this device." />
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
              checked={settings.data.notifications}
              aria-label="Show operational notifications"
              onCheckedChange={(v) => action.run(() => apis.account.updateSettings({ notifications: v }))}
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
              checked={settings.data.compactRows}
              aria-label="Compact order rows"
              onCheckedChange={(v) => action.run(() => apis.account.updateSettings({ compactRows: v }))}
            />
          </div>
        </div>
      </Panel>
      <Notice title="Device storage" tone="neutral">
        Preferences, saved photographs and records waiting to sync are kept in this browser. Clearing site
        data removes them. Use Saved records to review anything pending before you leave.
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
