import { useDriverProofActions } from '../hooks/useDriverProofActions'
import { DriverActions } from '../molecules/DriverActions'
import { useDriverStop } from '../hooks/useDriverData'
import { DriverStopLayout } from '../templates/DriverStopLayout'
import { DriverPhotoPreview } from '../molecules/DriverPhotoPreview'
import { DriverLink } from '../molecules/DriverLink'
import { DriverButton as Button } from '../atoms/DriverButton'
import { StatusBadge } from '../../../shared/molecules/Common'

export default function DriverProofReviewPage() {
  const state = useDriverStop()
  const { attachProof, busy } = useDriverProofActions(state)
  return (
    <DriverStopLayout state={state} title="Is everything clearly visible?" proofStep requireDraft>
      <DriverPhotoPreview photo={state.draft?.photo} fileName={state.draft?.fileName} />
      <StatusBadge tone="neutral">Captured · saved locally · not submitted</StatusBadge>
      <DriverActions>
        <Button onClick={attachProof} disabled={busy}>
          Use this photo
        </Button>
        <DriverLink to={state.href('/driver/proof/capture')} variant="secondary">
          Retake photo
        </DriverLink>
      </DriverActions>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your existing photo remains saved until a replacement is captured.
      </p>
    </DriverStopLayout>
  )
}
