import { DriverActions } from '../molecules/DriverActions'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverStopLayout } from '../templates/DriverStopLayout'
import { DriverLink } from '../molecules/DriverLink'
import { Notice } from '../../../shared/molecules/Common'

export default function DriverCameraUnavailablePage() {
  const state = useDriverStop()
  return (
    <DriverStopLayout state={state} title="Camera access needed" proofStep>
      <Notice title="A photo is required" tone="danger">
        If your browser denied access, allow the camera in its site permissions and try again. If
        this device has no camera, choose an existing delivery photograph.
      </Notice>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Camera permission is managed by your browser. This screen does not claim to detect your
        device’s permissions.
      </p>
      <DriverActions>
        <DriverLink to={state.href('/driver/proof/capture')}>
          Try camera again or choose a photo
        </DriverLink>
        <DriverLink to={state.href('/driver/arrival')} variant="secondary">
          Back to delivery
        </DriverLink>
      </DriverActions>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Delivery remains open until proof is submitted and an acknowledgement is accepted.
      </p>
    </DriverStopLayout>
  )
}
