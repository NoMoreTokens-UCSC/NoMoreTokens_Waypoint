import { resolveProductFrame } from '../../../design/presentationManifest'
import { loadSummary } from '../../../../domain/loadSummary'
import { ReceiverSignaturePad } from '../molecules/ReceiverSignaturePad'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { DesignControls } from '../../../design/DesignReferencePage'
import { ProductFrameView as DesignFrameView } from '../../../design/ProductFrameView'
import { allText, useDesignAssets, useDesignCatalog, useDesignFrame } from '../../../design/hooks'
import { runPrototypeAction, sourceActions } from '../../../design/prototype'
import { SourceOverlay } from '../../../design/SourceOverlay'
import type { Layer, PrototypeAction } from '../../../design/types'
import {
  useAction,
  useConnectivity,
  useEvidence,
  useOperations,
} from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'

export default function FigmaDriverPage() {
  const catalog = useDesignCatalog().data,
    assets = useDesignAssets().data
  const { data } = useOperations(),
    online = useConnectivity()
  const service = useServices(),
    mutation = useAction()
  const navigate = useNavigate(),
    location = useLocation()
  const [params] = useSearchParams()
  const [width, setWidth] = useState(window.innerWidth)
  const [overlay, setOverlay] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [receiver, setReceiver] = useState('Nimal Perera')
  const [exception, setException] = useState('')
  const [exceptionNote, setExceptionNote] = useState('')
  const [signature, setSignature] = useState<Blob>()
  const [attemptReason, setAttemptReason] = useState('Store closed')
  const [quantity, setQuantity] = useState<string>()
  const [photo, setPhoto] = useState<File | null>(null)
  const [notificationsRead, setNotificationsRead] = useState(false)
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : undefined), [photo])
  const photoInput = useRef<HTMLInputElement>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const avatar = useEvidence(data?.settings.profilePhotoId)
  const stop =
    data?.stops.find((stop) => stop.id === params.get('stop')) ??
    data?.stops.find((stop) => stop.status !== 'Delivered') ??
    data?.stops[0]
  const proof = useEvidence(stop?.proofId)
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    },
    [photoUrl],
  )
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const mobile = width < 768
  const recovery = location.pathname === '/recovery'
  const records = [...(data?.queue ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const queued = records.find((record) => record.status !== 'accepted')
  const selectedRecord = queued ?? records.at(-1)
  const recoveryEvidence = useEvidence(selectedRecord?.evidenceId)
  const recoveryId =
    queued?.status === 'review'
      ? '433:21882'
      : queued?.status === 'retry'
        ? '433:21951'
        : queued?.status === 'syncing'
          ? '433:21829'
          : queued
            ? '433:21778'
            : '433:21919'
  const defaults: Record<string, string> = {
    home: mobile ? '353:21235' : '352:21218',
    route: mobile ? '7:28' : width < 1200 ? '94:9310' : '94:9194',
    delivery: '7:29',
    issues: '72:791',
  }
  const requestedId = params.get('frame')
  const stateId = requestedId?.startsWith('433:')
    ? recoveryId
    : requestedId === '7:31' && stop?.status === 'Delivered'
      ? '7:33'
      : requestedId
  const frame = resolveProductFrame(
    catalog,
    stateId ?? (recovery ? recoveryId : defaults[location.pathname.split('/')[2] ?? 'home']),
    width,
  )
  const source = useDesignFrame(frame?.url).data
  const currentStopId = stop?.id
  useEffect(() => {
    if (frame?.id !== '72:797' || !currentStopId) return
    const timer = window.setTimeout(() => {
      navigate(`/driver/route?frame=7%3A28&stop=${currentStopId}`, { replace: true })
      window.scrollTo(0, 0)
    }, 1100)
    return () => window.clearTimeout(timer)
  }, [frame?.id, currentStopId, navigate])
  if (!catalog || !assets || !data || !stop || !frame) return <p>Opening driver workspace…</p>
  const values: Record<string, string> = { 'Receiver name': receiver, ...edits }
  function defaultsFrom(layer: Layer) {
    const field =
      layer.name === 'Field'
        ? layer.children?.find((child) => child.name === 'Label')?.characters
        : layer.name.startsWith('Field/')
          ? layer.name.slice(6)
          : undefined
    if (field) {
      const input = layer.children?.find((child) => child.name === 'InputContainer')
      if (input) values[field] ??= allText(input)
    }
    layer.children?.forEach(defaultsFrom)
  }
  if (source) defaultsFrom(source)
  const cases = Number(quantity ?? stop.cases)
  function go(id: string, stopId = stop!.id) {
    setOverlay(null)
    navigate(`/driver/route?frame=${encodeURIComponent(id)}&stop=${stopId}`)
    window.scrollTo(0, 0)
  }
  function action(action: PrototypeAction) {
    if (action.type === 'CLOSE') {
      setOverlay(null)
      return
    }
    if (action.type === 'BACK') {
      navigate(-1)
      return
    }
    if (action.destinationId === '7:6') {
      navigate('/workspaces')
      return
    }
    const target = catalog?.frames.find((frame) => frame.id === action.destinationId)
    if (action.navigation === 'OVERLAY' || action.navigation === 'SWAP') {
      setOverlay(action.destinationId ?? null)
      return
    }
    if (target?.section === 'driver') go(target.id)
    if (action.destinationId === '438:154') navigate('/recovery/review')
  }
  function transition(layer: Layer) {
    runPrototypeAction(
      sourceActions(
        catalog!.frames.flatMap((frame) => frame.interactions),
        layer.id,
      ),
      action,
    )
  }
  function sync() {
    mutation.run(async () => {
      await service.sync(online)
      const current = await service.repository.getSnapshot()
      const record = current.queue.find((record) => record.status !== 'accepted')
      go(
        record?.status === 'review'
          ? '433:21882'
          : record?.status === 'retry'
            ? '433:21951'
            : record
              ? '433:21778'
              : '433:21919',
      )
    })
  }
  function submit(local = false) {
    if (!photo) {
      toast.error('Capture or select the delivery photograph first.')
      return
    }
    mutation.run(async () => {
      await service.saveDeliveryProof(
        stop!.id,
        photo,
        cases,
        receiver,
        exception === 'Other' ? `Other: ${exceptionNote.trim()}` : exception,
        signature,
      )
      setPhoto(null)
      if (local || !online || data!.settings.simulatedOffline) go('7:31')
      else {
        go('7:32')
        await service.sync(online)
        const current = await service.repository.getSnapshot()
        const record = current.queue.find(
          (record) => record.stopId === stop!.id && record.status !== 'accepted',
        )
        go(
          record?.status === 'review'
            ? '433:21882'
            : record?.status === 'retry'
              ? '433:21951'
              : record
                ? '7:31'
                : '7:33',
        )
      }
    })
  }
  function activate(layer: Layer) {
    const label = allText(layer).trim()
    if (mutation.isPending) return true
    if (label === 'Record delivery photo') {
      if (!data!.settings.routeStarted) go('353:21400')
      else if (stop!.status === 'Upcoming')
        mutation.run(async () => {
          await service.arrive(stop!.id)
          go('41:993')
        })
      else if (stop!.status === 'Proof pending') go('7:31')
      else go('322:20998')
      return true
    }
    if (label === 'Change photo') {
      avatarInput.current?.click()
      return true
    }
    if (layer.name === 'MenuButton') {
      setOverlay('353:21287')
      return true
    }
    if (layer.name === 'QueueItem/Delivery photo') {
      setOverlay('207:21017')
      return true
    }
    if (/^(Action|MenuItem)\/Sign out/.test(layer.name)) {
      if (data!.queue.some((record) => record.status !== 'accepted')) go('355:21559')
      else navigate('/workspaces')
      return true
    }
    if (label === 'Start route') {
      go('353:21400')
      return true
    }
    if (label === 'Confirm and start route' || label === 'Collect & start route') {
      mutation.run(async () => {
        if (!data!.settings.routeStarted) await service.startRoute()
        go('41:992')
      })
      return true
    }
    if (/Confirm I.ve parked|Arrived · record delivery/.test(label)) {
      mutation.run(async () => {
        if (stop!.status === 'Upcoming') await service.arrive(stop!.id)
        go('41:993')
      })
      return true
    }
    if (label === 'Complete Delivery') {
      go('322:20998')
      return true
    }
    if (label === 'Continue to photo') {
      if (!Number.isInteger(cases) || cases < 0 || cases > stop!.cases)
        toast.error('Confirm a valid delivered case count.')
      else go('7:30')
      return true
    }
    if (/Capture photo|Try camera again/.test(label)) {
      photoInput.current?.click()
      return true
    }
    if (label === 'Use this photo') {
      if (!photo) toast.error('Select a delivery photograph first.')
      else go('322:21048')
      return true
    }
    if (/Retake/.test(label)) {
      setPhoto(null)
      go('7:30')
      return true
    }
    if (label === 'Receiver can’t sign') {
      setException('Receiver unavailable')
      setExceptionNote('')
      go('322:21095')
      return true
    }
    if (layer.name.startsWith('ReasonRow/')) {
      if (frame!.id === '322:21095') setException(layer.name.slice(10))
      else setAttemptReason(layer.name.slice(10))
      return true
    }
    if (label === 'Continue to review') {
      if (frame!.id === '322:21095' && !exception)
        toast.error('Select why the receiver cannot sign.')
      else if (exception === 'Other' && exceptionNote.trim().length < 3)
        toast.error('Add a short note explaining the missing signature.')
      else if (receiver.trim().length < 2 && !exception)
        toast.error('Enter the receiver name or record an exception.')
      else go('322:21151')
      return true
    }
    if (label === 'Back to signature') {
      setException('')
      go('322:21048')
      return true
    }
    if (label === 'Edit details') {
      go('322:20998')
      return true
    }
    if (label === 'Submit proof') {
      submit()
      return true
    }
    if (label === 'Submit delivery proof') {
      if (!photo) toast.error('Choose a delivery photograph first.')
      else setOverlay('118:17739')
      return true
    }
    if (label === 'Save with photo offline') {
      submit(true)
      return true
    }
    if (/Connection restored · upload|Retry upload|Retry now|Upload now/.test(label)) {
      sync()
      return true
    }
    if (label === 'Review updated route') {
      navigate('/recovery/review')
      return true
    }
    if (/Continue to (next stop|Stop 2)/.test(label)) {
      if (recovery && !selectedRecord) {
        go(defaults.route)
        return true
      }
      const next = data!.stops.find((next) => next.status !== 'Delivered' && next.id !== stop!.id)
      if (next) {
        setQuantity(undefined)
        setReceiver('Nimal Perera')
        setException('')
        go('7:29', next.id)
      } else go('355:21435')
      return true
    }
    if (label === 'View delivery photo') {
      setOverlay('207:21017')
      return true
    }
    if (label === 'Keep working' || label === 'Stay signed in') {
      go('7:28')
      return true
    }
    if (/Something is wrong/.test(label)) {
      go('355:21379')
      return true
    }
    if (/Continue to proof ·/.test(label)) {
      setQuantity(String(Math.max(0, stop!.cases - 2)))
      setException('Receiver rejected two damaged cases.')
      go('7:30')
      return true
    }
    if (label === 'Continue' && frame!.id === '317:20878') {
      go('317:20938')
      photoInput.current?.click()
      return true
    }
    if (label === 'Save attempt') {
      if (!photo) {
        toast.error('Choose a photograph showing the delivery attempt.')
        photoInput.current?.click()
        return true
      }
      mutation.run(async () => {
        await service.saveAttemptProof(stop!.id, photo, attemptReason)
        setPhoto(null)
        go('317:21012')
      })
      return true
    }
    if (/Send to dispatch|Send request|Save changes/.test(label)) {
      const note = Object.values(values).filter(Boolean).join(' · ')
      if (label === 'Save changes')
        mutation.run(async () => {
          await service.updateSettings({
            profileName: values['Full name'] ?? data!.settings.profileName,
            profilePhone: edits['Mobile number'] ?? data!.settings.profilePhone,
            profileLanguage: edits.Language ?? data!.settings.profileLanguage ?? 'English',
            emergencyContact: edits['Emergency contact'] ?? data!.settings.emergencyContact,
          })
          transition(layer)
        })
      else
        mutation.run(async () => {
          if (label === 'Send request')
            await service.requestAccountChange(
              data!.activeDriverId ?? 'USR001',
              note || 'Requested account change',
            )
          else await service.reportDeliveryIssue(stop!.id, note || label)
          transition(layer)
        })
      return true
    }
    if (label === 'Mark all as read') {
      mutation.run(async () => {
        await service.updateSettings({ notificationsReadAt: new Date().toISOString() })
        setNotificationsRead(true)
      })
      return true
    }
    return false
  }
  const saved = recovery ? recoveryEvidence.evidence : proof.evidence
  const savedStop = data.stops.find((item) => item.id === saved?.entityId) ?? stop
  const savedTime = saved
    ? new Date(saved.createdAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Colombo',
      })
    : ''
  const fileSize = saved
    ? saved.photo.size < 1024 * 1024
      ? `${Math.max(1, Math.round(saved.photo.size / 1024))} KB`
      : `${(saved.photo.size / (1024 * 1024)).toFixed(1)} MB`
    : ''
  const savedPhoto =
    recovery || overlay === '207:21017'
      ? (recoveryEvidence.url ?? proof.url)
      : (photoUrl ?? proof.url)
  const controls: DesignControls = {
    hidden: (layer) =>
      recovery &&
      !selectedRecord &&
      /^(QueueItem\/|Record\/|Acceptance|Confirmation|Receipts$)/.test(layer.name),
    imageLabel: (layer) =>
      layer.fills.some((fill) => fill.type === 'IMAGE') && savedPhoto
        ? 'Saved delivery photograph'
        : undefined,
    busy: mutation.isPending,
    values,
    change: (field, value) => {
      if (field === 'Receiver name') {
        setReceiver(value)
        setSignature(undefined)
      } else setEdits((current) => ({ ...current, [field]: value }))
    },
    activate,
    isInteractive: (layer) =>
      allText(layer) === 'Change photo' ||
      layer.name.startsWith('Action/') ||
      layer.name.startsWith('ReasonRow/') ||
      layer.name === 'QueueItem/Delivery photo',
    asset: (layer) =>
      overlay === '207:21017' && /ProofPreview/.test(layer.name)
        ? (recoveryEvidence.url ?? proof.url)
        : undefined,
    context: (layer, scope) =>
      layer.name.startsWith('ReasonRow/')
        ? `reason:${layer.name.slice(10)}`
        : layer.name.startsWith('Input/')
          ? `profile:${layer.name.slice(6)}`
          : layer.name === 'QuantityCard'
            ? 'quantity'
            : scope,
    replace: (layer, scope) =>
      layer.name === 'Radio' && scope?.startsWith('reason:') ? (
        <>
          {scope.slice(7) === (frame.id === '322:21095' ? exception : attemptReason) && (
            <span
              style={{
                position: 'absolute',
                left: 6,
                top: 6,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#f26a2e',
              }}
            />
          )}
        </>
      ) : layer.characters === 'Add a short note' && exception === 'Other' ? (
        <input
          aria-label="Missing signature note"
          value={exceptionNote}
          onChange={(event) => setExceptionNote(event.target.value)}
          placeholder="Add a short note"
          className="figma-native-input"
          style={{ width: '100%', height: '100%', padding: 0, fontSize: 'inherit' }}
        />
      ) : avatar.url &&
        (layer.name === 'Avatar' || (!layer.characters && allText(layer) === 'SB')) ? (
        <img
          src={avatar.url}
          alt="Saved profile photograph"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : layer.name === 'SignaturePad' ? (
        <ReceiverSignaturePad
          key={receiver}
          initial={receiver === 'Nimal Perera' ? assets.vectors['322-21086'] : undefined}
          onChange={setSignature}
        />
      ) : ['367:21383', '367:21457'].includes(frame.id) &&
        scope?.startsWith('profile:') &&
        layer.type === 'TEXT' &&
        /^(\+94|English$|Dilani Bandara)/.test(layer.characters ?? '') ? (
        <input
          aria-label={scope.slice(8)}
          value={
            edits[scope.slice(8)] ??
            (scope.slice(8) === 'Mobile number'
              ? data.settings.profilePhone
              : scope.slice(8) === 'Language'
                ? (data.settings.profileLanguage ?? 'English')
                : (data.settings.emergencyContact ?? layer.characters ?? ''))
          }
          onChange={(event) =>
            setEdits((current) => ({ ...current, [scope.slice(8)]: event.target.value }))
          }
          className="figma-native-input"
          style={{
            width: '100%',
            height: '100%',
            padding: 0,
            fontSize: 'inherit',
            lineHeight: 'inherit',
            background: 'transparent',
          }}
        />
      ) : scope === 'quantity' && layer.type === 'TEXT' && /^\d+$/.test(layer.characters ?? '') ? (
        <input
          type="number"
          min={0}
          max={stop.cases}
          step={1}
          aria-label="Cases delivered"
          value={quantity ?? stop.cases}
          onChange={(event) => setQuantity(event.target.value)}
          className="figma-native-input"
          style={{
            width: '100%',
            height: '100%',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            fontWeight: 'inherit',
            background: 'transparent',
            padding: 0,
          }}
        />
      ) : undefined,
    style: (layer, scope) =>
      layer.name === 'Radio' && scope?.startsWith('reason:')
        ? {
            outlineColor:
              scope.slice(7) === (frame.id === '322:21095' ? exception : attemptReason)
                ? '#f26a2e'
                : 'rgba(61,66,74,.22)',
          }
        : layer.fills.some((fill) => fill.type === 'IMAGE') &&
            (/photo|proof|handoff|evidence/i.test(frame.name) || overlay === '207:21017') &&
            savedPhoto
          ? {
              backgroundImage: `url("${savedPhoto}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined,
    text: (layer) => {
      const original = layer.characters
      if (!original) return undefined
      if (['94:9194', '94:9310'].includes(frame.id)) {
        if (original === 'Record delivery photo')
          return !data.settings.routeStarted
            ? 'Collect & start route'
            : stop.status === 'Upcoming'
              ? 'Confirm I’ve parked'
              : stop.status === 'Proof pending'
                ? 'View saved proof'
                : 'Complete Delivery'
        if (layer.name === 'Heading' && original === 'Your next delivery')
          return data.settings.routeStarted ? 'Your next delivery' : 'Collect your next load'
        if (original === 'Arrived · OUT001')
          return !data.settings.routeStarted
            ? 'Ready at Peliyagoda'
            : `${stop.status === 'Upcoming' ? 'On route' : 'Arrived'} · ${stop.outlet}`
        if (layer.name === 'Arrival')
          return `${stop.status === 'Upcoming' ? 'Expected' : 'Arrived'} ${stop.eta} · ${stop.cases} cases`
        if (layer.name === 'LocationStatus')
          return `${stop.outlet} · ${data.settings.routeStarted ? stop.status : 'Ready to collect'}`
      }
      if (/^32 cases \u00b7 210 kg \u00b7/.test(original)) {
        const summary = loadSummary(data, data.loads[0])
        return `${summary.cases} cases \u00b7 ${summary.weight} kg \u00b7 ${summary.volume.toFixed(1)} m³`
      }
      if (recovery) {
        if (original === '3 saved') return selectedRecord ? '3 saved' : '0 saved'
        if (original === 'All synced \u00b7 3 of 3')
          return `All synced \u00b7 ${records.filter((record) => record.status === 'accepted').length * 3} of ${records.length * 3}`
        if (!selectedRecord && original === 'Continue to Stop 2') return 'Back to current route'
        if (!selectedRecord && original === 'Stop 1 delivered.') return 'No saved records.'
        if (!selectedRecord && /^ORD1042/.test(original))
          return 'Saved delivery records will appear here.'
        if (saved) {
          if (/^ORD1042 \u00b7 1\.2 MB/.test(original))
            return `${savedStop.orderIds[0]} \u00b7 ${fileSize} \u00b7 ${savedTime}`
          if (/^18 of 18 cases \u00b7/.test(original))
            return `${saved.quantity ?? 0} of ${savedStop.cases} cases \u00b7 ${savedTime}`
          if (/^Nimal Perera \u00b7/.test(original))
            return `${saved.receiver ?? saved.receiverException ?? 'Acknowledgment pending'} \u00b7 ${savedTime}`
          if (/^Uploading \u00b7/.test(original)) return `Uploading \u00b7 ${fileSize}`
          if (/^Try \d+ of 5$/.test(original)) return `Try ${selectedRecord?.attempts ?? 0} of 5`
          if (/^Accepted \d/.test(original) && !saved.accepted) return 'Saved locally'
          if (original === 'Synced' && !saved.accepted) return 'Pending'
          if (/^ORD1042 \u00b7 18 of 18 cases\./.test(original))
            return `${savedStop.orderIds[0]} \u00b7 ${saved.quantity ?? 0} of ${savedStop.cases} cases. Photo accepted.`
        }
      }
      if (frame.id === '7:31' && layer.name === 'Detail' && saved)
        return `${savedStop.orderIds[0]} \u00b7 ${saved.quantity ?? 0} cases\n1 photo attached \u00b7 ${savedTime}`
      if (original === 'Sanjeewa Bandara') return data.settings.profileName
      if (original === 'SB')
        return data.settings.profileName
          .split(' ')
          .map((part) => part[0])
          .slice(0, 2)
          .join('')
      if (original === 'Nimal Perera' && /review|sign-off/i.test(frame.name))
        return exception === 'Other' ? `Other: ${exceptionNote}` : exception || receiver
      if (/^\d+ of \d+ cases$/.test(original)) return `${cases} of ${stop.cases} cases`
      if (/^of \d+ ordered$/.test(original)) return `of ${stop.cases} ordered`
      if (/^Received in full ·/.test(original))
        return cases === stop.cases
          ? `Received in full · ${cases} of ${stop.cases}`
          : `Quantity difference · ${cases} of ${stop.cases}`
      if (/^\d+ of \d+ cases · photo proof/.test(original))
        return `${cases} of ${stop.cases} cases · photo proof · ${exception ? exception : `signed by ${receiver}`}`
      if (/OUT001/.test(original) && stop.outlet !== 'OUT001')
        return original
          .replaceAll('OUT001', stop.outlet)
          .replaceAll('ORD1042', stop.orderIds[0] ?? '')
      if (/^\+94 76 330 9187/.test(original)) return data.settings.profilePhone
      if (original === 'English' && data.settings.profileLanguage)
        return data.settings.profileLanguage
      if (/^Dilani Bandara/.test(original) && data.settings.emergencyContact)
        return data.settings.emergencyContact
      if (
        /Notifications · 2 new/.test(original) &&
        (notificationsRead || data.settings.notificationsReadAt)
      )
        return 'Notifications'
      if (original === 'Collect & start route' && data.settings.routeStarted)
        return 'Resume navigation'
      return undefined
    },
    label: (layer) =>
      allText(layer) === 'Record delivery photo'
        ? !data.settings.routeStarted
          ? 'Collect & start route'
          : stop.status === 'Upcoming'
            ? 'Confirm I’ve parked'
            : stop.status === 'Proof pending'
              ? 'View saved proof'
              : 'Complete Delivery'
        : recovery && !selectedRecord && allText(layer) === 'Continue to Stop 2'
          ? 'Back to current route'
          : allText(layer) === 'Collect & start route' && data.settings.routeStarted
            ? 'Resume navigation'
            : undefined,
  }
  return (
    <main
      className="figma-entry"

      aria-busy={mutation.isPending}
    >
      <input
        ref={avatarInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        aria-label="Profile photograph"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) mutation.run(() => service.saveProfilePhoto(file))
          event.target.value = ''
        }}
      />
      <input
        ref={photoInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label="Delivery photograph"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            setPhoto(file)
            if (frame.id !== '317:20938') go('72:793')
          }
          event.target.value = ''
        }}
      />
      <div>
        <DesignFrameView
          id={frame.id}
          catalog={catalog}
          assets={assets}
          onAction={action}
          controls={controls}
        />
      </div>
      {overlay && (
        <SourceOverlay
          title={catalog.frames.find((frame) => frame.id === overlay)?.name ?? 'Driver'}
          placement={['353:21287', '115:17508'].includes(overlay) ? 'menu' : 'center'}
          close={() => setOverlay(null)}
        >
          <DesignFrameView
            id={overlay}
            catalog={catalog}
            assets={assets}
            onAction={action}
            controls={controls}
          />
        </SourceOverlay>
      )}
    </main>
  )
}
