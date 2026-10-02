import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatLongDate,
  formatShortDate,
  isOperatingDay,
  minutesToCutoff,
  nextOperatingDay,
} from './calendar'

const friday = new Date('2026-09-25T15:42:00+05:30')

describe('operating calendar', () => {
  it('delivers on the next day, skipping Sunday', () => {
    expect(formatLongDate(nextOperatingDay(friday))).toBe('Saturday, 26 September')
    expect(formatLongDate(nextOperatingDay(new Date('2026-09-26T10:00:00+05:30')))).toBe(
      'Monday, 28 September',
    )
  })
  it('knows Sunday is not an operating day', () => {
    expect(isOperatingDay(new Date('2026-09-27T09:00:00+05:30'))).toBe(false)
    expect(isOperatingDay(new Date('2026-09-28T09:00:00+05:30'))).toBe(true)
  })
  it('counts minutes to the 16:00 cutoff in Sri Lanka time', () => {
    expect(minutesToCutoff(friday)).toBe(18)
    expect(minutesToCutoff(new Date('2026-09-25T16:02:00+05:30'))).toBe(-2)
  })
  it('formats in Sri Lanka time regardless of the browser zone', () => {
    expect(formatClock('2026-09-26T00:11:00.000Z')).toBe('05:41')
    expect(formatShortDate('2026-09-25T10:12:00.000Z')).toBe('25 Sep')
  })
})
