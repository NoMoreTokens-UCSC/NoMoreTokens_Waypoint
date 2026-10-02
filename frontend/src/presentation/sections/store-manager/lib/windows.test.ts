import { describe, expect, it } from 'vitest'
import { endOptions, formatTime12, startOptions, windowProblem } from './windows'

describe('receiving windows', () => {
  it('reads times in 12-hour form', () => {
    expect(formatTime12('05:30')).toBe('5:30 AM')
    expect(formatTime12('08:00')).toBe('8:00 AM')
    expect(formatTime12('00:15')).toBe('12:15 AM')
    expect(formatTime12('12:00')).toBe('12:00 PM')
    expect(formatTime12('13:05')).toBe('1:05 PM')
  })
  it('only offers times that satisfy the Fresh rules', () => {
    expect(startOptions().at(0)).toBe('04:00')
    expect(startOptions().at(-1)).toBe('07:00')
    expect(endOptions('05:30')).toEqual(['06:30', '07:00', '07:30', '08:00'])
    expect(endOptions('07:00')).toEqual(['08:00'])
  })
  it('accepts a good window and explains a bad one', () => {
    expect(windowProblem('05:30–07:30')).toBeUndefined()
    expect(windowProblem('06:00–08:00')).toBeUndefined()
    expect(windowProblem('')).toMatch(/Choose when/)
    expect(windowProblem('07:00–08:30')).toBe(
      'Fresh goods must arrive before the store opens at 8:00 AM.',
    )
    expect(windowProblem('03:00–05:00')).toBe('Receiving cannot start before 4:00 AM.')
    expect(windowProblem('07:00–07:30')).toBe('Allow at least 60 minutes to unload.')
  })
})
