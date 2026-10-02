import { useContext, useEffect, useState } from 'react'
import { DesignFrameView } from './DesignReferencePage'
import { OverlayRenderingContext } from './SourceOverlay'

export function useViewportWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  return width
}

export function ProductFrameView(props: React.ComponentProps<typeof DesignFrameView>) {
  const width = useViewportWidth()
  const overlay = useContext(OverlayRenderingContext)
  return <DesignFrameView {...props} product width={width} overlay={overlay} />
}
