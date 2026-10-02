import { useNavigate } from 'react-router-dom'
import { ScenarioPanel } from '../shared/organisms/ScenarioPanel'

export default function DemoPage() {
  const navigate = useNavigate()
  return (
    <main className="figma-reference-index">
      <h1>Development scenarios</h1>
      <ScenarioPanel
        open
        onOpenChange={(open) => {
          if (!open) navigate('/workspaces')
        }}
      />
    </main>
  )
}
