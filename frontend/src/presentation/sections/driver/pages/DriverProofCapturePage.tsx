import { useDriverProofActions } from '../hooks/useDriverProofActions'
import { DriverActions } from '../molecules/DriverActions'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverStopLayout } from '../templates/DriverStopLayout'
import { DriverLink } from '../molecules/DriverLink'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { DriverPhotoPicker } from '../molecules/DriverPhotoPicker'

export default function DriverProofCapturePage() {
  const state = useDriverStop()
  const { capturePhoto, busy } = useDriverProofActions(state)
  return (
    <DriverStopLayout state={state} title="Proof of delivery" proofStep>
      <p>Photograph the delivered goods clearly before submitting the delivery.</p>
      <DriverPhotoPreview />
      <DriverPhotoPicker busy={busy} onPick={capturePhoto} />
      {state.draft && (
        <DriverLink to={state.href('/driver/proof/review')} variant="outline">
          Review saved photograph
        </DriverLink>
      )}
      <DriverActions>
        <DriverLink to={state.href('/driver/proof/camera-unavailable')} variant="secondary">
          Camera denied or unavailable
        </DriverLink>
        <DriverLink to={state.href('/driver/arrival')} variant="secondary">
          Cancel
        </DriverLink>
      </DriverActions>
      <p className="text-sm leading-relaxed text-muted-foreground">
        A photo is required before completion.
      </p>
    </DriverStopLayout>
  )
}
