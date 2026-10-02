import { Link } from 'react-router-dom'
import OperationsMap from '../shared/organisms/OperationsMap'
import { useOperations } from '../hooks/useOperations'

/** Development map integration; source map compositions remain unchanged. */
export default function DemoMapPage() {
  const { data } = useOperations()
  return (
    <main className="figma-reference-index">
      <h1>Demo map integration</h1>
      <p>Illustrative coordinates. OpenStreetMap tiles require a connection.</p>
      <Link to="/demo">Development scenarios</Link>
      {data && (
        <OperationsMap
          vehicles={data.vehicles}
          stops={data.stops}
          offline={data.settings.simulatedOffline}
        />
      )}
    </main>
  )
}
