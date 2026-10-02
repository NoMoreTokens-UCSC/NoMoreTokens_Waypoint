import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ProductFrameView as DesignFrameView,
  useViewportWidth,
} from '../../../design/ProductFrameView'
import { resolveProductFrame } from '../../../design/presentationManifest'
import { AccountOverlay } from '../../../design/AccountOverlay'
import { useDesignAssets, useDesignCatalog } from '../../../design/hooks'

/** Shared account views remain overlays over the current responsive workspace. */
export default function FigmaAccountPage() {
  const catalog = useDesignCatalog().data
  const assets = useDesignAssets().data
  const location = useLocation()
  const navigate = useNavigate()
  const width = useViewportWidth()
  const background = resolveProductFrame(catalog, '196:18656', width)
  const initial = location.pathname.endsWith('/settings')
    ? '41:624'
    : location.pathname.endsWith('/notifications')
      ? '41:644'
      : '41:615'
  const [overlay, setOverlay] = useState(initial)
  if (!catalog || !assets || !background) return <p>Opening account...</p>
  return (
    <main className="figma-entry">
      <div>
        <DesignFrameView id={background.id} catalog={catalog} assets={assets} onAction={() => {}} />
      </div>
      <AccountOverlay
        id={overlay}
        catalog={catalog}
        assets={assets}
        change={setOverlay}
        close={() => navigate('/store-manager/overview')}
        reviewPath="/dispatcher/deferrals"
      />
    </main>
  )
}
