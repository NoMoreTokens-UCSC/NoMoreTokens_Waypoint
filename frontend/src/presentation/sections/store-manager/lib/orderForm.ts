import { useSyncExternalStore } from 'react'
import type { Order, StoreOrderInput, Temperature } from '../../../../domain/models'
import { temperatures, windowText } from './orderView'

/** What the person typed for one order, as text so half-typed numbers are kept. */
export interface FieldValues {
  cases: string
  weight: string
  volume: string
  window: string
}
type Edits = Partial<Record<Temperature, FieldValues>>

const KEY = 'waypoint.store.orderForm'
let edits: Edits = read()
const listeners = new Set<() => void>()

function read(): Edits {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Edits
  } catch {
    return {}
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
  /** True once the person has changed something since the last confirmation. */
  dirty: boolean
  change: (temperature: Temperature, field: keyof FieldValues, value: string) => void
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
  const values = Object.fromEntries(
    temperatures.map((temperature) => [
      temperature,
      current[temperature] ??
        valuesFromOrder(
          temperature,
          orders.find((order) => order.temperature === temperature),
        ),
    ]),
  ) as Record<Temperature, FieldValues>
  return {
    values,
    dirty: temperatures.some((temperature) => Boolean(current[temperature])),
    change: (temperature, field, value) =>
      write({ ...edits, [temperature]: { ...values[temperature], [field]: value } }),
    reset: () => write({}),
  }
}

const WINDOW = /^(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})$/
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/
export type FormErrors = Partial<Record<Temperature, Partial<Record<keyof FieldValues, string>>>>

/** Turns the typed values into order inputs, or the problems to show next to each field. */
export function parseForm(values: Record<Temperature, FieldValues>) {
  const errors: FormErrors = {}
  const inputs: StoreOrderInput[] = []
  for (const temperature of temperatures) {
    const value = values[temperature]
    const problems: Partial<Record<keyof FieldValues, string>> = {}
    const cases = Number(value.cases)
    const weight = Number(value.weight)
    const volume = Number(value.volume)
    if (!Number.isInteger(cases) || cases < 1 || cases > 100)
      problems.cases = 'Enter 1 to 100 cases.'
    if (!(weight > 0)) problems.weight = 'Enter the weight in kg.'
    if (!(volume > 0)) problems.volume = 'Enter the volume in m³.'
    const range = WINDOW.exec(value.window.trim())
    if (!range || !CLOCK.test(range[1]) || !CLOCK.test(range[2]) || range[2] <= range[1])
      problems.window = 'Use a window such as 05:30–07:30.'
    errors[temperature] = problems
    if (!Object.keys(problems).length && range)
      inputs.push({ temperature, cases, weight, volume, window: range[1], windowEnd: range[2] })
  }
  const valid = inputs.length === temperatures.length
  return { valid, inputs, errors }
}
