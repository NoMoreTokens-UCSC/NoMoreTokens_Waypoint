import { useState } from 'react'
import type { DriverStopState } from './useDriverData'
import { useApis } from '../../../providers/ApisContext'
import { useDriverAction } from './useDriverAction'

export function useDriverIssueForm(state: DriverStopState) {
  const apis = useApis(),
    action = useDriverAction()
  const [kind, setKind] = useState('Cannot deliver')
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
    if (kind === 'Delay') {
      action.run(async () => {
        await apis.delivery.reportDelay(stopId, note)
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
