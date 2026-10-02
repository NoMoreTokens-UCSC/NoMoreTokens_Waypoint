import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
export function PlanningSteps({ current }: { current: number }) {
  const steps = [
    ['Order queue', '/dispatcher/orders'],
    ['Allocation', '/dispatcher/planning'],
    ['Deferrals', '/dispatcher/deferrals'],
    ['Review', '/dispatcher/review'],
    ['Release', '/dispatcher/release'],
    ['Live', '/dispatcher/tracking'],
  ]
  return (
    <nav className="stepper" aria-label="Planning stages">
      {steps.map(([label, path], i) => (
        <Link
          key={label}
          to={path}
          className={`step ${i === current ? 'step-current' : i < current ? 'step-done' : ''}`}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="step-number">{i < current ? <Check size={12} /> : `0${i + 1}`}</span>
          {label}
        </Link>
      ))}
    </nav>
  )
}
