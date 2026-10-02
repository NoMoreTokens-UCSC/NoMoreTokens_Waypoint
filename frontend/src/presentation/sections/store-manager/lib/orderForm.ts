import { useSyncExternalStore } from 'react'
import type { Order, StoreOrderInput, Temperature } from '../../../../domain/models'
import { temperatures, windowText } from './orderView'
import { windowProblem, parseWindow } from './windows'

/** What the person entered for one order, as text so half-typed numbers are kept. */
export interface FieldValues {
  cases: string
  weight: string
  volume: string
  window: string
  /** True once weight or volume was changed by hand; cases then stop updating them. */
  adjusted?: boolean
}
interface Edits {
  values: Partial<Record<Temperature, FieldValues>>
  /** Orders the person chose not to place this time (chilled is not ordered every day). */
  skipped: Partial<Record<Temperature, boolean>>
}

const KEY = 'waypoint.store.orderForm'
const empty = (): Edits => ({ values: {}, skipped: {} })
let edits: Edits = read()
const listeners = new Set<() => void>()

function read(): Edits {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Edits | null
    return stored?.values && stored.skipped ? stored : empty()
  } catch {
    return empty()
  }
}
function write(next: Edits) {
  edits = next
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Session storage can be unavailable; the form still works until the page is closed.
  }
  listeners.forEach((listener) => listener())
}

const defaultWindow: Record<Temperature, string> = {
  Chilled: '05:30–07:30',
  Ambient: '06:00–08:00',
}
/** Typical weight and volume of one case, used until an order or the person says otherwise. */
const typicalCase: Record<Temperature, { kg: number; m3: number }> = {
  Chilled: { kg: 20 / 3, m3: 1 / 15 },
  Ambient: { kg: 10, m3: 0.1 },
}
const round = (value: number, places: number) => String(Number(value.toFixed(places)))

/** The weight and volume to suggest for a number of cases. */
export function estimateLoad(temperature: Temperature, cases: number, basis?: Order) {
  const per =
    basis && basis.cases > 0
      ? { kg: basis.weight / basis.cases, m3: basis.volume / basis.cases }
      : typicalCase[temperature]
  return cases > 0
    ? { weight: round(per.kg * cases, 0), volume: round(per.m3 * cases, 2) }
    : { weight: '', volume: '' }
}

/** The saved order's values, or a blank form with the usual window. */
export function valuesFromOrder(temperature: Temperature, order?: Order): FieldValues {
  return order
    ? {
        cases: String(order.cases),
        weight: String(order.weight),
        volume: String(order.volume),
        window: windowText(order),
      }
    : { cases: '', weight: '', volume: '', window: defaultWindow[temperature] }
}

export interface OrderForm {
  values: Record<Temperature, FieldValues>
  /** Whether each order is part of this submission. */
  included: Record<Temperature, boolean>
  /** True once the person has changed something since the last confirmation. */
  dirty: boolean
  change: (temperature: Temperature, field: 'cases' | 'weight' | 'volume', value: string) => void
  stepCases: (temperature: Temperature, by: number) => void
  setWindow: (temperature: Temperature, window: string) => void
  setIncluded: (temperature: Temperature, included: boolean) => void
  reset: () => void
}

/** Form state shared by the create, review and cutoff screens; survives navigation and reloads. */
export function useOrderForm(orders: Order[]): OrderForm {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => edits,
  )
  const saved = (temperature: Temperature) =>
    orders.find((order) => order.temperature === temperature)
  const values = Object.fromEntries(
    temperatures.map((temperature) => [
      temperature,
      current.values[temperature] ?? valuesFromOrder(temperature, saved(temperature)),
    ]),
  ) as Record<Temperature, FieldValues>
  const included = Object.fromEntries(
    temperatures.map((temperature) => [temperature, !current.skipped[temperature]]),
  ) as Record<Temperature, boolean>
  const update = (temperature: Temperature, next: FieldValues) =>
    write({ ...edits, values: { ...edits.values, [temperature]: next } })
  const setCases = (temperature: Temperature, text: string) => {
    const value = values[temperature]
    const cases = Number(text)
    // Until weight and volume are entered by hand they follow the number of cases.
    const load =
      value.adjusted || text.trim() === '' || !Number.isFinite(cases)
        ? {}
        : estimateLoad(temperature, cases, saved(temperature))
    update(temperature, { ...value, cases: text, ...load })
  }
  return {
    values,
    included,
    dirty:
      temperatures.some((temperature) => Boolean(current.values[temperature])) ||
      temperatures.some((temperature) => current.skipped[temperature]),
    change: (temperature, field, value) =>
      field === 'cases'
        ? setCases(temperature, value)
        : update(temperature, { ...values[temperature], [field]: value, adjusted: true }),
    stepCases: (temperature, by) => {
      const next = Math.min(100, Math.max(1, (Number(values[temperature].cases) || 0) + by))
      setCases(temperature, String(next))
    },
    setWindow: (temperature, window) => update(temperature, { ...values[temperature], window }),
    setIncluded: (temperature, include) =>
      write({ ...edits, skipped: { ...edits.skipped, [temperature]: !include } }),
    reset: () => write(empty()),
  }
}

export type FormErrors = Partial<Record<Temperature, Partial<Record<keyof FieldValues, string>>>>

/**
 * Turns the entered values into order inputs for the included orders, or the problems to show next
 * to each field. At least one order must be included.
 */
export function parseForm(
  values: Record<Temperature, FieldValues>,
  included: Record<Temperature, boolean>,
) {
  const errors: FormErrors = {}
  const inputs: StoreOrderInput[] = []
  for (const temperature of temperatures) {
    if (!included[temperature]) continue
    const value = values[temperature]
    const problems: Partial<Record<keyof FieldValues, string>> = {}
    const cases = Number(value.cases)
    const weight = Number(value.weight)
    const volume = Number(value.volume)
    if (!Number.isInteger(cases) || cases < 1 || cases > 100)
      problems.cases = 'Enter 1 to 100 cases.'
    if (!(weight > 0)) problems.weight = 'Enter the weight in kg.'
    if (!(volume > 0)) problems.volume = 'Enter the volume in m³.'
    const windowError = windowProblem(value.window)
    if (windowError) problems.window = windowError
    errors[temperature] = problems
    const window = parseWindow(value.window)
    if (!Object.keys(problems).length && window)
      inputs.push({
        temperature,
        cases,
        weight,
        volume,
        window: window.start,
        windowEnd: window.end,
      })
  }
  const chosen = temperatures.filter((temperature) => included[temperature]).length
  return { valid: chosen > 0 && inputs.length === chosen, inputs, errors, chosen }
}
