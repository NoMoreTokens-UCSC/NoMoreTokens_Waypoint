import { AccountOverlay } from '../../../design/AccountOverlay'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ProductFrameView as DesignFrameView } from '../../../design/ProductFrameView'
import { allText, useDesignAssets, useDesignCatalog, useDesignFrame } from '../../../design/hooks'
import type { Layer, PrototypeAction } from '../../../design/types'
import { useAction, useEvidence, useOperations } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'
import type { StoreOrderInput } from '../../../../domain/models'

export default function FigmaStorePage() {
  const catalog = useDesignCatalog().data
  const assets = useDesignAssets().data
  const { data } = useOperations()
  const service = useServices()
  const mutation = useAction()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [width, setWidth] = useState(window.innerWidth)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [overlay, setOverlay] = useState<string | null>(null)
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const viewport = width < 768 ? 'mobile' : width < 1200 ? 'tablet' : 'desktop'
  const defaultName = location.pathname.endsWith('/deliveries')
    ? 'Live tracking'
    : location.pathname.endsWith('/alerts')
      ? 'Acknowledgment required'
      : 'Order placement'
  const initial = catalog?.frames.find(
    (frame) =>
      frame.section === 'store-manager' &&
      frame.viewport === viewport &&
      frame.name.includes(defaultName),
  )
  const requested = catalog?.frames.find((frame) => frame.id === params.get('frame'))
  const familyName = requested?.name.split(' · ').slice(1).join(' · ')
  const variant =
    requested &&
    catalog?.frames.find(
      (frame) =>
        frame.section === 'store-manager' &&
        frame.viewport === viewport &&
        frame.name.split(' · ').slice(1).join(' · ') === familyName,
    )
  const frame = variant ?? requested ?? initial
  const source = useDesignFrame(frame?.url).data
  const proof = useEvidence(data?.stops.find((stop) => stop.outlet === 'OUT001')?.proofId)
  if (!catalog || !assets || !data || !frame) return <p>Opening your store…</p>
  const orders = data.orders.filter((order) => order.outlet === 'OUT001')
  const values: Record<string, string> = {}
  for (const scope of ['chilled', 'dry']) {
    const order = orders.find(
      (order) => order.temperature === (scope === 'chilled' ? 'Chilled' : 'Ambient'),
    )
    if (!order) continue
    values[`${scope}:Cases`] = String(order.cases)
    values[`${scope}:Weight · kg`] = String(order.weight)
    values[`${scope}:Volume · m³`] = String(order.volume)
    values[`${scope}:Receiving window`] =
      `${order.window}–${scope === 'chilled' ? '07:30' : '08:00'}`
  }
  function defaults(layer: Layer) {
    if (layer.name.startsWith('Field/')) {
      const input = layer.children?.find((child) => child.name === 'InputContainer')
      if (input) values[layer.name.slice(6)] ??= allText(input)
    }
    layer.children?.forEach(defaults)
  }
  if (source) defaults(source)
  Object.assign(values, edits)
  const inputs: StoreOrderInput[] = ['chilled', 'dry'].map((scope) => ({
    temperature: scope === 'chilled' ? 'Chilled' : 'Ambient',
    cases: Number(values[`${scope}:Cases`]),
    weight: Number(values[`${scope}:Weight · kg`]),
    volume: Number(values[`${scope}:Volume · m³`]),
    window: values[`${scope}:Receiving window`]?.slice(0, 5) ?? '',
  }))
  function showFrame(id: string) {
    if (catalog?.frames.find((frame) => frame.id === id)?.section === 'store-manager') {
      setOverlay(null)
      navigate(`${location.pathname}?frame=${encodeURIComponent(id)}`)
      window.scrollTo(0, 0)
    }
  }
  function targetFamily(name: string) {
    return catalog?.frames.find(
      (frame) =>
        frame.section === 'store-manager' &&
        frame.viewport === viewport &&
        frame.name.includes(name),
    )?.id
  }
  function onAction(action: PrototypeAction) {
    if (action.type === 'CLOSE') {
      setOverlay(null)
      return
    }
    if (action.destinationId === '7:6') {
      navigate('/workspaces')
      return
    }
    if (action.navigation === 'OVERLAY' || action.navigation === 'SWAP') {
      setOverlay(action.destinationId ?? null)
      return
    }
    const target = catalog?.frames.find((frame) => frame.id === action.destinationId)
    if (
      target?.name.includes('Delivered') &&
      !orders.some((order) => order.temperature === 'Chilled' && order.status === 'Delivered')
    ) {
      toast('Delivery proof is still awaiting acceptance.')
      return
    }
    if (target?.name.includes('Scheduled delivery') && !data?.settings.published) {
      toast('A scheduled delivery becomes available after the plan is published.')
      return
    }
    if (target?.name.includes('Create separate orders') && data?.settings.cutoffClosed) {
      const cutoff = targetFamily('Cutoff passed')
      if (cutoff) showFrame(cutoff)
      return
    }
    if (target?.section === 'store-manager') showFrame(target.id)
    else if (target?.section === 'entry-account') navigate('/workspaces')
  }
  function activate(layer: Layer) {
    const label = allText(layer)
    const sourceAction = frame?.interactions.find(
      (link) => link.source === layer.id && link.trigger?.type === 'ON_CLICK',
    )?.action
    if (/Confirm 2 orders/i.test(label)) {
      mutation.run(async () => {
        await service.confirmStoreOrders(inputs)
        setEdits({})
        if (sourceAction?.destinationId) showFrame(sourceAction.destinationId)
      })
      return true
    }
    if (/Confirm all .* cases received/i.test(label)) {
      const order = orders.find((order) => order.temperature === 'Chilled')
      if (order)
        mutation.run(async () => {
          await service.confirmReceipt(order.id)
          if (sourceAction?.destinationId) showFrame(sourceAction.destinationId)
        })
      return true
    }
    if (/Acknowledge deferral/i.test(label)) {
      const order = orders.find((order) => order.status === 'Deferred')
      if (!order) {
        toast('There is no deferred order awaiting acknowledgment.')
        return true
      }
      mutation.run(async () => {
        await service.acknowledgeDeferral(order.id)
        if (sourceAction?.destinationId) showFrame(sourceAction.destinationId)
      })
      return true
    }
    if (/Keep draft for/i.test(label)) {
      mutation.run(async () => {
        await service.saveStoreDrafts(inputs)
        if (sourceAction?.destinationId) showFrame(sourceAction.destinationId)
      })
      return true
    }
    if (/Submit (missing-item|damage) report/i.test(label)) {
      const order = orders.find((order) => order.temperature === 'Chilled')
      const description = Object.entries(values)
        .filter(([key]) => /detail|note|reason|description|what happened/i.test(key))
        .map(([, value]) => value)
        .join(' ')
      if (description.trim().length < 4) {
        toast.error('Describe the missing or damaged goods.')
        return true
      }
      if (order)
        mutation.run(async () => {
          await service.reportStoreReceipt(
            order.id,
            /damage/i.test(label) ? 'Damaged' : 'Missing',
            Number(values['Cases received · required']),
            Number(values[`${/damage/i.test(label) ? 'Damaged' : 'Missing'} cases · required`]),
            description,
          )
          if (sourceAction?.destinationId) showFrame(sourceAction.destinationId)
        })
      return true
    }
    return false
  }
  function text(layer: Layer, scope?: string) {
    if (!layer.characters) return undefined
    const input = inputs.find(
      (input) => input.temperature === (scope === 'chilled' ? 'Chilled' : 'Ambient'),
    )
    if (scope && input && /\d+ cases ·/.test(layer.characters))
      return `${input.cases} cases · ${input.weight} kg · ${input.volume} m³`
    if (scope && /^(Window )?\d\d:\d\d/.test(layer.characters))
      return `${layer.characters.startsWith('Window') ? 'Window ' : ''}${values[`${scope}:Receiving window`]}`
    if (/across two Fresh order records/.test(layer.characters))
      return `${inputs.reduce((sum, input) => sum + input.cases, 0)} cases · ${inputs.reduce((sum, input) => sum + input.weight, 0)} kg · ${Number(inputs.reduce((sum, input) => sum + input.volume, 0).toFixed(2))} m³ across two Fresh order records`
    return undefined
  }
  const controls = {
    asset: (layer: Layer) => (/^ProofPreview\//.test(layer.name) ? proof.url : undefined),
    busy: mutation.isPending,
    values,
    change: (field: string, value: string) =>
      setEdits((current) => ({ ...current, [field]: value })),
    activate,
    text,
  }
  return (
    <main className="figma-entry">
      <div aria-busy={mutation.isPending}>
        <DesignFrameView
          id={frame.id}
          catalog={catalog}
          assets={assets}
          onAction={onAction}
          controls={controls}
        />
      </div>
      {overlay && (
        <AccountOverlay
          id={overlay}
          catalog={catalog}
          assets={assets}
          change={setOverlay}
          close={() => setOverlay(null)}
          reviewPath="/store-manager/alerts"
          proofUrl={proof.url}
        />
      )}
    </main>
  )
}
