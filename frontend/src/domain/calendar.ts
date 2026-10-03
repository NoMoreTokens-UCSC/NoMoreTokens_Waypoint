/**
 * Operating calendar helpers. Waypoint delivers Monday to Saturday in Sri Lanka time
 * (UTC+05:30, no daylight saving). Pure functions, so a server can reuse them.
 */
export const TIME_ZONE = 'Asia/Colombo'
const DAY = 24 * 60 * 60 * 1000
/** Local clock time at which orders for the next operating day close. */
export const CUTOFF = '16:00'

/** Day of week in Sri Lanka, 0 = Sunday. */
const weekday = (date: Date) => new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000).getUTCDay()

export const isOperatingDay = (date: Date) => weekday(date) !== 0

/** The next day deliveries run after `date`'s day (Friday → Saturday, Saturday → Monday). */
export function nextOperatingDay(date: Date): Date {
  let next = new Date(date.getTime() + DAY)
  while (!isOperatingDay(next)) next = new Date(next.getTime() + DAY)
  return next
}

const parts = (date: Date | string, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, ...options })
      .formatToParts(new Date(date))
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>

// Built from parts, not a locale pattern, so the text is identical on every browser and runtime.
/** "Saturday, 26 September" */
export function formatLongDate(date: Date | string) {
  const p = parts(date, { weekday: 'long', day: 'numeric', month: 'long' })
  return `${p.weekday}, ${p.day} ${p.month}`
}
/** "26 Sep" */
export function formatShortDate(date: Date | string) {
  const p = parts(date, { day: 'numeric', month: 'long' })
  return `${p.day} ${p.month.slice(0, 3)}`
}
/** "05:41" */
export function formatClock(date: Date | string) {
  const p = parts(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${p.hour}:${p.minute}`
}
/** "Friday" */
export const formatWeekday = (date: Date | string) => parts(date, { weekday: 'long' }).weekday

/** Minutes from `now` until today's cutoff (negative once it has passed). */
export function minutesToCutoff(now: Date) {
  const [hours, minutes] = formatClock(now).split(':').map(Number)
  const [cutoffHours, cutoffMinutes] = CUTOFF.split(':').map(Number)
  return cutoffHours * 60 + cutoffMinutes - (hours * 60 + minutes)
}
