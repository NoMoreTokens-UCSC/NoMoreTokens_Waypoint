import { useWebPushSubscription } from '../../hooks/useWebPushSubscription'
import { useApiQuery } from '../../hooks/useApiQuery'
import { useApis } from '../../providers/ApisContext'
import { useSession } from '../../session/useSession'
import { useAction, useOperations } from '../../hooks/useOperations'
import { useDeliveryNotifications } from '../../hooks/useDeliveryNotifications'
import { Button } from '../atoms/button'
import { Panel, StatusBadge } from '../molecules/Common'
import type { DeliveryNotice } from '../../../domain/api/driverSignals'

const EMPTY_NOTICES: DeliveryNotice[] = []
export function DeliveryAlerts() {
  const session = useSession(),
    apis = useApis(),
    action = useAction(),
    { data: snapshot } = useOperations()
  const query = useApiQuery(['delivery-alerts', session.outletId], (api) =>
    session.outletId ? api.driverSignals.listNotices(session.outletId) : Promise.resolve([]),
  )
  const pendingPush = snapshot?.pendingPushSubscriptions?.some(
    (subscription) => subscription.outletId === session.outletId,
  )
  const notices = query.data ?? EMPTY_NOTICES
  const notifications = useDeliveryNotifications(notices, snapshot?.settings.notifications ?? false)
  const push = useWebPushSubscription(session.outletId, notifications.refreshPermission)
  return (
    <Panel
      title="Delivery updates"
      description="Alerts for your outlet. Allow notifications on this device to be told when a delivery changes."
    >
      <div className="panel-body flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={
              notifications.permission === 'unsupported' ||
              notifications.permission === 'granted' ||
              notifications.permission === 'denied'
            }
            onClick={() => void notifications.enable()}
          >
            {notifications.permission === 'granted'
              ? 'System notifications enabled'
              : 'Enable system notifications'}
          </Button>
          <p className="text-xs text-muted-foreground">
            {notifications.permission === 'denied'
              ? 'Notifications were denied. Enable them in browser settings.'
              : notifications.permission === 'unsupported'
                ? 'System notifications need a supported browser on HTTPS.'
                : 'The in-app inbox works without notification permission. System alerts use the installed service worker.'}
          </p>
        </div>
        {push.configured && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={push.busy} onClick={() => void push.connect()}>
              Prepare remote push subscription
            </Button>
            <p className="text-xs text-muted-foreground">
              {pendingPush
                ? 'Subscription saved locally. Backend registration is pending.'
                : 'Creates a browser subscription for backend registration. No remote delivery service is connected.'}
            </p>
          </div>
        )}
        {push.error && <p role="alert">{push.error}</p>}
        {!snapshot?.settings.notifications && (
          <p className="text-sm">Delivery system alerts are turned off in account preferences.</p>
        )}
        {notifications.error && <p role="alert">{notifications.error}</p>}
        {query.error && <p role="alert">{query.error.message}</p>}
        {query.isPending ? (
          <p role="status">Opening alerts…</p>
        ) : !notices.length ? (
          <p className="text-sm text-muted-foreground">No delivery updates yet.</p>
        ) : (
          notices.map((notice) => (
            <article
              key={notice.id}
              className="flex flex-col gap-2 rounded-xl border border-border p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3>{notice.title}</h3>
                <StatusBadge tone={notice.readAt ? 'neutral' : 'warning'}>
                  {notice.readAt ? 'Acknowledged' : 'Unread'}
                </StatusBadge>
              </div>
              <p className="text-sm">{notice.message}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(notice.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} ·{' '}
                {notice.delivery === 'local'
                  ? 'Saved on this device · not sent remotely'
                  : notice.delivery}
              </p>
              {!notice.readAt && (
                <Button
                  className="self-start"
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() => action.run(() => apis.driverSignals.acknowledgeNotice(notice.id))}
                >
                  Acknowledge delivery alert
                </Button>
              )}
            </article>
          ))
        )}
      </div>
    </Panel>
  )
}
