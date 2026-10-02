import { createContext, type CSSProperties, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Layer } from './types'

// Product-only motion. Source inspectors and comparison fixtures remain static.
export const HomeMotionContext = createContext(false)
export const revealEase = [0.22, 1, 0.36, 1] as const

export function homeRevealKind(layer: Layer, parent?: Layer) {
  if (layer.name === 'HeroCopy') return 'hero-copy'
  if (layer.name === 'ProductPreview') return 'hero-preview'
  if (layer.name === 'StepColumn' || layer.name === 'StepRow') return 'home-step'
  if (/^(NetworkCredibility|CoreFeatures|MorningRush|CallToAction)$/.test(layer.name))
    return 'home-section'
  if (parent?.name === 'HowItWorks' && layer.type === 'TEXT') return 'home-text'
  return undefined
}

export function HomeReveal({
  layer,
  kind,
  as,
  style,
  children,
}: {
  layer: Layer
  kind: string
  as: 'div' | 'h1'
  style: CSSProperties
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  const Element = as === 'h1' ? motion.h1 : motion.div
  const hero = kind.startsWith('hero')
  const step = kind === 'home-step'
  const index = step ? Number(layer.id.split('-').at(-1)) || 0 : 0
  const final = { opacity: layer.opacity ?? 1, x: 0, y: 0 }
  return (
    <Element
      data-node={layer.id}
      data-layer={layer.name}
      data-motion={kind}
      data-motion-reduced={Boolean(reduced)}
      style={style}
      initial={
        reduced
          ? false
          : { opacity: 0, x: step ? -24 : kind === 'hero-preview' ? 24 : 0, y: step ? 0 : 20 }
      }
      animate={hero || reduced ? final : undefined}
      whileInView={!hero && !reduced ? final : undefined}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: reduced ? 0 : 0.55,
        delay: reduced ? 0 : index * 0.08,
        ease: revealEase,
      }}
    >
      {children}
    </Element>
  )
}

export function PopupReveal({
  children,
  placement = 'center',
}: {
  children: ReactNode
  placement?: 'center' | 'menu' | 'drawer'
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      data-motion="popup"
      data-motion-reduced={Boolean(reduced)}
      initial={
        reduced
          ? false
          : { opacity: 0, x: placement === 'drawer' ? 24 : 0, y: placement === 'drawer' ? 0 : 10 }
      }
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.22, ease: revealEase }}
    >
      {children}
    </motion.div>
  )
}
