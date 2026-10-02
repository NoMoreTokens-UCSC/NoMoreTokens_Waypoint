import { useInView } from 'framer-motion'
import { ArrowRight, Laptop, Shirt, ShoppingBasket } from 'lucide-react'
import { useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EntryFooter, Wordmark, fieldRoles, rolePhotos, roleTitle } from '../components/EntryChrome'
import {
  CountUp,
  MotionProvider,
  Reveal,
  RunPreview,
  ScrollCue,
  ScrollProgress,
  StickyBar,
} from '../components/WelcomeMotion'

const brands = [
  {
    name: 'Waypoint Fresh',
    count: 80,
    unit: 'supermarkets',
    tone: 'fresh',
    Icon: ShoppingBasket,
    goods: 'Groceries, chilled and frozen goods.',
    schedule: 'Daily · before 8 AM',
  },
  {
    name: 'Waypoint Style',
    count: 25,
    unit: 'fashion outlets',
    tone: 'style',
    Icon: Shirt,
    goods: 'Hanging garments and cartons.',
    schedule: 'Weekly · seasonal peaks',
  },
  {
    name: 'Waypoint Tech',
    count: 15,
    unit: 'electronics outlets',
    tone: 'tech',
    Icon: Laptop,
    goods: 'Appliances and consumer electronics.',
    schedule: 'As needed · fragile, high value',
  },
]
const steps = [
  ['Order', 'Store managers place orders before the 4 PM cutoff.'],
  ['Plan', 'Dispatch allocates orders to vehicles by weight, volume and window.'],
  ['Load', 'Loaders pack each vehicle in the confirmed stop order.'],
  ['Deliver', 'Drivers follow the route and record proof of delivery offline.'],
]
const roleStories: Record<string, { tag: string; text: string; highlight: string }> = {
  dispatcher: {
    tag: '01 / Dispatch',
    text: 'Plans every trip against weight, volume and delivery windows.',
    highlight: 'Plan locked by 16:30',
  },
  'store-manager': {
    tag: '02 / Store',
    text: 'Places orders and sees ETAs and deferral notices in real time.',
    highlight: 'ETA before the van leaves',
  },
  loader: {
    tag: '03 / Dock',
    text: 'Packs each vehicle to the confirmed stop sequence.',
    highlight: 'Crates scanned to stop order',
  },
  driver: {
    tag: '04 / Road',
    text: 'Follows the route and confirms delivery, even offline.',
    highlight: 'Works offline, syncs on signal',
  },
}
const storyOrder = ['dispatcher', 'store-manager', 'loader', 'driver']

/**
 * The welcome page. The motion is there to guide the eye, not to decorate: the hero settles in, the
 * numbers count up, sections appear as they are reached, and the next step stays within reach. All of
 * it stops for people who ask their device to reduce motion.
 */
export default function HomePage() {
  return (
    <MotionProvider>
      <Welcome />
    </MotionProvider>
  )
}

function Welcome() {
  const stories = storyOrder.map((key) => fieldRoles.find((role) => role.key === key)!)
  const stepsRef = useRef<HTMLOListElement>(null)
  const stepsVisible = useInView(stepsRef, { once: true, amount: 0.35 })
  return (
    <div className="entry-page">
      <ScrollProgress />
      <StickyBar />
      <section className="entry-hero">
        <header className="entry-hero-header">
          <Wordmark />
          <nav aria-label="Welcome">
            <Link to="/how-it-works" className="entry-button entry-button-glass entry-hide-mobile">
              How it works
            </Link>
            <Link to="/login" className="entry-button entry-button-primary">
              Log in
            </Link>
          </nav>
        </header>
        <p className="entry-hero-crumb">Home</p>
        <div className="entry-hero-body">
          <div className="entry-hero-copy">
            <Reveal now>
              <p className="entry-eyebrow">Delivery, considered.</p>
            </Reveal>
            <Reveal now delay={0.08}>
              <h1>
                Every delivery.
                <br />A clearer day.
              </h1>
            </Reveal>
            <Reveal now delay={0.18}>
              <p className="entry-hero-lead">
                From the first order to the last receipt. A calmer way to keep Waypoint moving.
              </p>
            </Reveal>
            <Reveal now delay={0.28}>
              <div className="entry-hero-actions">
                <Link
                  to="/workspaces"
                  className="entry-button entry-button-primary entry-cta-arrow"
                >
                  Enter your workspace <ArrowRight size={14} />
                </Link>
                <Link to="/how-it-works" className="entry-button entry-button-glass">
                  Explore the workflow
                </Link>
              </div>
            </Reveal>
            <Reveal now delay={0.38}>
              <dl className="entry-stats">
                <div>
                  <dt>
                    <CountUp to={60} />
                  </dt>
                  <dd>vehicles</dd>
                </div>
                <div>
                  <dt>
                    <CountUp to={120} />
                  </dt>
                  <dd>outlets</dd>
                </div>
                <div>
                  <dt>Before 05:00</dt>
                  <dd>departures</dd>
                </div>
              </dl>
            </Reveal>
          </div>
          <Reveal now x={48} y={0} delay={0.25}>
            <aside className="entry-preview" aria-label="Tomorrow's morning run">
              <p className="entry-eyebrow">Tomorrow, in view</p>
              <h2>
                Ready before
                <br />
                the doors open.
              </h2>
              <RunPreview />
              <p className="entry-preview-note">A shared plan, from depot to store.</p>
            </aside>
          </Reveal>
        </div>
        <ScrollCue target="welcome-brands" />
      </section>

      <section className="entry-section" id="welcome-brands">
        <Reveal>
          <p className="entry-label">One group. One delivery network.</p>
        </Reveal>
        <div className="entry-brands">
          {brands.map((brand, index) => (
            <Reveal key={brand.name} delay={index * 0.1} className="entry-cell">
              <div className={`entry-brand entry-brand-${brand.tone}`}>
                <div className="entry-brand-head">
                  <span className="entry-brand-icon" aria-hidden="true">
                    <brand.Icon size={20} strokeWidth={1.75} />
                  </span>
                  <strong>{brand.name}</strong>
                </div>
                <div className="entry-brand-count">
                  <b>
                    <CountUp to={brand.count} />
                  </b>
                  <span>{brand.unit}</span>
                </div>
                <p>{brand.goods}</p>
                <span className="entry-brand-schedule">{brand.schedule}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="entry-section">
        <Reveal>
          <p className="entry-kicker">The day, end to end</p>
          <h2 className="entry-heading">How it works</h2>
        </Reveal>
        <ol className="entry-steps" ref={stepsRef} data-visible={stepsVisible}>
          {steps.map(([title, text], index) => (
            <li key={title} style={{ '--i': index } as CSSProperties}>
              <span className="entry-step-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="entry-section">
        <Reveal>
          <p className="entry-kicker">Built around the roles</p>
          <h2 className="entry-heading">One plan, every role.</h2>
        </Reveal>
        <div className="entry-role-grid">
          {stories.map((role, index) => {
            const story = roleStories[role.key]
            return (
              <Reveal key={role.key} delay={(index % 2) * 0.1} className="entry-cell">
                <Link to={role.home} className="entry-role-card entry-role-story">
                  <div className="entry-role-text">
                    <span className="entry-role-tag">{story.tag}</span>
                    <h3>{roleTitle(role.label)}</h3>
                    <p>{story.text}</p>
                    <span className="entry-role-highlight">{story.highlight}</span>
                    <span className="entry-role-go">
                      Open workspace <ArrowRight size={13} />
                    </span>
                  </div>
                  <img src={rolePhotos[role.key]} alt="" loading="lazy" />
                </Link>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section className="entry-rush">
        <Reveal x={-32} y={0}>
          <p className="entry-kicker">Operations</p>
          <h2 className="entry-heading">Built for the morning rush.</h2>
          <p>
            Loading windows open before sunrise and close fast. Every screen in Waypoint is built
            around that pressure — clear queues, one tap confirmations, and status that updates the
            moment a crate leaves the dock.
          </p>
        </Reveal>
        <Reveal className="entry-rush-photo" scale={1.06} y={0}>
          <img src="/images/entry/morning-rush.jpg" alt="" loading="lazy" />
        </Reveal>
      </section>

      <section className="entry-cta">
        <Reveal className="entry-cta-inner">
          <h2>A better run starts here.</h2>
          <p>
            One plan, shared by dispatch, stores, loaders and drivers - live from 4 PM cutoff to the
            last receipt.
          </p>
          <Link to="/workspaces" className="entry-button entry-button-light entry-cta-arrow">
            Choose your workspace <ArrowRight size={14} />
          </Link>
        </Reveal>
      </section>
      <EntryFooter />
    </div>
  )
}
