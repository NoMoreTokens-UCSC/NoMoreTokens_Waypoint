import { useContext, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { allText, useDesignAssets, useDesignCatalog, useDesignFrame } from './hooks'
import { layerStyle, textStyle } from './styles'
import { runPrototypeAction } from './prototype'
import type { AssetManifest, DesignCatalog, Layer, PrototypeAction } from './types'
import { overlayContent, prepareProductTree, productLayerStyle } from './responsiveLayout'
import { HomeMotionContext, HomeReveal, homeRevealKind } from './motion'

function TextLayer({ layer }: { layer: Layer }) {
  const overrides = layer.characterStyleOverrides
  if (!overrides?.some(Boolean)) return <>{layer.characters}</>
  const runs: { text: string; override: number }[] = []
  Array.from(layer.characters ?? '').forEach((character, index) => {
    const override = overrides[index] ?? 0
    const last = runs.at(-1)
    if (last?.override === override) last.text += character
    else runs.push({ text: character, override })
  })
  return (
    <>
      {runs.map((run, index) => (
        <span
          key={index}
          style={
            run.override
              ? textStyle(
                  { ...layer.style, ...layer.styleOverrideTable?.[run.override] },
                  layer.styleOverrideTable?.[run.override]?.fills ?? layer.fills,
                )
              : undefined
          }
        >
          {run.text}
        </span>
      ))}
    </>
  )
}

export interface DesignControls {
  busy?: boolean
  values: Record<string, string>
  change: (field: string, value: string) => void
  activate: (layer: Layer, scope?: string) => boolean
  text?: (layer: Layer, scope?: string) => string | undefined
  context?: (layer: Layer, scope?: string) => string | undefined
  isInteractive?: (layer: Layer) => boolean
  style?: (layer: Layer, scope?: string) => CSSProperties | undefined
  replace?: (layer: Layer, scope?: string) => ReactNode | undefined
  hidden?: (layer: Layer, scope?: string) => boolean
  asset?: (layer: Layer) => string | undefined
  label?: (layer: Layer, scope?: string) => string | undefined
  imageLabel?: (layer: Layer) => string | undefined
}
function DesignLayer({
  layer,
  assets,
  catalog,
  onAction,
  root = false,
  controls,
  fieldName,
  scope,
  parentName,
  actions,
  product = false,
  parent,
  width = 1440,
  overlay = false,
  sourceWidth = layer.box.width,
}: {
  layer: Layer
  assets: AssetManifest
  catalog: DesignCatalog
  onAction: (action: PrototypeAction) => void
  root?: boolean
  controls?: DesignControls
  fieldName?: string
  scope?: string
  parentName?: string
  actions: ReadonlyMap<string, PrototypeAction>
  product?: boolean
  parent?: Layer
  width?: number
  overlay?: boolean
  sourceWidth?: number
}) {
  const homeMotion = useContext(HomeMotionContext)
  const sourceAction = actions.get(layer.id)
  const action =
    sourceAction ??
    layer.interactions?.find((i) => i.trigger?.type === 'ON_CLICK')?.actions?.find((a) => a != null)
  const style = layerStyle(layer, assets.images, root)
  if (product)
    Object.assign(style, productLayerStyle(layer, parent, root, width, overlay, sourceWidth))
  const orderScope = /(?:OrderForm|ReviewOrder)\/(chilled|dry)/i
    .exec(layer.name)?.[1]
    ?.toLowerCase()
  const defaultScope =
    orderScope ??
    (layer.name === 'BrandOrderWidget'
      ? /chilled/i.test(allText(layer))
        ? 'chilled'
        : 'dry'
      : scope)
  const nextScope = controls?.context?.(layer, defaultScope) ?? defaultScope
  Object.assign(style, controls?.style?.(layer, nextScope))
  if (controls?.hidden?.(layer, nextScope)) return null
  if (layer.asset && assets.nonRenderingVectors?.includes(layer.asset) && !controls?.asset?.(layer))
    return null
  const replaced = controls?.replace?.(layer, nextScope)
  if (replaced !== undefined)
    return (
      <div data-node={layer.id} data-layer={layer.name} style={style}>
        {replaced}
      </div>
    )
  const field =
    layer.name === 'Field'
      ? layer.children?.find((child) => child.name === 'Label')?.characters
      : layer.name.startsWith('Field/')
        ? `${nextScope ? nextScope + ':' : ''}${layer.name.slice(6)}`
        : fieldName
  const assetBox =
    (layer.asset && assets.renderBoxes?.[layer.asset]) ||
    (layer.name.startsWith('MapAnchor/') ? layer.assetBox : undefined)
  if (controls && /^(Input|InputContainer)$/.test(layer.name) && field) {
    const placeholder = allText(layer)
    return (
      <input
        data-node={layer.id}
        aria-label={field}
        className="figma-native-input"
        style={{
          ...style,
          padding: '0 16px',
          fontSize: layer.name === 'InputContainer' ? 16 : 14,
          color: '#22252a',
        }}
        type={
          /password/i.test(field)
            ? 'password'
            : /cases|weight|volume/i.test(field)
              ? 'number'
              : 'text'
        }
        step={/cases/i.test(field) ? 1 : 'any'}
        autoComplete={
          /password/i.test(field)
            ? 'current-password'
            : /email|employee/i.test(field)
              ? 'username'
              : 'off'
        }
        placeholder={placeholder}
        value={controls.values[field] ?? ''}
        onChange={(event) => controls.change(field, event.target.value)}
      />
    )
  }
  const content =
    layer.name === 'Checkbox' && controls?.values.Remember === 'true' ? (
      <span
        style={{
          display: 'block',
          textAlign: 'center',
          lineHeight: `${layer.box.height}px`,
          fontSize: 14,
          color: '#22252a',
        }}
      >
        ✓
      </span>
    ) : layer.asset ? (
      (controls?.asset?.(layer) ?? assets.vectors[layer.asset]) ? (
        <img
          src={controls?.asset?.(layer) ?? assets.vectors[layer.asset]}
          alt=""
          draggable={false}
          style={
            assetBox
              ? {
                  position: 'absolute',
                  left: assetBox.x,
                  top: assetBox.y,
                  width: assetBox.width,
                  height: assetBox.height,
                  display: 'block',
                }
              : { width: '100%', height: '100%', display: 'block' }
          }
        />
      ) : (
        <span data-missing-asset={layer.asset} />
      )
    ) : layer.type === 'TEXT' ? (
      <TextLayer
        layer={
          controls?.text?.(layer, nextScope) != null
            ? { ...layer, characters: controls.text(layer, nextScope) }
            : layer
        }
      />
    ) : (
      layer.children?.map((child) => (
        <DesignLayer
          key={child.id}
          layer={child}
          assets={assets}
          catalog={catalog}
          onAction={onAction}
          controls={controls}
          fieldName={field}
          scope={nextScope}
          parentName={layer.name}
          actions={actions}
          product={product}
          parent={layer}
          width={width}
          overlay={overlay}
          sourceWidth={sourceWidth}
        />
      ))
    )
  if (layer.asset) {
    // The exported asset already includes its original paints and borders.
    style.background = 'none'
    style.outline = 'none'
    style.boxShadow = 'none'
  }
  const functional =
    controls &&
    (layer.name.startsWith('Button/') ||
      layer.name === 'Checkbox' ||
      /forgot|back to welcome/i.test(layer.characters ?? '') ||
      controls.isInteractive?.(layer))
  if (action || functional)
    return (
      <button
        type="button"
        disabled={controls?.busy}
        className="figma-layer-action"
        data-node={layer.id}
        data-layer={layer.name}
        role={controls && layer.name === 'Checkbox' ? 'checkbox' : undefined}
        aria-checked={
          controls && layer.name === 'Checkbox' ? controls.values.Remember === 'true' : undefined
        }
        aria-label={
          controls?.label?.(layer, nextScope) ??
          (controls && layer.name === 'Checkbox' ? 'Keep signed in' : allText(layer) || layer.name)
        }
        style={style}
        onClick={(event) => {
          event.stopPropagation()
          if (controls?.activate(layer, nextScope)) return
          if (action) runPrototypeAction(action, onAction)
        }}
      >
        {content}
      </button>
    )
  const Element =
    layer.type === 'TEXT' &&
    (((layer.style?.fontSize ?? 0) >= 24 &&
      /[a-z]/i.test(layer.characters ?? '') &&
      layer.box.width > 100) ||
      (layer.name === 'Title' && (layer.style?.fontSize ?? 0) >= 20) ||
      (parentName === 'Body' &&
        (layer.style?.fontSize ?? 0) >= 20 &&
        /[a-z]/i.test(layer.characters ?? '')) ||
      layer.name === 'Sign in to Waypoint')
      ? 'h1'
      : 'div'
  const reveal = homeMotion && product && !overlay ? homeRevealKind(layer, parent) : undefined
  if (reveal)
    return (
      <HomeReveal layer={layer} kind={reveal} as={Element} style={style}>
        {content}
      </HomeReveal>
    )
  return (
    <Element
      data-node={layer.id}
      data-layer={layer.name}
      data-render-mode={root ? (product ? 'product' : 'reference') : undefined}
      style={style}
      role={controls?.imageLabel?.(layer) ? 'img' : undefined}
      aria-label={controls?.imageLabel?.(layer)}
    >
      {content}
    </Element>
  )
}

export function DesignFrameView({
  id,
  catalog,
  assets,
  onAction,
  controls,
  product = false,
  width = window.innerWidth,
  overlay = false,
}: {
  id: string
  catalog: DesignCatalog
  assets: AssetManifest
  onAction: (action: PrototypeAction) => void
  controls?: DesignControls
  product?: boolean
  width?: number
  overlay?: boolean
}) {
  const frame = catalog.frames.find((f) => f.id === id)
  const query = useDesignFrame(frame?.url)
  const actions = useMemo(() => {
    const map = new Map<string, PrototypeAction>()
    for (const link of catalog.frames.flatMap((frame) => frame.interactions)) {
      if (link.trigger?.type !== 'ON_CLICK') continue
      const sequence = map.get(link.source) ?? { type: 'SEQUENCE', actions: [] }
      sequence.actions!.push(link.action)
      map.set(link.source, sequence)
    }
    return map
  }, [catalog])
  if (query.error) return <p role="alert">{query.error.message}</p>
  if (!query.data) return <p>Opening design reference…</p>
  return (
    <DesignLayer
      layer={
        product ? prepareProductTree(overlay ? overlayContent(query.data) : query.data) : query.data
      }
      assets={assets}
      catalog={catalog}
      onAction={onAction}
      controls={controls}
      root
      actions={actions}
      product={product}
      width={width}
      overlay={overlay}
    />
  )
}

export default function DesignReferencePage() {
  const { frameId } = useParams()
  const navigate = useNavigate()
  const catalogQuery = useDesignCatalog()
  const assetsQuery = useDesignAssets()
  const [overlay, setOverlay] = useState<string | null>(null)
  const catalog = catalogQuery.data
  const assets = assetsQuery.data
  if (catalogQuery.error || assetsQuery.error)
    return <p role="alert">Could not open the local design references.</p>
  if (!catalog || !assets) return <p>Opening design references…</p>
  if (!frameId)
    return (
      <main className="figma-reference-index">
        <h1>Figma screen inventory</h1>
        <p>Source layout inspection. Operational workflows are being connected separately.</p>
        {[
          'entry-account',
          'administration',
          'store-manager',
          'dispatcher',
          'loader',
          'driver',
          'recovery',
        ].map((section) => (
          <section key={section}>
            <h2>{section}</h2>
            <ul>
              {catalog.frames
                .filter((f) => f.section === section)
                .map((frame) => (
                  <li key={frame.id}>
                    <Link to={`/design/${frame.id}`}>
                      {frame.name} · {frame.width} × {frame.height}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </main>
    )
  function handleAction(action: PrototypeAction) {
    if (action.type === 'CLOSE') {
      setOverlay(null)
      return
    }
    if (action.type === 'BACK') {
      navigate(-1)
      return
    }
    if (!action.destinationId || !catalog?.frames.some((f) => f.id === action.destinationId)) return
    if (action.navigation === 'OVERLAY' || action.navigation === 'SWAP')
      setOverlay(action.destinationId)
    else {
      setOverlay(null)
      navigate(`/design/${action.destinationId}`)
      window.scrollTo(0, 0)
    }
  }
  return (
    <div className="figma-reference">
      <DesignFrameView id={frameId} catalog={catalog} assets={assets} onAction={handleAction} />
      {overlay && (
        <div
          className="figma-reference-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={catalog.frames.find((f) => f.id === overlay)?.name}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOverlay(null)
          }}
        >
          <DesignFrameView id={overlay} catalog={catalog} assets={assets} onAction={handleAction} />
        </div>
      )}
    </div>
  )
}
