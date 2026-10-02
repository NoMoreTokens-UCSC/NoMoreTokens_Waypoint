import { loadSummary } from '../../../../domain/loadSummary'
import { loaderFrames, responsiveFrame } from '../../../design/presentationManifest'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { loadErrors } from '../../../../domain/rules'
import type { Load } from '../../../../domain/models'
import { AccountOverlay } from '../../../design/AccountOverlay'
import { SourceOverlay } from '../../../design/SourceOverlay'
import { runPrototypeAction, sourceActions } from '../../../design/prototype'
import type { DesignControls } from '../../../design/DesignReferencePage'
import { ProductFrameView as DesignFrameView } from '../../../design/ProductFrameView'
import { allText, useDesignAssets, useDesignCatalog, useDesignFrame } from '../../../design/hooks'
import type { Layer, PrototypeAction } from '../../../design/types'
import { useAction, useEvidence, useOperations } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'

export default function FigmaLoaderPage() {
  const catalog = useDesignCatalog().data,
    assets = useDesignAssets().data
  const { data } = useOperations()
  const service = useServices(),
    mutation = useAction()
  const navigate = useNavigate(),
    location = useLocation()
  const [params] = useSearchParams()
  const [width, setWidth] = useState(window.innerWidth)
  const [overlay, setOverlay] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [photo, setPhoto] = useState<File | null>(null)
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : undefined), [photo])
  const fileInput = useRef<HTMLInputElement>(null)
  const load = data?.loads[0]
  const persisted = useEvidence(load?.photoId)
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    },
    [photoUrl],
  )
  const viewport = width < 768 ? 'mobile' : width < 1200 ? 'tablet' : 'desktop'
  const defaultId = location.pathname.endsWith('/queue')
    ? viewport === 'desktop'
      ? '2079:22982'
      : viewport === 'tablet'
        ? '311:20855'
        : '311:20806'
    : viewport === 'desktop'
      ? '2079:23127'
      : viewport === 'tablet'
        ? '300:20925'
        : '300:20510'
  const selectedFrame = responsiveFrame(params.get('frame') ?? defaultId, viewport, loaderFrames)
  const frame = catalog?.frames.find((frame) => frame.id === selectedFrame)
  const source = useDesignFrame(frame?.url).data
  if (!catalog || !assets || !data || !load || !frame) return <p>Opening loading workspace…</p>
  const values = { ...fields }
  function fieldsFrom(layer: Layer) {
    if (layer.name.startsWith('Field/')) {
      const input = layer.children?.find((child) => child.name === 'InputContainer')
      values[layer.name.slice(6)] ??= input ? allText(input) : ''
    }
    layer.children?.forEach(fieldsFrom)
  }
  if (source) fieldsFrom(source)
  function go(id: string) {
    navigate(`/loader/loading?frame=${encodeURIComponent(id)}`)
    setOverlay(null)
    window.scrollTo(0, 0)
  }
  function family(desktop: string, tablet: string, mobile: string) {
    return viewport === 'desktop' ? desktop : viewport === 'tablet' ? tablet : mobile
  }
  function reviewPhoto() {
    go(family(load!.revision > 3 ? '2079:25741' : '2079:23897', '72:802', '95:9355'))
  }
  function onAction(action: PrototypeAction) {
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
    if (target?.section === 'entry-account') {
      setOverlay(target.id)
      return
    }
    if (target?.section === 'loader') go(target.id)
  }
  function transition(layer: Layer) {
    runPrototypeAction(
      sourceActions(
        catalog!.frames.flatMap((frame) => frame.interactions),
        layer.id,
      ),
      onAction,
    )
  }
  function safetyKey(layer: Layer): keyof Load['checks'] | undefined {
    const text = allText(layer)
    return /refrigeration working/i.test(text)
      ? 'refrigeration'
      : /goods condition/i.test(text)
        ? 'condition'
        : /restraints secured/i.test(text)
          ? 'restraints'
          : undefined
  }
  function activate(layer: Layer) {
    const label = allText(layer)
    if (mutation.isPending) return true
    if (label === 'Confirm OUT001 quantities') {
      transition(layer)
      return true
    }
    if (
      /Open VEH055|Open loading manifest|Open loading sequence/.test(label) &&
      !data?.settings.published
    ) {
      toast('The Dispatcher must publish the loading manifest first.')
      return true
    }
    if (/Confirm OUT008|Confirm OUT001|Confirm all \d+ loaded|Confirm replacement/.test(label)) {
      if (!data?.settings.published) {
        toast('Publish the manifest before loading.')
        return true
      }
      const outlet = /OUT008/.test(label) ? 'OUT008' : 'OUT001'
      const item = load!.items.find((item) => item.outlet === outlet)
      if (item)
        mutation.run(async () => {
          await service.setLoaded(load!.id, outlet, item.expected)
          if (outlet === 'OUT008') go(family('2079:23242', '300:21004', '300:20588'))
          else
            go(
              family(
                load!.revision > 3 ? '2079:25215' : '2079:23472',
                load!.revision > 3 ? '318:21185' : '318:21106',
                load!.revision > 3 ? '318:21028' : '318:20950',
              ),
            )
        })
      return true
    }
    const key = layer.name.startsWith('Check/') ? safetyKey(layer) : undefined
    if (key) {
      mutation.run(async () => {
        await service.setCheck(load!.id, key, true)
        transition(layer)
      })
      return true
    }
    if (/Confirm all safety checks/.test(label)) {
      mutation.run(async () => {
        for (const key of ['refrigeration', 'condition', 'restraints'] as const)
          await service.setCheck(load!.id, key, true)
        go(family(load!.revision > 3 ? '2079:25322' : '2079:23579', '309:20860', '309:20782'))
      })
      return true
    }
    if (/Take loading photo|Capture photo|Try camera again/.test(label)) {
      const error = loadErrors(load!, false)[0]
      if (error) toast.error(error)
      else if (
        label === 'Take loading photo' &&
        viewport !== 'desktop' &&
        !/camera/i.test(frame!.name)
      )
        go(family('2079:23686', '72:801', '95:9328'))
      else fileInput.current?.click()
      return true
    }
    if (/Use this photo/.test(label)) {
      if (!photo) {
        toast.error('Choose a loading photograph first.')
        return true
      }
      mutation.run(async () => {
        await service.attachLoadingPhoto(load!.id, photo)
        setPhoto(null)
        go(family(load!.revision > 3 ? '2079:25845' : '2079:24001', '72:803', '95:9370'))
      })
      return true
    }
    if (/Retake|Replace photo/.test(label)) {
      setPhoto(null)
      transition(layer)
      return true
    }
    if (/Refresh photo status|Retry after phone upload|Photo attached\? Refresh/.test(label)) {
      if (load!.photoId)
        go(family(load!.revision > 3 ? '2079:25845' : '2079:24001', '72:803', '95:9370'))
      else go(family(load!.revision > 3 ? '2079:26264' : '2079:26157', '72:804', '300:20882'))
      return true
    }
    if (/Open VEH055 on phone|Open same trip on phone/.test(label)) {
      go('95:9328')
      return true
    }
    if (/Mark loading complete|Confirm loading complete/.test(label)) {
      if (viewport === 'desktop' || /Confirm loading complete/.test(label))
        mutation.run(async () => {
          await service.completeLoading(load!.id)
          go(family(load!.revision > 3 ? '2079:26053' : '2079:24209', '10:358', '95:9389'))
        })
      else {
        const error = loadErrors(load!)[0]
        if (error) toast.error(error)
        else setOverlay(viewport === 'tablet' ? '118:17749' : '118:17759')
      }
      return true
    }
    if (/Save issue & hold load|Report damage & hold load/.test(label)) {
      const issue =
        Object.entries(values)
          .filter(([key]) => /detail|description|note|happened/i.test(key))
          .map(([, value]) => value)
          .join(' ') ||
        `${/damag/i.test(frame!.name) ? 'Damaged' : 'Missing'} milk case · OUT001 · 1 case`
      mutation.run(async () => {
        await service.reportLoadIssue(load!.id, issue)
        transition(layer)
      })
      return true
    }
    if (
      /Review changed instructions|Review revision 04|View Dispatcher decision/.test(label) &&
      load!.issue &&
      !load!.issueResolved
    ) {
      toast(
        'This load is held. Record the Dispatcher decision in the demo controls before resuming.',
      )
      return true
    }
    if (/Acknowledge & resume/.test(label) && !load!.issueResolved) {
      toast.error('The revised manifest has not been issued yet.')
      return true
    }
    return false
  }
  const controls: DesignControls = {
    imageLabel: (layer) =>
      layer.fills.some((fill) => fill.type === 'IMAGE') && (photoUrl || persisted.url)
        ? 'Loading photograph'
        : undefined,
    busy: mutation.isPending,
    values,
    change: (field, value) => setFields((current) => ({ ...current, [field]: value })),
    activate,
    isInteractive: (layer) => layer.name.startsWith('Check/') && !!safetyKey(layer),
    context: (layer, scope) => (/^LoadedStop\//.test(layer.name) ? layer.name.slice(11) : scope),
    style: (layer) =>
      layer.fills.some((fill) => fill.type === 'IMAGE') &&
      /review|proof|photo attached/i.test(frame.name) &&
      (photoUrl || persisted.url)
        ? {
            backgroundImage: `url("${photoUrl ?? persisted.url}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : undefined,
    text: (layer, scope) => {
      const original = layer.characters
      if (!original) return undefined
      const total = load.items.reduce((sum, item) => sum + item.expected, 0),
        loaded = load.items.reduce((sum, item) => sum + item.loaded, 0)
      const summary = loadSummary(data, load)
      if (/^\d+ cases \u00b7 \d+ kg \u00b7/.test(original))
        return `${summary.cases} cases \u00b7 ${summary.weight} kg \u00b7 ${summary.volume.toFixed(1)} m³`
      if (/^Volume \u00b7/.test(original))
        return `Volume \u00b7 ${summary.volume.toFixed(1)} / ${(summary.vehicle?.volumeCapacity ?? 0).toFixed(1)} m³ used`
      if (/^Weight \u00b7/.test(original))
        return `Weight \u00b7 ${summary.weight} / ${summary.vehicle?.weightCapacity ?? 0} kg used`
      if (/^\d+ \/ \d+ cases loaded$/.test(original)) return `${loaded} / ${total} cases loaded`
      const item = load.items.find((item) => item.outlet === scope)
      if (item && /^\d+ \/ \d+( cases)?$/.test(original))
        return `${item.loaded} / ${item.expected}${original.endsWith(' cases') ? ' cases' : ''}`
      if (/Revision 0[34]/.test(original))
        return original.replace(
          /Revision 0[34]/g,
          `Revision ${String(load.revision).padStart(2, '0')}`,
        )
      return undefined
    },
  }
  return (
    <main
      className="figma-entry"

      aria-busy={mutation.isPending}
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label="Loading photograph"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            setPhoto(file)
            reviewPhoto()
          }
          event.target.value = ''
        }}
      />
      <div>
        <DesignFrameView
          id={frame.id}
          catalog={catalog}
          assets={assets}
          onAction={onAction}
          controls={controls}
        />
      </div>
      {overlay && catalog.frames.find((frame) => frame.id === overlay)?.section === 'loader' ? (
        <SourceOverlay title="Confirm loading complete" close={() => setOverlay(null)}>
          <DesignFrameView
            id={overlay}
            catalog={catalog}
            assets={assets}
            onAction={onAction}
            controls={controls}
          />
        </SourceOverlay>
      ) : (
        overlay && (
          <AccountOverlay
            id={overlay}
            catalog={catalog}
            assets={assets}
            change={setOverlay}
            close={() => setOverlay(null)}
            reviewPath="/loader/queue"
          />
        )
      )}
    </main>
  )
}
