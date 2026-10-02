import { resolveProductFrame } from '../../../design/presentationManifest'
import { loadSummary } from '../../../../domain/loadSummary'
import { SourceOverlay } from '../../../design/SourceOverlay'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { allocationErrors, departureErrors } from '../../../../domain/rules'
import { AccountOverlay } from '../../../design/AccountOverlay'
import type { DesignControls } from '../../../design/DesignReferencePage'
import { ProductFrameView as DesignFrameView } from '../../../design/ProductFrameView'
import { allText, useDesignAssets, useDesignCatalog } from '../../../design/hooks'
import { runPrototypeAction, sourceActions } from '../../../design/prototype'
import type { Layer, PrototypeAction } from '../../../design/types'
import { useAction, useOperations } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'

const routes: Record<string, string> = {
  Orders: 'orders',
  Planning: 'planning',
  Deferrals: 'deferrals',
  Fleet: 'fleet',
  'Live tracking': 'tracking',
  Analytics: 'analytics',
}
export default function FigmaDispatcherPage() {
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
  const [search, setSearch] = useState('')
  const [orderId, setOrderId] = useState('ORD1065')
  const [vehicleId, setVehicleId] = useState('VEH001')
  const [trip, setTrip] = useState(1)
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const mobile = width < 768,
    tablet = width >= 768 && width < 1200
  const screen = location.pathname.split('/')[2] ?? 'orders'
  const defaultIds: Record<string, string> = {
    orders: mobile
      ? '101:9355'
      : tablet
        ? '104:15768'
        : data?.settings.cutoffClosed
          ? '137:17714'
          : '137:17712',
    planning: '7:7',
    deferrals: '7:9',
    review: '7:8',
    release: data?.loads[0]?.completed ? '137:17725' : '137:17724',
    fleet: mobile ? '101:13485' : tablet ? '104:16271' : '74:1309',
    tracking: '7:11',
    analytics: '7:12',
  }
  const frame = resolveProductFrame(catalog, params.get('frame') ?? defaultIds[screen], width)
  if (!catalog || !assets || !data || !frame) return <p>Opening dispatch workspace…</p>
  const allAllocated = data.orders.every((order) => order.vehicleId || order.status === 'Deferred')
  function go(id: string) {
    setOverlay(null)
    navigate(`${location.pathname}?frame=${encodeURIComponent(id)}`)
    window.scrollTo(0, 0)
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
    if (target?.section === 'dispatcher') go(target.id)
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
  function activate(layer: Layer, scope?: string) {
    const label = allText(layer).trim()
    if (mutation.isPending) return true
    if (/^(Vehicle|VehicleCard|Candidate)\/VEH/.test(layer.name)) {
      setVehicleId(layer.name.match(/VEH\d+/)?.[0] ?? 'VEH001')
      return false
    }
    if (/^Trip [12]$/.test(label)) {
      setTrip(Number(label.slice(-1)))
      return false
    }
    if (layer.name.startsWith('NavigationItem/')) {
      const route = routes[layer.name.slice(15)]
      if (route) navigate(`/dispatcher/${route}`)
      return true
    }
    if (/^(QueueRow|Order)\//.test(layer.name)) {
      setOrderId(layer.name.split('/')[1])
      transition(layer)
      return true
    }
    if (label === 'Refresh queue') {
      go(data!.settings.cutoffClosed ? '137:17714' : '137:17712')
      return true
    }
    if (label === 'Start allocation') {
      if (!data!.settings.cutoffClosed) {
        toast.error('The order cutoff has not passed.')
        return true
      }
      mutation.run(async () => {
        await service.autoAllocate()
        go('431:21687')
      })
      return true
    }
    if (/^Assign to Trip 1$|^Assign order$/.test(label)) {
      const id = scope?.startsWith('order:') ? scope.slice(6) : orderId
      mutation.run(async () => {
        await service.allocate(id, vehicleId, trip)
        transition(layer)
      })
      return true
    }
    if (/^Undo assignment$|^Remove allocation$/.test(label)) {
      mutation.run(async () => {
        await service.unallocate(scope?.startsWith('order:') ? scope.slice(6) : orderId)
        transition(layer)
      })
      return true
    }
    if (label === 'Try ambient vehicle') {
      const id = orderId,
        vehicle = data!.vehicles.find((vehicle) => vehicle.id === 'VEH002')
      const order = data!.orders.find((order) => order.id === id)
      const errors = vehicle && order ? allocationErrors(order, vehicle, trip, data!.orders) : []
      if (errors.length) {
        toast.error(errors[0])
        go('137:17718')
      } else transition(layer)
      return true
    }
    if (/Check available capacity/.test(label)) {
      const id = scope?.startsWith('order:') ? scope.slice(6) : orderId
      const order = data!.orders.find((order) => order.id === id),
        vehicle = data!.vehicles.find((vehicle) => vehicle.id === vehicleId)
      if (order && vehicle) {
        const errors = allocationErrors(order, vehicle, trip, data!.orders)
        if (errors.length) {
          toast.error(errors[0])
          go(
            /weight/i.test(errors[0])
              ? '137:17717'
              : /temperature|chilled/i.test(errors[0])
                ? '137:17718'
                : '137:17716',
          )
        } else {
          toast('The selected order fits this trip.')
        }
      }
      return true
    }
    if (/Matches reviewed evidence/.test(label)) {
      const id = /Weight/.test(label) ? 'ORD1058' : 'ORD1051'
      mutation.run(async () => {
        await service.defer(
          id,
          /Weight/.test(label) ? 'Insufficient Weight Capacity' : 'Insufficient Volume Capacity',
        )
        transition(layer)
      })
      return true
    }
    if (/^Review allocation$|^Review plan$|^Review publication$/.test(label)) {
      mutation.run(async () => {
        await service.reviewAllocation()
        if (
          allAllocated &&
          !data!.orders.some((order) => order.status === 'Deferred') &&
          label !== 'Review publication'
        )
          go('431:21818')
        else transition(layer)
      })
      return true
    }
    if (/^Publish plan$|^Publish revision/.test(label)) {
      mutation.run(async () => {
        await service.publish()
        go(data!.orders.some((order) => order.status === 'Deferred') ? '7:10' : '431:21962')
      })
      return true
    }
    if (/Refresh readiness|Open departure readiness/.test(label)) {
      go(data!.loads[0]?.completed ? '137:17725' : '137:17724')
      return true
    }
    if (/^Dispatch VEH/.test(label)) {
      mutation.run(async () => {
        await service.release(data!.loads[0].id)
        transition(layer)
      })
      return true
    }
    return false
  }
  function searchableText(layer: Layer) {
    const id = layer.name.split('/')[1]
    const vehicle = data!.vehicles.find((vehicle) => vehicle.id === id)
    if (vehicle)
      return `${vehicle.id} ${vehicle.brand} ${vehicle.type} ${vehicle.reefer ? 'Reefer' : 'Ambient'} ${vehicle.status} ${vehicle.location}`.toLowerCase()
    const order = data!.orders.find((order) => order.id === id)
    return `${allText(layer).replace(/Confirmed|Allocated|Deferred|Scheduled|En Route|Delivered/g, order?.status ?? '')} ${order?.outletName ?? ''}`.toLowerCase()
  }
  const controls: DesignControls = {
    busy: mutation.isPending,
    values: {},
    change: () => {},
    activate,
    context: (layer, scope) =>
      layer.name.startsWith('Vehicle/VEH')
        ? `vehicle:${layer.name.split('/')[1]}`
        : layer.name === 'OperationalStatus' && scope?.startsWith('vehicle:')
          ? `${scope}:status`
          : /^(QueueRow|Order|DraggableOrder)\/ORD\d+/.test(layer.name)
            ? `order:${layer.name.split('/')[1]}`
            : layer.name.startsWith('Cell/')
              ? `${scope}:${layer.name.slice(5)}`
              : scope,
    hidden: (layer) =>
      /^QueueRow\/|^Order\/ORD|^Vehicle\/VEH/.test(layer.name) &&
      !!search &&
      !searchableText(layer).includes(search.toLowerCase()),
    replace: (layer) =>
      layer.name === 'Placeholder' && /Search/.test(layer.characters ?? '') ? (
        <input
          aria-label="Search orders, outlets or vehicles"
          placeholder={layer.characters}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="figma-native-input"
          style={{ width: '100%', height: '100%', fontSize: 14, padding: 0 }}
        />
      ) : undefined,
    text: (layer, scope) => {
      const original = layer.characters
      if (!original) return undefined
      if (scope?.startsWith('vehicle:')) {
        const vehicle = data.vehicles.find((vehicle) => vehicle.id === scope.split(':')[1])
        if (vehicle) {
          if (layer.name === 'Vehicle') return vehicle.id
          if (layer.name === 'Brand') return vehicle.brand
          if (layer.name === 'Type') return vehicle.type
          if (layer.name === 'Temperature') return vehicle.reefer ? 'Reefer' : 'Ambient'
          if (layer.name === 'Label' && scope.endsWith(':status'))
            return vehicle.status === 'En route' ? 'En Route' : vehicle.status
          if (layer.name === 'Location') return vehicle.location
        }
      }
      if (scope?.startsWith('order:')) {
        const [, id, cell] = scope.split(':')
        const order = data.orders.find((order) => order.id === id)
        if (order) {
          if (cell === 'window_open_time') return order.window
          if (cell === 'order_volume_m3') return `${order.volume.toFixed(1)} m³`
          if (cell === 'order_weight_kg') return `${order.weight} kg`
          if (cell === 'Queue status') return order.status
          if (cell === 'temp_requirement') return order.temperature
          if (layer.name === 'Demand')
            return `${order.weight} kg · ${order.volume} m³ · ${order.temperature}`
        }
      }
      if (screen === 'release') {
        const load = data.loads[0],
          summary = loadSummary(data, load)
        const identity = `${load.vehicleId} \u00b7 Trip ${load.trip}`
        if (original.startsWith('VEH001, Trip 1'))
          return original.replace('VEH001, Trip 1', `${load.vehicleId}, Trip ${load.trip}`)
        if (original === 'VEH001 \u00b7 Trip 1 \u00b7 Reefer van')
          return `${identity} \u00b7 ${summary.vehicle?.reefer ? 'Reefer' : 'Ambient'} ${summary.vehicle?.type.toLowerCase() ?? 'vehicle'}`
        if (/^1 \/ 1 stop loaded/.test(original))
          return `${summary.loadedStops} / ${load.items.length} stops loaded \u00b7 ${load.items.map((item) => item.outlet).join(', ')}`
        if (/^60 \/ 800 kg/.test(original))
          return `${summary.weight} / ${summary.vehicle?.weightCapacity ?? 0} kg \u00b7 ${summary.volume.toFixed(1)} / ${(summary.vehicle?.volumeCapacity ?? 0).toFixed(1)} m³`
        if (original === 'None unresolved')
          return load.issue && !load.issueResolved ? load.issue : 'None unresolved'
        if (original.startsWith('VEH001 / Trip 1'))
          return `${load.vehicleId} / Trip ${load.trip} \u00b7 Attachment verified`
      }
      if (/^\d+ allocated · \d+ to review$/.test(original))
        return `${data.orders.filter((order) => order.vehicleId).length} allocated · ${data.orders.filter((order) => !order.vehicleId).length} to review`
      if (/^Unallocated · \d+$/.test(original))
        return `Unallocated · ${data.orders.filter((order) => !order.vehicleId).length}`
      if (/^Dispatch VEH001 · Trip 1$/.test(original))
        return `Dispatch ${data.loads[0].vehicleId} · Trip ${data.loads[0].trip}`
      if (layer.name === 'Title' && /^\d+ priority outlet/.test(original))
        return `${data.orders.filter((order) => order.priority && !order.vehicleId).length} priority outlet needs allocation`
      if (screen === 'release' && /loading proof/.test(original) && data.loads[0].completed)
        return 'Loading proof complete'
      return undefined
    },
    label: (layer) =>
      /^Action\/Dispatch/.test(layer.name)
        ? `Dispatch ${data.loads[0].vehicleId} · Trip ${data.loads[0].trip}`
        : undefined,
  }
  const blocked = screen === 'release' ? departureErrors(data, data.loads[0]) : []
  return (
    <main
      className="figma-entry"

      aria-busy={mutation.isPending}
    >
      <div>
        <DesignFrameView
          id={frame.id}
          catalog={catalog}
          assets={assets}
          onAction={onAction}
          controls={{
            ...controls,
            busy: mutation.isPending,
            activate: (layer, scope) => {
              if (/^Action\/Dispatch/.test(layer.name) && blocked.length) {
                toast.error(blocked[0])
                return true
              }
              return activate(layer, scope)
            },
          }}
        />
      </div>
      {overlay && catalog.frames.find((frame) => frame.id === overlay)?.section === 'dispatcher' ? (
        <SourceOverlay
          title={catalog.frames.find((frame) => frame.id === overlay)?.name ?? 'Order details'}
          close={() => setOverlay(null)}
          placement={
            ['74:1377', '74:1378'].includes(overlay)
              ? 'drawer'
              : ['101:17928', '115:17594'].includes(overlay)
                ? 'menu'
                : 'center'
          }
        >
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
            reviewPath="/dispatcher/deferrals"
          />
        )
      )}
    </main>
  )
}
