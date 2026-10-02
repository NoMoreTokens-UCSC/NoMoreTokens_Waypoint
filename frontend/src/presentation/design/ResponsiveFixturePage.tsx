import { useParams, useSearchParams } from 'react-router-dom'
import { useDesignAssets, useDesignCatalog } from './hooks'
import { ProductFrameView, useViewportWidth } from './ProductFrameView'
import { resolveProductFrame } from './presentationManifest'
import { SourceOverlay } from './SourceOverlay'

/** Development-only deterministic scenes, kept separate from product navigation. */
export default function ResponsiveFixturePage() {
  const { frameId } = useParams()
  const [params] = useSearchParams()
  const catalog = useDesignCatalog().data
  const assets = useDesignAssets().data
  const width = useViewportWidth()
  const frame = resolveProductFrame(catalog, frameId, width)
  if (!catalog || !assets || !frame) return <p>Opening responsive fixture…</p>
  const scene = (
    <ProductFrameView id={frame.id} catalog={catalog} assets={assets} onAction={() => {}} />
  )
  return params.has('overlay') ? (
    <SourceOverlay
      title={frame.name}
      close={() => {}}
      placement={
        frame.name.includes('drawer')
          ? 'drawer'
          : frame.name.includes('navigation') || frame.name.includes('Dropdown')
            ? 'menu'
            : 'center'
      }
    >
      {scene}
    </SourceOverlay>
  ) : (
    <main className="figma-entry">{scene}</main>
  )
}
