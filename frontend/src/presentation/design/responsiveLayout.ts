import type { CSSProperties } from 'react'
import type { Layer } from './types'

export type Viewport = 'mobile' | 'tablet' | 'desktop'
export const viewportFor = (width: number): Viewport =>
  width < 768 ? 'mobile' : width < 1200 ? 'tablet' : 'desktop'

const align = (value?: string) =>
  value === 'CENTER' ? 'center' : value === 'MAX' ? 'flex-end' : 'flex-start'
const decorative = (node: Layer) =>
  Boolean(node.asset || node.fills.some((fill) => fill.type === 'IMAGE')) ||
  /map|chart|illustration|signature|camera|photo|preview|skeleton/i.test(node.name)
const tableRow = (node: Layer) =>
  /^(QueueRow\/|TableRow|HeaderRow|AuditRow\/|UserRow\/|Cell\/)/.test(node.name)
const stackedPanel = (node: Layer, width: number, sourceWidth: number) =>
  width < 1200 &&
  width < sourceWidth &&
  node.layoutMode === 'HORIZONTAL' &&
  node.box.width >= 700 &&
  !/Hero|MorningRush|Footer|Metrics|Cards|List|Table|Row|Header/.test(node.name) &&
  !decorative(node) &&
  (node.children?.filter(
    (child) => child.layoutPositioning !== 'ABSOLUTE' && child.box.width >= 240,
  ).length ?? 0) >= 2

export function overlayContent(source: Layer): Layer {
  const panel = source.children?.find(
    (child) =>
      child.name.startsWith('Dialog') ||
      [
        'MenuPanel',
        'AccountMenu',
        'HeaderDropdownMenu',
        'DetailDrawerPanel',
        'ProfilePanel',
        'SettingsPanel',
        'NotificationPanel',
      ].includes(child.name),
  )
  return panel ? { ...panel, box: { ...panel.box, x: 0, y: 0 } } : source
}

export function prepareProductTree(source: Layer): Layer {
  let node: Layer = { ...source, children: source.children?.map(prepareProductTree) }
  if (node.name === 'HeroBand') node.layoutMode = 'VERTICAL'
  if (node.name === 'StepsRow' && !node.layoutMode) {
    const circles = node.children?.filter((child) => child.name === 'StepCircle') ?? []
    const mobile = node.box.width <= 440
    if (circles.length)
      node = {
        ...node,
        layoutMode: mobile ? 'VERTICAL' : 'HORIZONTAL',
        itemSpacing: mobile ? 24 : 24,
        layoutSizingVertical: 'HUG',
        children: circles
          .map((circle, index) => {
            const copy =
              node.children?.filter(
                (child) =>
                  child.type === 'TEXT' &&
                  (mobile
                    ? child.box.y >= circle.box.y &&
                      child.box.y < (circles[index + 1]?.box.y ?? Infinity)
                    : child.box.x === circle.box.x),
              ) ?? []
            const copyGroup: Layer = {
              id: `${node.id}-copy-${index}`,
              name: 'StepCopy',
              type: 'FRAME',
              fills: [],
              strokes: [],
              box: {
                x: 0,
                y: 0,
                width: mobile ? node.box.width - 64 : 318,
                height: mobile ? 86 : 64,
              },
              layoutMode: 'VERTICAL',
              layoutSizingHorizontal: 'FILL',
              layoutGrow: 1,
              layoutSizingVertical: 'HUG',
              itemSpacing: 6,
              children: copy.map((child) => ({ ...child, layoutSizingHorizontal: 'FILL' })),
            }
            return {
              id: `${node.id}-column-${index}`,
              name: mobile ? 'StepRow' : 'StepColumn',
              type: 'FRAME',
              fills: [],
              strokes: [],
              box: {
                x: circle.box.x,
                y: circle.box.y,
                width: mobile ? node.box.width : 318,
                height: mobile ? 86 : 150,
              },
              layoutMode: mobile ? 'HORIZONTAL' : 'VERTICAL',
              layoutSizingHorizontal: 'FILL',
              layoutGrow: 1,
              layoutSizingVertical: 'HUG',
              itemSpacing: 20,
              minHeight: mobile ? 86 : 150,
              children: [
                { ...circle, layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED' },
                copyGroup,
              ],
            } as Layer
          })
          .concat(
            (node.children
              ?.filter((child) => child.name === 'Connector')
              .map((child) => ({ ...child, layoutPositioning: 'ABSOLUTE' })) ?? []) as Layer[],
          ),
      }
  }
  if (node.name === 'MorningRush' && !node.layoutMode) {
    const image = node.children?.find((child) => child.fills.some((fill) => fill.type === 'IMAGE'))
    if (image && node.box.width <= 440) {
      const body = node.children?.find((child) => child.name === 'Body')
      node = {
        ...node,
        layoutMode: 'VERTICAL',
        layoutSizingVertical: 'HUG',
        itemSpacing: 11,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 16,
        paddingBottom: 38,
        children: [
          ...(node.children
            ?.filter((child) => child.name === 'Eyebrow' || child.name === 'Heading')
            .map((child) => ({ ...child, layoutSizingHorizontal: 'FILL' })) ?? []),
          {
            id: `${node.id}-row`,
            name: 'MorningRushRow',
            type: 'FRAME',
            fills: [],
            strokes: [],
            box: { x: 0, y: 0, width: 366, height: 136 },
            layoutMode: 'HORIZONTAL',
            itemSpacing: 31,
            layoutSizingHorizontal: 'FILL',
            layoutSizingVertical: 'HUG',
            children: [
              ...(body ? [{ ...body, layoutSizingHorizontal: 'FILL', layoutGrow: 128 }] : []),
              {
                ...image,
                layoutSizingHorizontal: 'FILL',
                layoutGrow: 203,
                layoutSizingVertical: 'FIXED',
              },
            ],
          },
        ],
      }
    } else if (image)
      node = {
        ...node,
        layoutMode: 'HORIZONTAL',
        layoutSizingVertical: 'HUG',
        children: [
          {
            id: `${node.id}-copy`,
            name: 'MorningRushCopy',
            type: 'FRAME',
            fills: [],
            strokes: [],
            box: { x: 0, y: 0, width: node.box.width / 2, height: node.box.height },
            layoutMode: 'VERTICAL',
            layoutSizingHorizontal: 'FILL',
            layoutGrow: 1,
            layoutSizingVertical: 'HUG',
            itemSpacing: 20,
            paddingLeft: 48,
            paddingRight: 48,
            paddingTop: 110,
            paddingBottom: 24,
            children: node.children
              ?.filter((child) => child.id !== image.id)
              .map((child) => ({ ...child, layoutSizingHorizontal: 'FILL' })),
          },
          {
            id: `${node.id}-photo`,
            name: 'MorningRushPhoto',
            type: 'FRAME',
            fills: [],
            strokes: [],
            clipsContent: true,
            box: { x: 0, y: 0, width: node.box.width / 2, height: node.box.height },
            layoutSizingHorizontal: 'FILL',
            layoutSizingVertical: 'FIXED',
            children: [{ ...image, box: { ...image.box, x: 0, y: 0 } }],
          },
        ],
      }
  }
  return node
}

/** Product geometry only. The source inspection renderer never calls this. */
export function productLayerStyle(
  node: Layer,
  parent: Layer | undefined,
  root: boolean,
  width: number,
  overlay: boolean,
  sourceWidth = 1440,
): CSSProperties {
  const style: CSSProperties = { minWidth: 0, maxWidth: '100%' }
  const backgroundBlur = node.effects?.find(
    (effect) => effect.type === 'BACKGROUND_BLUR' && effect.visible !== false,
  )
  if (backgroundBlur) style.backdropFilter = `blur(${backgroundBlur.radius ?? 0}px)`
  const flexParent = parent?.layoutMode === 'HORIZONTAL' || parent?.layoutMode === 'VERTICAL'
  const horizontalParent = parent?.layoutMode === 'HORIZONTAL'
  const flow = root || (flexParent && node.layoutPositioning !== 'ABSOLUTE')
  if (flow) {
    Object.assign(style, { position: 'relative', left: undefined, top: undefined, flexShrink: 0 })
    // Full-width source bands expand with their product shell, including wide monitors.
    if (parent?.layoutMode === 'VERTICAL' && Math.abs(node.box.width - parent.box.width) < 0.5)
      style.width = '100%'
    if (
      node.layoutSizingHorizontal === 'FILL' ||
      (!horizontalParent && node.layoutAlign === 'STRETCH')
    )
      style.width = horizontalParent ? undefined : '100%'
    if (horizontalParent && (node.layoutGrow || node.layoutSizingHorizontal === 'FILL'))
      Object.assign(style, { flex: `${node.layoutGrow || 1} 1 0`, width: undefined })
    if (!horizontalParent && node.layoutSizingVertical === 'FILL' && node.layoutGrow)
      Object.assign(style, { flex: `${node.layoutGrow} 1 0`, height: undefined, minHeight: 0 })
    if (node.layoutSizingHorizontal === 'HUG') style.width = 'auto'
    if (node.layoutSizingVertical === 'HUG') style.height = 'auto'
  }
  if (!node.asset && (node.layoutMode === 'VERTICAL' || node.layoutMode === 'HORIZONTAL')) {
    const horizontal = node.layoutMode === 'HORIZONTAL'
    Object.assign(style, {
      display: 'flex',
      flexDirection: horizontal ? 'row' : 'column',
      gap: Math.max(0, node.itemSpacing ?? 0),
      justifyContent:
        node.primaryAxisAlignItems === 'SPACE_BETWEEN'
          ? 'space-between'
          : align(node.primaryAxisAlignItems),
      alignItems: node.counterAxisAlignItems ? align(node.counterAxisAlignItems) : 'flex-start',
      paddingLeft: node.paddingLeft ?? 0,
      paddingRight: node.paddingRight ?? 0,
      paddingTop: node.paddingTop ?? 0,
      paddingBottom: node.paddingBottom ?? 0,
    })
    // Figma fixed-height controls may contain padding larger than their available height.
    if (horizontal && node.layoutSizingVertical === 'FIXED') {
      const contentHeight = Math.max(0, ...(node.children ?? []).map((child) => child.box.height))
      const available = Math.max(0, (node.box.height - contentHeight) / 2)
      style.paddingTop = Math.min(node.paddingTop ?? 0, available)
      style.paddingBottom = Math.min(node.paddingBottom ?? 0, available)
      style.minHeight = node.box.height
      style.height = 'auto'
    }
    if (
      !decorative(node) &&
      Boolean(node.children?.length) &&
      node.layoutSizingVertical !== 'FILL' &&
      !/Spacer|FlexibleSpace/.test(node.name)
    )
      style.height = 'auto'
    if (node.minHeight) style.minHeight = node.minHeight
    if (node.layoutWrap === 'WRAP') style.flexWrap = 'wrap'
  }
  if (!flow && parent) {
    const padRight = parent.box.width - node.box.x - node.box.width
    if (node.constraints?.horizontal === 'LEFT_RIGHT')
      Object.assign(style, { left: node.box.x, right: Math.max(0, padRight), width: undefined })
    else if (node.constraints?.horizontal === 'RIGHT')
      Object.assign(style, { left: undefined, right: padRight })
    else if (node.constraints?.horizontal === 'CENTER')
      Object.assign(style, { left: `calc(50% + ${node.box.x - parent.box.width / 2}px)` })
    else if (decorative(parent) || node.constraints?.horizontal === 'SCALE')
      Object.assign(style, {
        left: `${(node.box.x / parent.box.width) * 100}%`,
        width:
          node.type === 'TEXT' || node.layoutSizingHorizontal === 'HUG'
            ? node.box.width
            : `${(node.box.width / parent.box.width) * 100}%`,
      })
  }
  if (node.asset && node.layoutSizingHorizontal === 'HUG')
    Object.assign(style, {
      width: node.box.width,
      height: node.box.height,
      alignSelf: 'flex-start',
      flexShrink: 0,
    })
  if (node.type === 'TEXT' && flow) {
    Object.assign(style, {
      height: 'auto',
      minHeight: node.box.height,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    })
    if (node.style?.textAutoResize === 'TRUNCATE')
      Object.assign(style, { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })
    if (node.name === 'Placeholder' && horizontalParent)
      Object.assign(style, {
        flex: '1 1 0',
        width: undefined,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      })
    if (horizontalParent && node.layoutSizingHorizontal === 'HUG') style.flexShrink = 1
    if (node.name === 'Label')
      style.whiteSpace = parent && parent.box.width <= 180 ? 'nowrap' : 'pre-wrap'
    if (node.name === 'Label' && parent?.layoutSizingHorizontal === 'HUG')
      Object.assign(style, {
        width: 'max-content',
        minWidth: node.box.width,
        maxWidth: undefined,
        flexShrink: 0,
      })
  }
  if (/^(PersistentSidebar|Sidebar)$/.test(node.name))
    Object.assign(style, { height: '100%', overflowY: 'auto', flexShrink: 0 })
  if (width >= 768 && parent?.name.trim().startsWith('Login')) {
    if (node.name === 'HeroPanel' || node.name === 'FormPanel')
      Object.assign(style, {
        flex: node.name === 'HeroPanel' ? '0 0 58.333333%' : '0 0 41.666667%',
        width: undefined,
        height: 'auto',
        minHeight: width >= 768 ? '100dvh' : undefined,
      })
    if (node.name === 'FormPanel') Object.assign(style, { padding: width >= 768 ? 32 : 24 })
  }
  if (width < 768 && parent?.name.trim().startsWith('Login') && parent.box.width > 440) {
    if (node.name === 'HeroPanel') style.display = 'none'
    if (node.name === 'FormPanel')
      Object.assign(style, { width: '100%', flex: '0 0 auto', padding: 24, minHeight: '100dvh' })
  }
  if (node.name === 'Form' && parent?.name === 'FormPanel')
    Object.assign(style, { width: '100%', maxWidth: 400, height: 'auto', alignSelf: 'center' })
  if (node.name === 'WorkspaceColumn')
    Object.assign(style, { height: '100%', minHeight: 0, flex: '1 1 0', overflow: 'hidden' })
  if (/^(ContentViewport|RouteWorkspace)$/.test(node.name))
    Object.assign(style, { flex: '1 1 0', minHeight: 0, height: undefined, overflowY: 'auto' })
  if (/TableScroll|RowsViewport|ListViewport|ScrollableOrderRows/.test(node.name))
    Object.assign(style, {
      overflow: 'auto',
      maxHeight: node.box.height,
      height: 'auto',
      flexShrink: 1,
    })
  // Keep authored column widths readable inside a contained scroll area.
  if (
    /^(RolesMatrix|OrdersTable|OrderQueueTable|AuditTable|TeamTable|Table|FleetDataTable|OrdersDataTable)$/.test(
      node.name,
    )
  )
    Object.assign(style, { overflowX: 'auto', minWidth: 0 })
  if (
    parent &&
    /^(RolesMatrix|OrdersTable|OrderQueueTable|AuditTable|TeamTable|Table|FleetDataTable|OrdersDataTable)$/.test(
      parent.name,
    )
  )
    Object.assign(style, { minWidth: node.box.width, maxWidth: undefined, flexShrink: 0 })
  if (node.name === 'GlobalSearch' && horizontalParent) Object.assign(style, { flexShrink: 1 })
  if (
    width < 768 &&
    horizontalParent &&
    /^(HeaderFlexibleSpace|ToolbarSpacer|Spacer)$/.test(node.name)
  )
    style.display = 'none'
  if (node.name === 'BreadcrumbNavigation')
    Object.assign(style, {
      overflowX: 'auto',
      height: 'auto',
      minHeight: node.box.height,
      flex: '0 0 auto',
    })
  if (node.name === 'Scrim' && node.layoutPositioning === 'ABSOLUTE')
    Object.assign(style, { position: 'absolute', inset: 0, width: '100%', height: '100%' })
  if (
    width < sourceWidth &&
    parent?.children?.some((child) => child.name === 'Scrim') &&
    node.name.startsWith('Dialog')
  )
    Object.assign(style, {
      left: '50%',
      top: 16,
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: node.box.width,
      maxHeight: 'calc(100dvh - 32px)',
      height: 'auto',
      overflowY: 'auto',
    })
  if (
    width < 1200 &&
    node.layoutMode === 'HORIZONTAL' &&
    /Actions|Toolbar|SelectedVehicle/.test(node.name)
  )
    Object.assign(style, { flexWrap: 'wrap', height: 'auto' })
  if (stackedPanel(node, width, sourceWidth))
    Object.assign(style, { flexDirection: 'column', height: 'auto', alignItems: 'stretch' })
  if (parent && stackedPanel(parent, width, sourceWidth))
    Object.assign(style, { width: '100%', flex: '0 0 auto', height: 'auto' })
  if (
    width < 1200 &&
    /^(AllocationSplitPane|NextSteps|DepartureWorkspace|ConstraintComparison)$/.test(node.name)
  )
    Object.assign(style, { flexDirection: 'column', height: 'auto' })
  if (
    width < 1200 &&
    parent &&
    /^(AllocationSplitPane|NextSteps|DepartureWorkspace|ConstraintComparison)$/.test(parent.name)
  )
    Object.assign(style, { width: '100%', flex: '0 0 auto' })
  if (node.name === 'PlanningProgress') Object.assign(style, { flexWrap: 'wrap', height: 'auto' })
  if (parent?.name === 'PlanningProgress') Object.assign(style, { flex: '1 0 120px' })
  if (node.name === 'PlanningActions') Object.assign(style, { flexWrap: 'wrap', height: 'auto' })
  if (
    /^(FleetSummary|OrdersSummary|ForecastSummary|FleetFilters|RecoveryActions|MapControls|OrderToolbar|DeferralActions)$/.test(
      node.name,
    )
  )
    Object.assign(style, { flexWrap: 'wrap', height: 'auto' })
  if (parent && /^(FleetSummary|OrdersSummary|ForecastSummary)$/.test(parent.name))
    Object.assign(style, { flex: '1 0 120px', minHeight: node.box.height })
  if (width < 1200 && node.name === 'LiveTrackingMap')
    Object.assign(style, { minHeight: 540, height: 'auto', overflow: 'hidden' })
  if (width < 1200 && node.name === 'SelectedVehiclePanel')
    Object.assign(style, {
      position: 'relative',
      left: undefined,
      top: undefined,
      right: undefined,
      width: '100%',
      height: 'auto',
      marginTop: 540,
    })
  if (width < 1200 && /^(DeferralRow\/|PriorityOutletBlock)/.test(node.name))
    Object.assign(style, { flexDirection: 'column', height: 'auto' })
  if (width < 1200 && parent && /^(DeferralRow\/|PriorityOutletBlock)/.test(parent.name))
    Object.assign(style, { width: '100%', flex: '0 0 auto' })
  if (width < 1200 && node.name === 'ResponsiveLoadWorkspace')
    Object.assign(style, { flexDirection: 'column', height: 'auto' })
  if (width < 1200 && parent?.name === 'ResponsiveLoadWorkspace')
    Object.assign(style, { width: '100%', flex: '0 0 auto' })
  if (width < 768 && node.name === 'WebHeader')
    Object.assign(style, { flexWrap: 'wrap', height: 'auto', gap: 12 })
  if (width < 768 && parent?.name === 'WebHeader' && node.name === 'Brand')
    Object.assign(style, { width: 'auto', flex: '0 0 auto' })
  if (
    width < 1200 &&
    node.name === 'WebHeader' &&
    node.children?.some((child) => child.name === 'PrimaryNavigation')
  )
    Object.assign(style, { flexWrap: 'wrap', height: 'auto' })
  if (width < 1200 && node.name === 'PrimaryNavigation')
    Object.assign(style, { flex: '0 0 100%', order: 2, flexWrap: 'wrap', height: 'auto' })
  if (
    width < 1200 &&
    node.layoutMode === 'HORIZONTAL' &&
    parent?.name === 'RouteWorkspace' &&
    node.children?.some(
      (child) =>
        child.layoutMode === 'VERTICAL' &&
        child.layoutSizingHorizontal === 'FIXED' &&
        child.box.width >= 350,
    )
  )
    Object.assign(style, { flexDirection: 'column', height: 'auto' })
  if (
    width < 1200 &&
    parent?.layoutMode === 'HORIZONTAL' &&
    parent?.children?.some(
      (child) =>
        child.layoutMode === 'VERTICAL' &&
        child.layoutSizingHorizontal === 'FIXED' &&
        child.box.width >= 350,
    ) &&
    parent.box.width >= 1000 &&
    (parent.name === 'Body' || parent.name === 'Frame')
  )
    Object.assign(style, { width: '100%', flex: '0 0 auto' })
  if (/^(Metrics|ThisWeek)$/.test(node.name))
    Object.assign(style, { flexWrap: 'wrap', height: 'auto' })
  if (parent && /^(Metrics|ThisWeek)$/.test(parent.name))
    Object.assign(style, { flex: '1 0 180px', minHeight: node.box.height })
  if (node.name === 'ForecastChart') style.overflowX = 'auto'
  if (node.name === 'WeeklyColumns') Object.assign(style, { minWidth: 640, maxWidth: undefined })
  if (width < 768 && node.name === 'TwoTripSlots')
    Object.assign(style, { flexDirection: 'column', height: 'auto' })
  if (tableRow(node)) {
    style.maxWidth = undefined
    if (horizontalParent) style.flexShrink = 0
  }
  if (
    /^(IntakeSummary|MetricsRow|MetricCards|SummaryCards|FeatureCards|BrandList|TaskLinks|ActionRow|ActionsRow|HeroButtonRow|ToolbarActions)$/.test(
      node.name,
    )
  )
    Object.assign(style, { flexWrap: 'wrap', height: 'auto' })
  if (width < 768 && /^(PersistentSidebar|Sidebar)$/.test(node.name))
    Object.assign(style, {
      width: '100%',
      height: 'auto',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 12,
      gap: 8,
    })
  if (
    width < 768 &&
    /^(SidebarFlexibleSpace|WorkspaceIdentity)$/.test(node.name) &&
    parent?.name === 'PersistentSidebar'
  )
    style.display = 'none'
  if (width < 768 && parent?.name === 'PersistentSidebar' && /^NavigationItem\//.test(node.name))
    Object.assign(style, { width: 'auto', flex: '0 0 auto' })
  if (
    width < 768 &&
    parent?.name === 'PersistentSidebar' &&
    /^(Brand|WorkspaceLabel|Action\/Switch workspace|Button)$/.test(node.name)
  )
    Object.assign(style, { width: 'auto', flex: '0 0 auto' })
  if (
    width < 768 &&
    /^(PlanningBoard|AllocationWorkspace|ReviewColumns|ReleaseWorkspace|DetailColumns|FormColumns)$/.test(
      node.name,
    )
  )
    Object.assign(style, { flexDirection: 'column', height: 'auto' })
  if (horizontalParent && width < 768 && /^(GlobalSearch|SearchInput)$/.test(node.name))
    style.flex = '1 1 0'
  if (node.name === 'MainContent' && parent?.name === 'Choose your workspace') {
    Object.assign(style, {
      display: 'grid',
      gridTemplateColumns: width >= 768 ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)',
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
      height: 'auto',
      overflow: 'visible',
    })
  }
  if (
    parent?.name === 'MainContent' &&
    /^(Heading|Description|BreadcrumbNavigation)$/.test(node.name)
  )
    style.gridColumn = '1 / -1'
  if (parent?.name === 'MainContent' && node.name.startsWith('ContentCard/')) {
    Object.assign(style, { width: '100%', minHeight: node.box.height, height: 'auto' })
  }
  if (parent?.name.startsWith('ContentCard/') && node.fills.some((fill) => fill.type === 'IMAGE'))
    Object.assign(style, {
      width: `${(node.box.width / parent.box.width) * 100}%`,
      height: 'auto',
      alignSelf: 'stretch',
      minHeight: node.box.height,
    })
  if (parent?.name.startsWith('ContentCard/') && node.name === 'TextCol')
    Object.assign(style, {
      width: `${(node.box.width / parent.box.width) * 100}%`,
      flex: '0 0 auto',
      height: 'auto',
    })
  if (node.name === 'Footer' && !overlay) style.marginTop = 'auto'
  if (width < 1200 && node.name === 'Footer' && node.box.width > 440)
    Object.assign(style, { paddingLeft: 32, paddingRight: 32 })
  if (width < 1200 && node.name === 'FooterTop' && node.box.width > 440)
    Object.assign(style, {
      display: 'flex',
      flexDirection: 'column',
      gap: 32,
      height: 'auto',
    })
  if (
    width < 1200 &&
    node.name === 'LinkColumns' &&
    parent?.name === 'FooterTop' &&
    parent.box.width > 440
  )
    Object.assign(style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
      gap: 24,
      width: '100%',
      height: 'auto',
    })
  if (width < 1200 && parent?.name === 'FooterTop' && parent.box.width > 440)
    Object.assign(style, {
      width: '100%',
      height: 'auto',
      flex: '0 0 auto',
      gridColumn: node.name === 'BrandColumn' ? '1 / -1' : undefined,
    })
  if (width < 768 && node.name === 'StopHeader')
    Object.assign(style, { flexWrap: 'wrap', height: 'auto' })
  if (width < 768 && parent?.name === 'StopHeader' && node.name === 'Outlet')
    Object.assign(style, { flex: '1 0 140px', height: 'auto' })
  if (node.name === 'HeroBand') {
    Object.assign(style, {
      display: 'flex',
      flexDirection: 'column',
      height: 'auto',
      width: '100%',
      minHeight: node.box.height,
    })
  }
  if (node.name === 'StepsRow') {
    Object.assign(style, {
      display: 'grid',
      gridTemplateColumns:
        node.box.width > 440 && width >= 768 ? 'repeat(4,minmax(0,1fr))' : 'minmax(0,1fr)',
      gap: 24,
      height: 'auto',
      minHeight: node.box.height,
    })
  }
  if (node.name === 'FeatureCards')
    Object.assign(style, {
      display: 'grid',
      alignItems: 'stretch',
      gridTemplateColumns: width >= 768 ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)',
      rowGap:
        node.layoutWrap === 'WRAP' && node.children?.[2]
          ? Math.max(0, node.children[2].box.y - node.children[0].box.height) || node.itemSpacing
          : node.itemSpacing,
    })
  if (node.name === 'CallToAction' && node.box.width <= 440) style.minHeight = node.box.height
  if (parent?.name === 'StepsRow' && node.name === 'Connector')
    Object.assign(
      style,
      parent.box.width <= 440
        ? { left: 21, top: 55, width: 2, height: 330, zIndex: 0 }
        : { left: 22, top: 21, width: 'calc(75% + 18px)', height: 2, zIndex: 0 },
    )
  if (node.name === 'MorningRushRow') style.marginTop = 16
  if (node.name === 'MorningRushCopy') Object.assign(style, { gap: 0, minHeight: 420 })
  if (parent?.name === 'MorningRush' && parent.box.width > 440)
    Object.assign(style, { flex: '0 0 50%', width: '50%' })
  if (node.name === 'MorningRushPhoto')
    Object.assign(style, { height: 'auto', minHeight: 420, alignSelf: 'stretch' })
  if (parent?.name === 'MorningRushPhoto')
    Object.assign(style, {
      left: 0,
      top: 0,
      width: `${(node.box.width / parent.box.width) * 100}%`,
      maxWidth: undefined,
      height: `${(node.box.height / parent.box.height) * 100}%`,
    })
  if (parent?.name === 'MorningRushCopy' && node.name === 'Heading') style.marginTop = 13
  if (parent?.name === 'MorningRushCopy' && node.name === 'Body') style.marginTop = 28
  if (node.name === 'MorningRush' && node.box.width > 440)
    Object.assign(style, { minHeight: 420, overflow: 'hidden' })
  if (
    parent?.name === 'MorningRush' &&
    parent.box.width > 440 &&
    node.fills.some((fill) => fill.type === 'IMAGE')
  )
    Object.assign(style, { height: 420, minHeight: 420 })
  if (parent?.name === 'FeatureCards')
    Object.assign(style, {
      width: '100%',
      height: 'auto',
      minHeight: node.box.height,
      alignSelf: 'stretch',
    })
  if (node.name === 'StatsStrip')
    Object.assign(style, { flexWrap: 'wrap', height: 'auto', rowGap: 16 })
  if (width < 1200 && node.name === 'StatsStrip') style.columnGap = 16
  if (width < 1200 && parent?.name === 'StatsStrip' && node.name === 'Sep') style.display = 'none'
  if (parent?.name === 'StepsRow' && node.name !== 'Connector')
    Object.assign(style, {
      zIndex: 1,
      position: 'relative',
      left: undefined,
      top: undefined,
      width: '100%',
      height: 'auto',
    })
  if (root) {
    const workspace = node.children?.some(
      (child) => child.name === 'PersistentSidebar' || child.name === 'RouteWorkspace',
    )
    Object.assign(style, {
      position: 'relative',
      left: undefined,
      top: undefined,
      width: '100%',
      maxWidth: undefined,
      minHeight: overlay ? undefined : '100dvh',
      height: workspace && !overlay ? '100dvh' : 'auto',
      overflow: workspace && !overlay ? 'hidden' : 'visible',
    })
    if (width < 768 && workspace && node.layoutMode === 'HORIZONTAL')
      Object.assign(style, { flexDirection: 'column' })
    if (!workspace && !overlay && node.box.width <= 440) {
      style.alignItems = 'center'
      style.width = '100%'
    }
    if (overlay)
      Object.assign(style, {
        width: Math.min(node.box.width, width - 32),
        maxWidth: '100%',
        height: 'auto',
      })
  }
  if (
    root === false &&
    parent?.box.width &&
    parent.box.width <= 440 &&
    !overlay &&
    width >= 768 &&
    /^(Body|Form|MainContent|Content|PageContent|CurrentTaskSection)$/.test(node.name)
  )
    Object.assign(style, {
      width: '100%',
      maxWidth: node.name === 'MainContent' ? 1200 : 760,
      alignSelf: 'center',
      height: 'auto',
    })
  return style
}
