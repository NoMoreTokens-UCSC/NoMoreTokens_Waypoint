/**
 * Receiving windows for a Fresh outlet. The booklet requires Fresh deliveries to arrive before the
 * stores open at 08:00. A window therefore has to end by then and be long enough to unload. An outlet
 * with its own limits (for example a mall access window) would pass them in; today every Fresh outlet
 * uses these.
 */
export const FRESH_LIMITS = { earliest: '04:00', latest: '08:00', shortest: 60, step: 30 }

export const minutes = (clock: string) => {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}
const clock = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
const range = (from: number, to: number, step: number) => {
  const times: string[] = []
  for (let at = from; at <= to; at += step) times.push(clock(at))
  return times
}

/** Times a window may start at. */
export function startOptions(limits = FRESH_LIMITS) {
  return range(minutes(limits.earliest), minutes(limits.latest) - limits.shortest, limits.step)
}
/** Times a window starting at `start` may end at. */
export function endOptions(start: string, limits = FRESH_LIMITS) {
  return range(minutes(start) + limits.shortest, minutes(limits.latest), limits.step)
}

/** "05:30" → "5:30 AM", "12:00" → "12:00 PM" */
export function formatTime12(time: string) {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const formatWindow = (start: string, end: string) => `${start}–${end}`
const WINDOW = /^(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})$/
export function parseWindow(text: string) {
  const match = WINDOW.exec(text.trim())
  return match ? { start: match[1], end: match[2] } : undefined
}

/** Why a window cannot be used, or nothing when it can. */
export function windowProblem(text: string, limits = FRESH_LIMITS) {
  const window = parseWindow(text)
  if (!window) return 'Choose when you can receive the delivery.'
  if (minutes(window.start) < minutes(limits.earliest))
    return `Receiving cannot start before ${formatTime12(limits.earliest)}.`
  if (minutes(window.end) > minutes(limits.latest))
    return `Fresh goods must arrive before the store opens at ${formatTime12(limits.latest)}.`
  if (minutes(window.end) - minutes(window.start) < limits.shortest)
    return `Allow at least ${limits.shortest} minutes to unload.`
  return undefined
}
