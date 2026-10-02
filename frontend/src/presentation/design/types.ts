export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}
export interface Paint {
  type: string
  visible?: boolean
  opacity?: number
  color?: { r: number; g: number; b: number; a?: number }
  imageRef?: string
  scaleMode?: string
  imageTransform?: number[][]
  gradientHandlePositions?: { x: number; y: number }[]
  gradientStops?: { position: number; color: { r: number; g: number; b: number; a?: number } }[]
}
export interface TextStyle {
  fontFamily?: string
  fontWeight?: number
  fontSize?: number
  italic?: boolean
  lineHeightPx?: number
  letterSpacing?: number
  textAlignHorizontal?: string
  textAlignVertical?: string
  textDecoration?: string
  fills?: Paint[]
  textTruncation?: string
  textAutoResize?: string
}
export interface PrototypeAction {
  actions?: PrototypeAction[]
  variableId?: string
  variableValue?: import('./prototype').PrototypeValue
  conditionalBlocks?: {
    condition?: import('./prototype').PrototypeValue
    actions: PrototypeAction[]
  }[]
  type: string
  destinationId?: string
  navigation?: string
  url?: string
  transition?: { type: string; duration?: number; easing?: { type: string } }
  resetScrollPosition?: boolean
  overlayPositionType?: string
}
export interface Layer {
  id: string
  name: string
  type: string
  box: Bounds
  asset?: string
  assetBox?: Bounds
  fills: Paint[]
  strokes: Paint[]
  children?: Layer[]
  characters?: string
  style?: TextStyle
  characterStyleOverrides?: number[]
  styleOverrideTable?: Record<string, TextStyle>
  opacity?: number
  rotation?: number
  clipsContent?: boolean
  cornerRadius?: number
  rectangleCornerRadii?: number[]
  strokeWeight?: number
  strokeAlign?: string
  effects?: {
    type: string
    visible?: boolean
    radius?: number
    spread?: number
    offset?: { x: number; y: number }
    color?: { r: number; g: number; b: number; a?: number }
  }[]
  interactions?: { trigger?: { type: string }; actions?: (PrototypeAction | null)[] }[]
  transitionNodeID?: string
  constraints?: { horizontal: string; vertical: string }
  componentProperties?: Record<string, { value: string | boolean; type: string }>
  scrollBehavior?: string
  minHeight?: number
  layoutMode?: string
  layoutWrap?: string
  layoutPositioning?: string
  layoutAlign?: string
  layoutGrow?: number
  layoutSizingHorizontal?: string
  layoutSizingVertical?: string
  primaryAxisAlignItems?: string
  counterAxisAlignItems?: string
  itemSpacing?: number
  paddingLeft?: number
  paddingRight?: number
  paddingTop?: number
  paddingBottom?: number
  overflowDirection?: string
}
export interface DesignFrame {
  id: string
  name: string
  section: string
  path: string[]
  width: number
  height: number
  viewport: 'desktop' | 'tablet' | 'mobile'
  url: string
  interactions: {
    source: string
    label: string
    trigger?: { type: string }
    action: PrototypeAction
  }[]
}
export interface DesignCatalog {
  sourceFileKey: string
  targetFileKey: string
  status: string
  frames: DesignFrame[]
  assets: Record<
    string,
    { nodeId: string; name: string; path: string; width: number; height: number }
  >
  imageRefs: string[]
}
export interface AssetManifest {
  nonRenderingVectors?: string[]
  renderBoxes?: Record<string, Bounds>
  images: Record<string, string>
  vectors: Record<string, string>
  references: Record<string, string>
  failed: { kind: string; id: string }[]
}
