import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EntryFooter, Wordmark, fieldRoles, rolePhotos, roleTitle } from '../components/EntryChrome'

const brands = [
  { name: 'Waypoint Fresh', detail: '80 supermarkets', tone: 'fresh' },
  { name: 'Waypoint Style', detail: '25 fashion outlets', tone: 'style' },
  { name: 'Waypoint Tech', detail: '15 electronics outlets', tone: 'tech' },
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

export default function HomePage() {
  const stories = storyOrder.map((key) => fieldRoles.find((role) => role.key === key)!)
  return (
    <div className="entry-page">
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
            <p className="entry-eyebrow">Delivery, considered.</p>
            <h1>
              Every delivery.
              <br />A clearer day.
            </h1>
            <p className="entry-hero-lead">
              From the first order to the last receipt. A calmer way to keep Waypoint moving.
            </p>
            <div className="entry-hero-actions">
              <Link to="/workspaces" className="entry-button entry-button-primary">
                Enter your workspace <ArrowRight size={14} />
              </Link>
              <Link to="/how-it-works" className="entry-button entry-button-glass">
                Explore the workflow
              </Link>
            </div>
            <dl className="entry-stats">
              <div>
                <dt>60</dt>
                <dd>vehicles</dd>
              </div>
              <div>
                <dt>120</dt>
                <dd>outlets</dd>
              </div>
              <div>
                <dt>Before 05:00</dt>
                <dd>departures</dd>
              </div>
            </dl>
          </div>
          <aside className="entry-preview" aria-label="Tomorrow's morning run">
            <p className="entry-eyebrow">Tomorrow, in view</p>
            <h2>
              Ready before
              <br />
              the doors open.
            </h2>
            <div className="entry-preview-card">
              <span className="entry-chip">Fresh · Morning run</span>
              <strong>Peliyagoda → Colombo</strong>
              <p>
                05:40&nbsp; Fresh · OUT001<small>Ready to load</small>
              </p>
              <p>
                06:15&nbsp; Fresh · OUT008<small>Window confirmed</small>
              </p>
            </div>
            <p className="entry-preview-note">A shared plan, from depot to store.</p>
          </aside>
        </div>
      </section>

      <section className="entry-section">
        <p className="entry-label">One group. One delivery network.</p>
        <div className="entry-brands">
          {brands.map((brand) => (
            <div key={brand.name} className="entry-brand">
              <strong className={`entry-brand-${brand.tone}`}>{brand.name}</strong>
              <span>{brand.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="entry-section">
        <p className="entry-kicker">The day, end to end</p>
        <h2 className="entry-heading">How it works</h2>
        <ol className="entry-steps">
          {steps.map(([title, text], index) => (
            <li key={title}>
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
        <p className="entry-kicker">Built around the roles</p>
        <h2 className="entry-heading">One plan, every role.</h2>
        <div className="entry-role-grid">
          {stories.map((role) => {
            const story = roleStories[role.key]
            return (
              <Link key={role.key} to={role.home} className="entry-role-card entry-role-story">
                <div className="entry-role-text">
                  <span className="entry-role-tag">{story.tag}</span>
                  <h3>{roleTitle(role.label)}</h3>
                  <p>{story.text}</p>
                  <span className="entry-role-highlight">{story.highlight}</span>
                </div>
                <img src={rolePhotos[role.key]} alt="" loading="lazy" />
              </Link>
            )
          })}
        </div>
      </section>

      <section className="entry-rush">
        <div>
          <p className="entry-kicker">Operations</p>
          <h2 className="entry-heading">Built for the morning rush.</h2>
          <p>
            Loading windows open before sunrise and close fast. Every screen in Waypoint is built
            around that pressure — clear queues, one tap confirmations, and status that updates the
            moment a crate leaves the dock.
          </p>
        </div>
        <img src="/images/entry/morning-rush.jpg" alt="" loading="lazy" />
      </section>

      <section className="entry-cta">
        <h2>A better run starts here.</h2>
        <p>
          One plan, shared by dispatch, stores, loaders and drivers - live from 4 PM cutoff to the
          last receipt.
        </p>
        <Link to="/workspaces" className="entry-button entry-button-light">
          Choose your workspace <ArrowRight size={14} />
        </Link>
      </section>
      <EntryFooter />
    </div>
  )
}
