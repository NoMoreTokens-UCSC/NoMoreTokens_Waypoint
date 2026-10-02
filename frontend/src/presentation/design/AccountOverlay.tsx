import { useNavigate } from 'react-router-dom'
import { ProductFrameView as DesignFrameView } from './ProductFrameView'
import { allText } from './hooks'
import { SourceOverlay } from './SourceOverlay'
import type { AssetManifest, DesignCatalog, PrototypeAction } from './types'
import { useOperations } from '../hooks/useOperations'

export function AccountOverlay({
  id,
  catalog,
  assets,
  change,
  close,
  reviewPath,
  proofUrl,
}: {
  id: string
  catalog: DesignCatalog
  assets: AssetManifest
  change: (id: string) => void
  close: () => void
  reviewPath: string
  proofUrl?: string
}) {
  const navigate = useNavigate()
  const { data } = useOperations()
  function action(action: PrototypeAction) {
    if (action.type === 'CLOSE' || action.type === 'BACK') close()
    else if (action.destinationId === '7:6') {
      close()
      navigate('/workspaces')
    } else if (action.destinationId) change(action.destinationId)
  }
  return (
    <SourceOverlay
      title={catalog.frames.find((frame) => frame.id === id)?.name ?? 'Account'}
      close={close}
      placement={
        ['41:593', '168:18645', '115:17565', '115:17594', '115:17508'].includes(id)
          ? 'menu'
          : 'center'
      }
    >
      <DesignFrameView
        id={id}
        catalog={catalog}
        assets={assets}
        onAction={action}
        controls={{
          asset: (layer) => (/ProofPreview/.test(layer.name) ? proofUrl : undefined),
          style: (layer) =>
            id === '207:21017' && proofUrl && layer.fills.some((fill) => fill.type === 'IMAGE')
              ? {
                  backgroundImage: `url("${proofUrl}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined,
          values: {},
          change: () => {},
          isInteractive: (layer) => layer.name === 'WebBackButton',
          activate: (layer) => {
            const label = allText(layer)
            if (layer.name === 'WebBackButton') {
              close()
              return true
            }
            if (label === 'Review deferrals') {
              close()
              navigate(reviewPath)
              return true
            }
            return false
          },
          text: (layer) => {
            if (id !== '41:644' || !data) return undefined
            if (layer.name === 'Update1')
              return data.settings.routeStarted
                ? 'VEH055 is on the way to OUT001.'
                : 'VEH055 is awaiting departure.'
            if (layer.name === 'Update2')
              return `${data.orders.filter((order) => order.status === 'Deferred').length} deferred orders need review.`
            return undefined
          },
        }}
      />
    </SourceOverlay>
  )
}
