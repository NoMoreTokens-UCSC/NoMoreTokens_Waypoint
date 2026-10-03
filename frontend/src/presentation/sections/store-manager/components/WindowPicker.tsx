import type { ReceivingLimits } from '../../../../domain/outlets'
import {
  FRESH_LIMITS,
  endOptions,
  formatTime12,
  formatWindow,
  minutes,
  parseWindow,
  startOptions,
} from '../lib/windows'

/** The listed times, plus the current one so a saved window with an unusual time still shows. */
const withCurrent = (options: string[], current: string) =>
  current && !options.includes(current) ? [current, ...options].sort() : options

/** "2 hours", "1 hour 30 minutes" */
function lengthText(total: number) {
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return [hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '', rest ? `${rest} minutes` : '']
    .filter(Boolean)
    .join(' ')
}

/**
 * Chooses a receiving window without typing: a start and an end time from lists that only contain
 * times the booklet's Fresh rules allow (end by 8:00 AM, long enough to unload). Times read in
 * 12-hour form; the stored value stays 24-hour ("05:30–07:30").
 */
export function WindowPicker({
  label = 'Receiving window',
  value,
  error,
  limits = FRESH_LIMITS,
  onChange,
}: {
  label?: string
  limits?: ReceivingLimits
  value: string
  error?: string
  onChange: (window: string) => void
}) {
  const current = parseWindow(value)
  const start = current?.start ?? ''
  const end = current?.end ?? ''
  const changeStart = (next: string) => {
    // Keep the same length of window where possible, otherwise the closest end that is allowed.
    const length = start && end ? minutes(end) - minutes(start) : 120
    const options = endOptions(next, limits)
    const wanted = minutes(next) + length
    const kept = [...options].reverse().find((time) => minutes(time) <= wanted)
    onChange(formatWindow(next, kept ?? options[0]))
  }
  return (
    <fieldset className="sm-window">
      <legend>{label}</legend>
      <div className="sm-window-range">
        <label>
          <span>From</span>
          <select
            value={start}
            aria-invalid={Boolean(error)}
            onChange={(event) => changeStart(event.target.value)}
          >
            {!start && <option value="">Choose…</option>}
            {withCurrent(startOptions(limits), start).map((time) => (
              <option key={time} value={time}>
                {formatTime12(time)}
              </option>
            ))}
          </select>
        </label>
        <span className="sm-window-to" aria-hidden="true">
          to
        </span>
        <label>
          <span>To</span>
          <select
            value={end}
            disabled={!start}
            aria-invalid={Boolean(error)}
            onChange={(event) => onChange(formatWindow(start, event.target.value))}
          >
            {withCurrent(start ? endOptions(start, limits) : [], end).map((time) => (
              <option key={time} value={time}>
                {formatTime12(time)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <small role="alert" className="sm-window-error">
          {error}
        </small>
      ) : (
        <small>
          {current
            ? `${formatTime12(start)} to ${formatTime12(end)} · ${lengthText(minutes(end) - minutes(start))}. `
            : ''}
          {limits.reason}
        </small>
      )}
    </fieldset>
  )
}
