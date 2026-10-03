import { Link } from 'react-router-dom'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useSession } from '../../../session/useSession'
import { Button } from '../../../shared/atoms/button'
import { Panel, StatusBadge } from '../../../shared/molecules/Common'

export function StorePendingHandoffs() {
  const session = useSession()
  const query = useApiQuery(['manager-handoffs', session.outletId], async (apis) => {
    const [stops, drafts] = await Promise.all([
      apis.delivery.listStops({ outletId: session.outletId }),
      apis.delivery.listProofDrafts(),
    ])
    return stops
      .filter((stop) => stop.outlet === session.outletId && stop.status === 'Arrived')
      .map((stop) => ({ stop, draft: drafts.find((draft) => draft.stopId === stop.id) }))
  })
  if (!query.data?.length) return null
  return (
    <Panel
      title="Confirm an arrived delivery"
      description="Review actual unloaded quantities and remarks, then sign once. This also records your store receipt."
    >
      {query.data.map(({ stop, draft }) => (
        <div
          key={stop.id}
          className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-4"
        >
          <div className="min-w-0 space-y-2">
            <strong>
              {stop.outlet} · {stop.name}
            </strong>
            <p className="text-sm text-muted-foreground">
              {stop.cases} expected cases ·{' '}
              {draft?.stage === 'attached'
                ? 'Driver photo ready for review'
                : 'Waiting for Driver to attach the delivery photo'}
            </p>
          </div>
          {draft?.stage === 'attached' ? (
            <Button asChild className="min-h-11 h-auto whitespace-normal">
              <Link to={`/store-manager/deliveries/confirm?stop=${encodeURIComponent(stop.id)}`}>
                Review & confirm handoff
              </Link>
            </Button>
          ) : (
            <StatusBadge>Photo pending</StatusBadge>
          )}
        </div>
      ))}
    </Panel>
  )
}
