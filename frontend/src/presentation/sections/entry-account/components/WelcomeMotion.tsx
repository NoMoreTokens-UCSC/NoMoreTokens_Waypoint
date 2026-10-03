import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  animate,
  domAnimation,
  m,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { revealEase } from '../../../shared/lib/motion'
import { Wordmark } from './EntryChrome'

/** Loads only the animation features the welcome page uses, and honours "reduce motion". */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}

/** Fades and lifts its content in once, when it scrolls into view (or at load with `now`). */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  x = 0,
  scale = 1,
  now = false,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  x?: number
  scale?: number
  /** Animate on load instead of waiting for the scroll (above the fold). */
  now?: boolean
  className?: string
}) {
  const start = { opacity: 0, y, x, scale }
  const end = { opacity: 1, y: 0, x: 0, scale: 1 }
  const transition = { duration: 0.7, delay, ease: revealEase }
  return now ? (
    <m.div className={className} initial={start} animate={end} transition={transition}>
      {children}
    </m.div>
  ) : (
    <m.div
      className={className}
      initial={start}
      whileInView={end}
      viewport={{ once: true, amount: 0.25 }}
      transition={transition}
    >
      {children}
    </m.div>
  )
}

/** A number that counts up when it scrolls into view. Screen readers get the final value. */
export function CountUp({ to, duration = 1.4 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduced = useReducedMotion()
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!inView || reduced) return
    const controls = animate(0, to, {
      duration,
      ease: revealEase,
      onUpdate: (latest) => setValue(Math.round(latest)),
    })
    return () => controls.stop()
  }, [inView, reduced, to, duration])
  return (
    <>
      <span ref={ref} aria-hidden="true">
        {reduced ? to : value}
      </span>
      <span className="sr-only">{to}</span>
    </>
  )
}

/** A thin bar across the top that fills as the page is read. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 24, mass: 0.2 })
  return <m.div className="entry-progress" style={{ scaleX }} aria-hidden="true" />
}

/** A compact bar that slides in once the hero has scrolled away, so the next step is always close. */
export function StickyBar() {
  const { scrollY } = useScroll()
  const [shown, setShown] = useState(false)
  useMotionValueEvent(scrollY, 'change', (latest) => setShown(latest > 560))
  return (
    <AnimatePresence>
      {shown && (
        <m.header
          className="entry-sticky"
          initial={{ y: -72, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -72, opacity: 0 }}
          transition={{ duration: 0.35, ease: revealEase }}
        >
          <Wordmark />
          <nav aria-label="Quick links">
            <Link to="/how-it-works" className="entry-sticky-link">
              How it works
            </Link>
            <Link to="/workspaces" className="entry-button entry-button-primary entry-sticky-cta">
              Enter your workspace <ArrowRight size={14} />
            </Link>
          </nav>
        </m.header>
      )}
    </AnimatePresence>
  )
}

/** A small "scroll" cue at the bottom of the hero that jumps to the next section. */
export function ScrollCue({ target }: { target: string }) {
  return (
    <button
      type="button"
      className="entry-scroll-cue"
      aria-label="Scroll to the next section"
      onClick={() =>
        document.getElementById(target)?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
          block: 'start',
        })
      }
    >
      <span>Scroll</span>
      <i aria-hidden="true" />
    </button>
  )
}

const stages = ['Ready to load', 'Loading', 'On the road', 'Delivered'] as const

/** One row of the morning-run preview that moves through the day's stages, one after another. */
function RunRow({ time, outlet, offset }: { time: string; outlet: string; offset: number }) {
  const reduced = useReducedMotion()
  const [stage, setStage] = useState(offset)
  useEffect(() => {
    if (reduced) return
    const timer = window.setInterval(
      () => setStage((current) => (current + 1) % stages.length),
      2400,
    )
    return () => window.clearInterval(timer)
  }, [reduced])
  const label = stages[stage % stages.length]
  return (
    <p>
      {time}&nbsp; Fresh · {outlet}
      <small className="entry-run-status" data-stage={stage % stages.length}>
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {label}
          </m.span>
        </AnimatePresence>
      </small>
    </p>
  )
}

/** The preview card: the run's stops move through their stages, and the card tilts toward the pointer. */
export function RunPreview() {
  const reduced = useReducedMotion()
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const tiltX = useSpring(rotateX, { stiffness: 140, damping: 18 })
  const tiltY = useSpring(rotateY, { stiffness: 140, damping: 18 })
  return (
    <m.div
      className="entry-preview-tilt"
      style={reduced ? undefined : { rotateX: tiltX, rotateY: tiltY, transformPerspective: 900 }}
      onPointerMove={(event) => {
        if (reduced || event.pointerType === 'touch') return
        const box = event.currentTarget.getBoundingClientRect()
        rotateY.set(((event.clientX - box.left) / box.width - 0.5) * 6)
        rotateX.set(-((event.clientY - box.top) / box.height - 0.5) * 6)
      }}
      onPointerLeave={() => {
        rotateX.set(0)
        rotateY.set(0)
      }}
    >
      <div className="entry-preview-card">
        <span className="entry-chip">
          <i className="entry-live" aria-hidden="true" />
          Fresh · Morning run
        </span>
        <strong>Peliyagoda → Colombo</strong>
        <div className="entry-route" aria-hidden="true">
          <span />
          <i />
          <span />
        </div>
        <RunRow time="05:40" outlet="OUT001" offset={0} />
        <RunRow time="06:15" outlet="OUT008" offset={2} />
      </div>
    </m.div>
  )
}
