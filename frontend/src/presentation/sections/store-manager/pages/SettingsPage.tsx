import { useApiQuery } from '../../../hooks/useApiQuery'
import { useApis } from '../../../providers/ApisContext'
import { Switch } from '../../../shared/atoms/switch'
import { ActionLink, Callout, PageIntro, StorePage } from '../components/StoreKit'
import { useOutbox } from '../lib/outbox'
import { useStoreOutlet } from '../lib/useStore'
import { useStoreAction } from '../lib/useStoreAction'

/** Preferences: notifications, and what is stored on this device. */
export default function SettingsPage() {
  const apis = useApis()
  const action = useStoreAction()
  const outletId = useStoreOutlet()
  const unsent = useOutbox(outletId).length
  const settings = useApiQuery(['settings'], (api) => api.account.getSettings())
  if (!settings.data) return null
  return (
    <StorePage>
      <PageIntro title="Preferences" context={`${outletId} · Store manager`} />
      <section className="sm-panel" aria-label="Notifications">
        <h2 className="sm-h22">Notifications</h2>
        <div className="sm-setting">
          <div>
            <strong>Show operational notifications</strong>
            <p className="sm-muted sm-small">
              Deferrals, deliveries and receipts for your outlet. Anything that needs your action
              always appears in Notifications.
            </p>
          </div>
          <Switch
            checked={settings.data.notifications}
            aria-label="Show operational notifications"
            onCheckedChange={(value) =>
              action.run(() => apis.account.updateSettings({ notifications: value }))
            }
          />
        </div>
      </section>
      <section className="sm-panel" aria-label="This device">
        <h2 className="sm-h22">Saved on this device</h2>
        <p className="sm-muted">
          Orders, receipts and reports made without a connection are kept in this browser until they
          are sent. Clearing site data removes anything not yet sent.
        </p>
        {unsent > 0 ? (
          <Callout title={`${unsent} change${unsent === 1 ? '' : 's'} not sent yet`}>
            They are sent automatically when your connection returns.
          </Callout>
        ) : (
          <p className="sm-note">Everything has been sent.</p>
        )}
        <div className="sm-actions">
          <ActionLink variant="outline" to="/store-manager/notifications">
            Back to notifications
          </ActionLink>
        </div>
      </section>
    </StorePage>
  )
}
