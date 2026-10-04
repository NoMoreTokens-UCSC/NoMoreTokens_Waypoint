import { useSyncExternalStore } from 'react'
import type { Order, StoreOrderInput, Temperature } from '../../../../domain/models'
import { estimateLoad, unitSizes } from '../../../../domain/orderSizing'
import { temperatures, windowText } from './orderView'
import { windowProblem, parseWindow } from './windows'

/** What the person entered for one order, as text so half-typed numbers are kept. */
export interface FieldValues {
  cases: string
  /** Worked out from the cases (see `estimateLoad`); shown to the person but never typed. */
  weight: string
  volume: string
  window: string
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
const round = (value: number, places: number) => String(Number(value.toFixed(places)))

/** The weight and volume that go with a number of cases. */
export function loadFor(cases: number) {
  if (!(cases > 0)) return { weight: '', volume: '' }
  const load = estimateLoad('Fresh', cases)
  return { weight: round(load.weight, 1), volume: round(load.volume, 3) }
}

/** The saved order's values, or a blank form with the usual window. */
export function valuesFromOrder(temperature: Temperature, order?: Order): FieldValues {
  return order
    ? {
        cases: String(order.cases),
        ...loadFor(order.cases),
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
  change: (temperature: Temperature, field: 'cases', value: string) => void
  stepCases: (temperature: Temperature, by: number) => void
  setWindow: (temperature: Temperature, window: string) => void
  setIncluded: (temperature: Temperature, included: boolean) => void
  /** Fills the form from an earlier day's orders; a temperature that day had none of is left out. */
  fillFrom: (previous: Order[]) => void
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
    const cases = Number(text)
    // Weight and volume always follow the number of cases.
    update(temperature, { ...values[temperature], cases: text, ...loadFor(Number.isFinite(cases) ? cases : 0) })
  }
  return {
    values,
    included,
    dirty:
      temperatures.some((temperature) => Boolean(current.values[temperature])) ||
      temperatures.some((temperature) => current.skipped[temperature]),
    change: (temperature, _field, value) => setCases(temperature, value),
    stepCases: (temperature, by) => {
      const next = Math.min(unitSizes.Fresh.max, Math.max(1, (Number(values[temperature].cases) || 0) + by))
      setCases(temperature, String(next))
    },
    setWindow: (temperature, window) => update(temperature, { ...values[temperature], window }),
    setIncluded: (temperature, include) =>
      write({ ...edits, skipped: { ...edits.skipped, [temperature]: !include } }),
    fillFrom: (previous) =>
      write({
        values: Object.fromEntries(
          temperatures.flatMap((temperature) => {
            const match = previous.find((order) => order.temperature === temperature)
            return match ? [[temperature, valuesFromOrder(temperature, match)]] : []
          }),
        ),
        skipped: Object.fromEntries(
          temperatures.map((temperature) => [
            temperature,
            !previous.some((order) => order.temperature === temperature),
          ]),
        ),
      }),
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
  /** The outlet's fixed window: when given, orders use it and no window is chosen or checked. */
  fixedWindow?: { start: string; end: string },
) {
  const errors: FormErrors = {}
  const inputs: StoreOrderInput[] = []
  for (const temperature of temperatures) {
    if (!included[temperature]) continue
    const value = values[temperature]
    const problems: Partial<Record<keyof FieldValues, string>> = {}
    const cases = Number(value.cases)
    if (!Number.isInteger(cases) || cases < 1 || cases > unitSizes.Fresh.max)
      problems.cases = `Enter 1 to ${unitSizes.Fresh.max} cases.`
    const windowError = fixedWindow ? undefined : windowProblem(value.window)
    if (windowError) problems.window = windowError
    errors[temperature] = problems
    const window = fixedWindow ?? parseWindow(value.window)
    if (!Object.keys(problems).length && window)
      inputs.push({
        temperature,
        cases,
        ...estimateLoad('Fresh', cases),
        window: window.start,
        windowEnd: window.end,
      })
  }
  const chosen = temperatures.filter((temperature) => included[temperature]).length
  return { valid: chosen > 0 && inputs.length === chosen, inputs, errors, chosen }
}
