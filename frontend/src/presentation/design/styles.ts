import type { CSSProperties } from 'react'
import type { Layer, Paint, TextStyle } from './types'
export function color(value?: { r: number; g: number; b: number; a?: number }, opacity = 1) {
  return value
    ? `rgba(${Math.round(value.r * 255)},${Math.round(value.g * 255)},${Math.round(value.b * 255)},${(value.a ?? 1) * opacity})`
    : 'transparent'
}
export function paintBackground(
  paints: Paint[],
  images: Record<string, string>,
  dimensions = { width: 1, height: 1 },
): CSSProperties {
  const backgrounds: string[] = []
  const sizes: string[] = []
  const positions: string[] = []
  let backgroundColor = 'transparent'
  for (const paint of paints.filter((p) => p.visible !== false)) {
    if (paint.type === 'SOLID') backgroundColor = color(paint.color, paint.opacity)
    if (paint.type === 'IMAGE' && paint.imageRef && images[paint.imageRef]) {
      backgrounds.unshift(`url("${images[paint.imageRef]}")`)
      let backgroundSize =
        paint.scaleMode === 'FIT'
          ? 'contain'
          : paint.scaleMode === 'STRETCH'
            ? '100% 100%'
            : 'cover'
      let backgroundPosition = 'center'
      const matrix = paint.imageTransform
      if (matrix && !matrix[0][1] && !matrix[1][0] && matrix[0][0] > 0 && matrix[1][1] > 0) {
        const horizontalScale = matrix[0][0],
          verticalScale = matrix[1][1]
        backgroundSize = `${100 / horizontalScale}% ${100 / verticalScale}%`
        backgroundPosition = `${Math.abs(1 - horizontalScale) > 0.00001 ? (matrix[0][2] / (1 - horizontalScale)) * 100 : 50}% ${Math.abs(1 - verticalScale) > 0.00001 ? (matrix[1][2] / (1 - verticalScale)) * 100 : 50}%`
      }
      sizes.unshift(backgroundSize)
      positions.unshift(backgroundPosition)
    }
    if (paint.type === 'GRADIENT_LINEAR') {
      const points = paint.gradientHandlePositions ?? [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
      ]
      const dx = (points[1].x - points[0].x) * dimensions.width
      const dy = (points[1].y - points[0].y) * dimensions.height
      const length = Math.hypot(dx, dy) || 1
      const cssLength =
        (Math.abs(dx) * dimensions.width + Math.abs(dy) * dimensions.height) / length || 1
      const start =
        0.5 +
        ((points[0].x - 0.5) * dimensions.width * dx +
          (points[0].y - 0.5) * dimensions.height * dy) /
          length /
          cssLength
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90
      backgrounds.unshift(
        `linear-gradient(${angle}deg,${paint.gradientStops?.map((stop) => `${color(stop.color, paint.opacity)} ${(start + (stop.position * length) / cssLength) * 100}%`).join(',')})`,
      )
      sizes.unshift('100% 100%')
      positions.unshift('0 0')
    }
    if (paint.type === 'GRADIENT_RADIAL') {
      const [
        center = { x: 0.5, y: 0.5 },
        horizontal = { x: 1, y: 0.5 },
        vertical = { x: 0.5, y: 1 },
      ] = paint.gradientHandlePositions ?? []
      const matrix = [
        (horizontal.x - center.x) * dimensions.width,
        (horizontal.y - center.y) * dimensions.height,
        (vertical.x - center.x) * dimensions.width,
        (vertical.y - center.y) * dimensions.height,
        center.x * dimensions.width,
        center.y * dimensions.height,
      ].join(' ')
      const stops =
        paint.gradientStops
          ?.map(
            (stop) =>
              `<stop offset="${stop.position}" stop-color="${color(stop.color, paint.opacity)}"/>`,
          )
          .join('') ?? ''
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}"><defs><radialGradient id="paint" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="matrix(${matrix})">${stops}</radialGradient></defs><rect width="100%" height="100%" fill="url(#paint)"/></svg>`
      backgrounds.unshift(`url("data:image/svg+xml,${encodeURIComponent(svg)}")`)
      sizes.unshift('100% 100%')
      positions.unshift('0 0')
    }
  }
  return {
    backgroundColor,
    backgroundImage: backgrounds.join(',') || undefined,
    backgroundSize: backgrounds.length ? sizes.join(',') : undefined,
    backgroundPosition: backgrounds.length ? positions.join(',') : undefined,
    backgroundRepeat: 'no-repeat',
  }
}
export function textStyle(style?: TextStyle, fills?: Paint[]): CSSProperties {
  return {
    fontFamily: `'${style?.fontFamily ?? 'DM Sans'}',sans-serif`,
    fontSize: style?.fontSize ?? 14,
    fontWeight: style?.fontWeight ?? 400,
    fontStyle: style?.italic ? 'italic' : undefined,
    fontOpticalSizing: 'auto',
    lineHeight: style?.lineHeightPx ? `${style.lineHeightPx}px` : 'normal',
    letterSpacing: style?.letterSpacing ?? 0,
    textAlign: (style?.textAlignHorizontal?.toLowerCase() ?? 'left') as CSSProperties['textAlign'],
    textDecoration:
      style?.textDecoration === 'UNDERLINE'
        ? 'underline'
        : style?.textDecoration === 'STRIKETHROUGH'
          ? 'line-through'
          : undefined,
    color: color(fills?.find((p) => p.type === 'SOLID')?.color),
    // Match the grayscale text compositing used by Figma's exported frames.
    filter: 'opacity(1)',
    whiteSpace:
      style?.textAutoResize === 'TRUNCATE'
        ? 'nowrap'
        : style?.textAutoResize === 'WIDTH_AND_HEIGHT'
          ? 'pre'
          : 'pre-wrap',
    overflow: style?.textAutoResize === 'TRUNCATE' ? 'hidden' : undefined,
    textOverflow: style?.textTruncation === 'ENDING' ? 'ellipsis' : undefined,
    overflowWrap: 'normal',
  }
}
export function layerStyle(
  layer: Layer,
  images: Record<string, string>,
  root = false,
): CSSProperties {
  const shadows = layer.effects
    ?.filter((e) => e.visible !== false && /SHADOW/.test(e.type))
    .map(
      (e) =>
        `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${e.offset?.x ?? 0}px ${e.offset?.y ?? 0}px ${e.radius ?? 0}px ${e.spread ?? 0}px ${color(e.color)}`,
    )
  const stroke = layer.strokes.find((p) => p.visible !== false && p.type === 'SOLID')
  return {
    position: root ? 'relative' : 'absolute',
    left: root ? undefined : layer.box.x,
    top: root ? undefined : layer.box.y,
    width: layer.box.width,
    height: layer.box.height,
    opacity: layer.opacity,
    ...paintBackground(layer.type === 'TEXT' ? [] : layer.fills, images, layer.box),
    borderRadius:
      layer.type === 'ELLIPSE'
        ? '50%'
        : (layer.rectangleCornerRadii?.map((v) => `${v}px`).join(' ') ?? layer.cornerRadius),
    boxShadow: shadows?.join(',') || undefined,
    outline:
      stroke && layer.strokeWeight
        ? `${layer.strokeWeight}px solid ${color(stroke.color, stroke.opacity)}`
        : undefined,
    outlineOffset:
      stroke && layer.strokeWeight
        ? layer.strokeAlign === 'INSIDE'
          ? -layer.strokeWeight
          : layer.strokeAlign === 'CENTER'
            ? -layer.strokeWeight / 2
            : 0
        : undefined,
    overflow: layer.clipsContent ? 'hidden' : undefined,
    overflowY: layer.overflowDirection === 'VERTICAL_SCROLLING' ? 'auto' : undefined,
    ...(layer.type === 'TEXT' ? textStyle(layer.style, layer.fills) : {}),
  }
}
