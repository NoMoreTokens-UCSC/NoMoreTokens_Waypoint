import type { Stop } from '../../../../domain/models'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { Panel } from '../../../shared/molecules/Common'
import { DriverButton } from '../atoms/DriverButton'

export function DriverStoreContact({ stop }: { stop: Stop }) {
  const query = useApiQuery(['store-contact', stop.outlet], async (apis) => {
    const [members, notices] = await Promise.all([
      apis.team.listMembers(),
      apis.driverSignals.listNotices(stop.outlet),
    ])
    return {
      manager: members.find(
        (member) =>
          member.role === 'store-manager' &&
          member.status === 'Active' &&
          member.outletId === stop.outlet,
      ),
      notices: notices.filter((notice) => notice.stopId === stop.id),
    }
  })
  const phone = query.data?.manager?.mobile?.replace(/[^+\d]/g, '')
  const notice = query.data?.notices[0]
  const message = `Delivery for ${stop.outlet}: planned ETA ${stop.eta}, receiving window ${stop.window}. ${stop.issue ?? 'Please be ready to check quantities and sign at unloading.'}`
  return (
    <Panel title="Contact the receiving manager">
      <div className="panel-body flex flex-col gap-3">
        {notice && (
          <p className="text-sm">
            Latest local update: {notice.title}. {notice.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Updates are retained locally. No remote notification has been sent. If data is
          unavailable, use a cellular call or prepare an SMS; the phone network must be available.
        </p>
        {query.error ? (
          <p role="alert">{query.error.message}</p>
        ) : query.isPending ? (
          <p role="status">Opening contact…</p>
        ) : phone ? (
          <div className="flex flex-wrap gap-3">
            <DriverButton asChild variant="outline">
              <a href={`tel:${phone}`}>Call {query.data?.manager?.name}</a>
            </DriverButton>
            <DriverButton asChild variant="outline">
              <a href={`sms:${phone}?body=${encodeURIComponent(message)}`}>Prepare SMS</a>
            </DriverButton>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No receiving-manager phone is assigned to this outlet. Contact dispatch using your usual
            channel.
          </p>
        )}
      </div>
    </Panel>
  )
}
