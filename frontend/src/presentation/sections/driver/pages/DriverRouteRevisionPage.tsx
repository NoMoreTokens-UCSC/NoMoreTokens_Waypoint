import { useState } from 'react'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverScreen } from '../templates/DriverScreen'
import { DriverLink } from '../molecules/DriverLink'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { useApis } from '../../../providers/ApisContext'
import { useDriverAction } from '../hooks/useDriverAction'
import { DriverButton as Button } from '../atoms/DriverButton'
import { Checkbox } from '../../../shared/atoms/checkbox'
import { Notice, Panel } from '../../../shared/molecules/Common'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'

export default function DriverRouteRevisionPage() {
  const state = useDriverStop(),
    apis = useApis(),
    action = useDriverAction()
  const [acknowledged, setAcknowledged] = useState(false)
  const reviews = state.data?.queue.filter((record) => record.status === 'review') ?? []
  useBreadcrumb([{ label: 'Saved records', to: '/driver/sync' }, { label: 'Route revision' }])
  function acceptRevision() {
    action.runAndNavigate(
      async () => {
        for (const record of reviews) await apis.delivery.reviewQueuedRecord(record.id)
      },
      '/driver/sync',
      'Revised route acknowledged. Saved proof retained.',
    )
  }
  return (
    <DriverScreen
      title="Review updated route"
      narrow
      loading={state.isPending}
      error={state.error}
      retry={() => void state.refetch()}
    >
      <Notice title="Your records are kept">
        Nothing you saved is overwritten. Original photo, quantity, receiver details and capture
        revision remain attached to their outlet.
      </Notice>
      <Panel title={`Current Dispatcher revision · ${state.data?.route.revision ?? '—'}`}>
        <div className="panel-body flex min-w-0 flex-col gap-4">
          {reviews.map((record) => (
            <p key={record.id}>
              {state.data?.stops.find((stop) => stop.id === record.stopId)?.outlet ?? record.stopId}
              : captured against revision{' '}
              {state.data?.evidenceById[record.evidenceId]?.revision ?? record.revision} ·
              acknowledgement paused.
            </p>
          ))}
          <p className="text-sm leading-relaxed text-muted-foreground">
            The local demo supplies a current manifest and revision number. It does not supply a
            historical route diff; review the actual sequence below.
          </p>
          <ol>
            {state.data?.stops.map((stop, index) => (
              <li key={stop.id}>
                Stop {index + 1} · {stop.outlet} · {stop.name} · {stop.window} · {stop.cases} cases
              </li>
            ))}
          </ol>
        </div>
      </Panel>
      {state.evidence && (
        <DriverPhotoPreview photo={state.evidence.photo} fileName={state.evidence.fileName} />
      )}
      {reviews.length ? (
        <>
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(value) => setAcknowledged(value === true)}
            />
            I am safely stopped and have reviewed the revised instructions.
          </label>
          <Button onClick={acceptRevision} disabled={!acknowledged || action.isPending}>
            Accept revision and resume sync
          </Button>
        </>
      ) : (
        <Notice title="No records awaiting route review" tone="neutral">
          Current instructions are already acknowledged.
        </Notice>
      )}
      <DriverLink to="/driver/sync" variant="secondary">
        Back to saved records
      </DriverLink>
    </DriverScreen>
  )
}
