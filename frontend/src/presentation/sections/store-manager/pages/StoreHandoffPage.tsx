import { Link, useSearchParams } from 'react-router-dom'
import { handoffErrors } from '../../../../domain/driverProof'
import { useApiQuery } from '../../../hooks/useApiQuery'
import { useConnectivity } from '../../../hooks/useOperations'
import { useApis } from '../../../providers/ApisContext'
import { useSession } from '../../../session/useSession'
import { useHandoffAction } from '../../../shared/hooks/useHandoffAction'
import { useBlobUrl } from '../../../hooks/useBlobUrl'
import { Button } from '../../../shared/atoms/button'
import { PageHeading, Notice, EmptyState } from '../../../shared/molecules/Common'
import { ManagerHandoffForm } from '../../../shared/organisms/ManagerHandoffForm'
import { ManagerSignOffDetails } from '../../../shared/organisms/ManagerSignOffDetails'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'

export default function StoreHandoffPage() {
  const [params] = useSearchParams()
  const session = useSession(),
    apis = useApis(),
    online = useConnectivity(),
    action = useHandoffAction()
  const stopId = params.get('stop') ?? ''
  useBreadcrumb([
    { label: 'Deliveries', to: '/store-manager/deliveries' },
    { label: 'Confirm handoff' },
  ])
  const query = useApiQuery(['manager-handoff', session.outletId, stopId], async (apis) => {
    const [stops, orders, draft, route, settings] = await Promise.all([
      apis.delivery.listStops({ outletId: session.outletId }),
      apis.orders.listOrders({ outletId: session.outletId }),
      apis.delivery.getProofDraft(stopId),
      apis.delivery.getRoute(),
      apis.account.getSettings(),
    ])
    return {
      stop: stops.find(
        (stop) =>
          stop.id === stopId &&
          stop.outlet === session.outletId &&
          (route.stops.length === 0 || route.stops.some((assigned) => assigned.id === stop.id)),
      ),
      orders,
      draft,
      started: route.started || route.stops.length === 0,
      settings,
    }
  })
  const { stop, draft } = query.data ?? {}
  const photoUrl = useBlobUrl(draft?.photo)
  const review = params.get('review') === '1'
  const errors = draft && stop ? handoffErrors(draft, stop.cases) : []
  const connected = online && !query.data?.settings.simulatedOffline
  function confirmReceipt() {
    if (!stop || !draft || !session.outletId || errors.length) return
    action.runAndNavigate(
      async () => {
        await apis.delivery.confirmManagerHandoff(session.outletId!, stop.id, {
          photo: new File([draft.photo], draft.fileName, { type: draft.photo.type }),
          quantity: draft.quantity,
          receiver: draft.receiver,
          exception: draft.exception,
          signature: draft.signature,
          managerSignOff: draft.managerSignOff,
          capturedRevision: draft.revision,
        })
        if (connected) await apis.delivery.sync(true, { retryFailed: false })
      },
      '/store-manager/deliveries',
      connected
        ? 'Signed receipt saved. Check upload status in Deliveries.'
        : 'Signed receipt saved offline; upload is pending.',
    )
  }
  return (
    <div className="mx-auto flex w-full max-w-[760px] min-w-0 flex-col gap-4 [&_button]:min-h-11 [&_button]:h-auto [&_button]:whitespace-normal">
      <PageHeading
        title="Confirm delivery handoff"
        description="Check the Driver’s photo, unloaded quantities and condition. Your remarks and signature record the store receipt."
      />
      {query.isPending ? (
        <p role="status">Opening handoff…</p>
      ) : query.error ? (
        <Notice title="Handoff could not be opened" tone="danger">
          {query.error.message}
        </Notice>
      ) : !stop ? (
        <EmptyState title="No delivery assigned to this outlet" />
      ) : stop.status !== 'Arrived' ? (
        <Notice title="Handoff is not awaiting confirmation">
          The Driver must arrive and park first. Already submitted or completed receipts are
          available in Deliveries.
        </Notice>
      ) : !draft || draft.stage !== 'attached' ? (
        <Notice title="Waiting for the delivery photo">
          The Driver must capture, review and attach a photo before you can sign.
        </Notice>
      ) : (
        <>
          {photoUrl && (
            <img
              src={photoUrl}
              alt="Driver delivery photo for manager review"
              className="max-h-80 w-full rounded-lg border object-contain"
            />
          )}
          {review && !errors.length ? (
            <>
              <ManagerSignOffDetails signature={draft.signature} signOff={draft.managerSignOff} />
              <Notice
                title={connected ? 'Confirm the signed receipt' : 'Save receipt offline'}
                tone="neutral"
              >
                Confirming saves your signed receipt with the delivery proof. Upload acceptance
                remains a separate status. This frontend demo shares records on this browser;
                another device needs the backend connection.
              </Notice>
              <Button disabled={action.isPending} onClick={confirmReceipt}>
                Confirm delivery receipt
              </Button>
              <Button asChild variant="outline">
                <Link to={`/store-manager/deliveries/confirm?stop=${encodeURIComponent(stopId)}`}>
                  Edit receipt details
                </Link>
              </Button>
            </>
          ) : (
            <ManagerHandoffForm
              key={`${stop.id}-${draft.fileName}`}
              draft={draft}
              expected={stop.cases}
              orders={query.data.orders.filter((order) => stop.orderIds.includes(order.id))}
              next={`/store-manager/deliveries/confirm?stop=${encodeURIComponent(stopId)}&review=1`}
              ownDevice
            />
          )}
        </>
      )}
      <Button asChild variant="secondary">
        <Link to="/store-manager/deliveries">Back to deliveries</Link>
      </Button>
    </div>
  )
}
