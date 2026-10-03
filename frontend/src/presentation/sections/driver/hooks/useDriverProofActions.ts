import { useNavigate } from 'react-router-dom'
import { photoDigest } from '../../../../domain/photoDigest'
import { attachPhoto, handoffErrors } from '../../../../domain/driverProof'
import { useApis } from '../../../providers/ApisContext'
import { useDriverAction } from './useDriverAction'
import type { DriverStopState } from './useDriverData'

/** Owns durable proof transitions; routed pages compose the review screens. */
export function useDriverProofActions(state: DriverStopState) {
  const apis = useApis()
  const action = useDriverAction()
  const navigate = useNavigate()

  async function capturePhoto(file: File) {
    const { stop, data, draft } = state
    if (!stop || !data) return
    await action.mutateAsync(async () => {
      await apis.delivery.saveProofDraft({
        stopId: stop.id,
        photo: file,
        fileName: file.name,
        stage: 'captured',
        quantity: draft?.quantity ?? stop.cases,
        receiver: draft?.receiver ?? '',
        acknowledged: draft?.acknowledged ?? false,
        exception: draft?.exception ?? '',
        revision: draft?.revision ?? data.route.revision,
        createdAt: new Date().toISOString(),
        photoDigest: await photoDigest(file),
      })
    })
    navigate(state.href('/driver/proof/review'))
  }

  function attachProof() {
    const { draft } = state
    if (!draft) return
    action.runAndNavigate(
      () => apis.delivery.saveProofDraft(attachPhoto(draft)),
      state.href('/driver/proof/attached'),
      'Photo attached locally',
    )
  }

  function submitProof() {
    const { draft, stop } = state
    if (!draft || !stop || draft.stage !== 'attached' || handoffErrors(draft, stop.cases).length)
      return
    action.runAndNavigate(
      () =>
        apis.delivery.saveProof(draft.stopId, {
          photo: new File([draft.photo], draft.fileName, { type: draft.photo.type }),
          quantity: draft.quantity,
          receiver: draft.acknowledged ? draft.receiver : '',
          exception: draft.exception,
          capturedRevision: draft.revision,
          signature: draft.signature,
          managerSignOff: draft.managerSignOff,
        }),
      state.href('/driver/sync'),
      'Proof saved locally for acknowledgement',
    )
  }
  return { capturePhoto, attachProof, submitProof, busy: action.isPending }
}
