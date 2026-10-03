import { DeliveryWindowNotice } from '../molecules/DeliveryWindowNotice'
import { DriverStoreContact } from '../organisms/DriverStoreContact'
import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { DriverButton as Button } from '../atoms/DriverButton'
import { EmptyState, Notice, StatusBadge } from '../../../shared/molecules/Common'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import type { DriverStopState } from '../hooks/useDriverData'
import { DriverScreen } from './DriverScreen'

export function DriverStopLayout({
  state,
  title,
  children,
  proofStep,
  requireDraft,
  wide,
}: {
  state: DriverStopState
  title: string
  children: ReactNode
  proofStep?: boolean
  requireDraft?: boolean
  wide?: boolean
}) {
  useBreadcrumb([{ label: 'Current route', to: '/driver/route' }, { label: title }])
  if (proofStep && state.record)
    return (
      <Navigate
        replace
        to={state.href(state.proof === 'accepted' ? '/driver/delivered' : '/driver/sync')}
      />
    )
  const parked = state.stop?.status === 'Arrived' && state.data?.route.started
  return (
    <DriverScreen
      title={title}
      narrow={!wide}
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
      description={state.stop ? `${state.stop.outlet} · ${state.stop.name}` : undefined}
    >
      {!state.stop ? (
        <EmptyState
          title="No assigned stop"
          description="Choose a stop from your current route."
          action={
            <Button asChild>
              <Link to="/driver/route">Current route</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs leading-relaxed text-muted-foreground">
            <StatusBadge tone={state.online ? 'success' : 'warning'}>
              {state.online ? 'Online' : 'Offline · saved route'}
            </StatusBadge>
            <span>
              {state.stop.cases} cases · ETA {state.stop.eta} · Window {state.stop.window}
            </span>
          </div>
          <DeliveryWindowNotice stop={state.stop} orders={state.data?.orders ?? []} />
          <DriverStoreContact stop={state.stop} />
          {proofStep && !parked ? (
            <Notice title="Confirm you are safely parked before recording proof">
              <Button asChild variant="outline">
                <Link to={state.href('/driver/navigation')}>Open navigation</Link>
              </Button>
            </Notice>
          ) : requireDraft && !state.draft ? (
            <Notice title="A delivery photograph is required">
              <Button asChild>
                <Link to={state.href('/driver/proof/capture')}>Capture delivery photo</Link>
              </Button>
            </Notice>
          ) : (
            children
          )}
        </>
      )}
    </DriverScreen>
  )
}
