import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BackLink, Wordmark } from '../components/EntryChrome'

const stages = [
  [
    'Order with confidence',
    'Submit before 4 PM. Ambient and chilled Fresh orders remain separate. Confirmation records the request.',
  ],
  [
    'Plan within real limits',
    'Check weight, volume, refrigeration, access, time windows, depot and fuel. Explain every deferral.',
  ],
  [
    'Prepare the right load',
    'Use the stop sequence. Flag missing or damaged goods before departure and acknowledge revisions.',
  ],
  [
    'Deliver and verify',
    'Record evidence offline. Sync when connected. The store confirms receipt and reports discrepancies.',
  ],
]

export default function ServicePage() {
  return (
    <div className="entry-page entry-service">
      <header className="entry-bar">
        <Wordmark />
      </header>
      <section className="entry-service-intro">
        <BackLink trail={[]} />
        <p className="entry-kicker">The Waypoint workflow</p>
        <h1>
          One order.
          <br />
          Every handoff, connected.
        </h1>
        <p className="entry-service-lead">
          See how a request becomes a feasible plan, a prepared load and a verified delivery.
        </p>
      </section>
      <section className="entry-service-stages">
        <ol>
          {stages.map(([title, text], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="entry-service-network">
        <h2>Built for this network.</h2>
        <p>
          120 outlets · 60 vehicles · 2 depots
          <br />
          Fresh · Style · Tech
        </p>
      </section>
      <section className="entry-service-next">
        <h2>Find your next action.</h2>
        <Link to="/workspaces" className="entry-button entry-button-primary">
          Open your workspace <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  )
}
