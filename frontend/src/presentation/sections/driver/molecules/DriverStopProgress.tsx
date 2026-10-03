import type { DriverStopState } from '../hooks/useDriverData'

export function DriverStopProgress({ state }: { state: DriverStopState }) {
  const step =
    state.proof === 'accepted'
      ? 3
      : state.record || state.draft
        ? 2
        : state.stop?.status === 'Arrived'
          ? 1
          : 0
  return (
    <ol
      aria-label="Delivery progress"
      className="grid grid-cols-2 gap-2 text-xs min-[480px]:grid-cols-4"
    >
      {['Assigned outlet', 'Arrived & parked', 'Proof & manager review', 'Delivery accepted'].map(
        (label, index) => (
          <li
            key={label}
            aria-current={index === step ? 'step' : undefined}
            className={`min-w-0 rounded-lg border p-3 leading-relaxed ${index === step ? 'border-primary bg-primary/10 font-semibold' : index < step ? 'border-success/30 bg-success/5' : 'border-border text-muted-foreground'}`}
          >
            <span className="mr-2" aria-hidden="true">
              {index < step ? '✓' : index + 1}
            </span>
            {label}
          </li>
        ),
      )}
    </ol>
  )
}
