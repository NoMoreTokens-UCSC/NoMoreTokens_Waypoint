import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import type { DriverStopState } from './useDriverData'
import { useApis } from '../../../providers/ApisContext'
import { useDriverAction } from './useDriverAction'

export function useDriverIssueForm(state: DriverStopState) {
  const apis = useApis(),
    action = useDriverAction()
  const [params] = useSearchParams()
  const [kind, setKind] = useState(params.get('kind') === 'delay' ? 'Delay' : 'Cannot deliver')
  const [revisedEta, setRevisedEta] = useState('')
  const [reason, setReason] = useState('Outlet closed')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File>()
  const [parked, setParked] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [saved, setSaved] = useState(false)
  const blocked =
    !state.data?.route.started ||
    !state.stop ||
    !['Upcoming', 'Arrived'].includes(state.stop.status) ||
    (!!state.record && state.record.status !== 'accepted')
  function reportIssue() {
    if (!state.stop || blocked) return
    const stopId = state.stop.id
    if (kind === 'Delay' || kind === 'Vehicle breakdown') {
      action.run(async () => {
        await apis.delivery.reportDelay(
          stopId,
          note,
          revisedEta || undefined,
          kind === 'Vehicle breakdown' ? 'breakdown' : 'delay',
        )
        setSaved(true)
        setConfirm(false)
      }, 'Issue saved locally')
    } else if (photo) {
      action.runAndNavigate(
        () => apis.delivery.saveAttemptProof(stopId, photo, `${reason}: ${note}`),
        state.href('/driver/sync'),
        'Issue saved locally',
      )
    }
  }
  return {
    kind,
    revisedEta,
    setRevisedEta,
    setKind,
    reason,
    setReason,
    note,
    setNote,
    photo,
    setPhoto,
    parked,
    setParked,
    confirm,
    setConfirm,
    saved,
    setSaved,
    blocked,
    reportIssue,
    busy: action.isPending,
  }
}
