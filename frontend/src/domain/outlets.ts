/**
 * What the system knows about an outlet when its manager places an order: the brand (which sets the
 * ordering schedule) and when goods may be received. A backend serves these from `outlets.csv`
 * (brand, `parking_constraint`, `mall_window`); the demo models three.
 */
export interface ReceivingLimits {
  /** Earliest a delivery may start and latest it may finish, "HH:MM". */
  earliest: string
  latest: string
  /** Shortest window worth offering, in minutes, and the step between choices. */
  shortest: number
  step: number
  /** Why the limits exist, shown under the picker. */
  reason: string
}
export interface OutletProfile {
  id: string
  name: string
  brand: 'Fresh' | 'Style' | 'Tech'
  district: string
  depot: string
  receiving: ReceivingLimits
  /** True for mall outlets, which accept deliveries only in the mall's fixed access window. */
  mall: boolean
  /** How often this brand orders: Style weekly for a scheduled day, Tech as needed. */
  schedule: string
  /**
   * The outlet's own delivery window ("HH:MM"), fixed in the outlet data (a mall's access window for
   * mall outlets). Orders do not carry a window of their own. Unset where the source has none.
   */
  window?: { start: string; end: string }
}

export const outletProfiles: OutletProfile[] = [
  {
    id: 'OUT001',
    name: 'Fresh Wattala',
    brand: 'Fresh',
    district: 'Wattala',
    depot: 'Peliyagoda',
    receiving: {
      earliest: '04:00',
      latest: '08:00',
      shortest: 60,
      step: 30,
      reason: 'Fresh goods must arrive before the store opens at 8:00 AM.',
    },
    mall: false,
    schedule: 'Dry groceries every operating day; chilled on the days you need them',
  },
  {
    id: 'OUT016',
    name: 'Style Liberty Mall',
    brand: 'Style',
    district: 'Colombo',
    depot: 'Peliyagoda',
    receiving: {
      earliest: '05:30',
      latest: '09:00',
      shortest: 60,
      step: 30,
      reason: 'The mall only accepts deliveries between 5:30 AM and 9:00 AM.',
    },
    mall: true,
    schedule: 'One weekly order for your scheduled delivery day, larger ahead of seasonal peaks',
  },
  {
    id: 'OUT019',
    name: 'Tech Kandy City',
    brand: 'Tech',
    district: 'Kandy',
    depot: 'Peliyagoda',
    receiving: {
      earliest: '07:00',
      latest: '17:00',
      shortest: 60,
      step: 30,
      reason: 'Appliances are received during trading hours, 7:00 AM to 5:00 PM.',
    },
    mall: false,
    schedule: 'As needed, often a single large item',
  },
]

/** Receiving limits and ordering schedule that follow from an outlet's brand and whether it is in a mall. */
const brandRules: Record<
  OutletProfile['brand'],
  Omit<OutletProfile, 'id' | 'name' | 'district' | 'depot' | 'mall'>
> = {
  Fresh: {
    brand: 'Fresh',
    receiving: {
      earliest: '04:00',
      latest: '08:00',
      shortest: 60,
      step: 30,
      reason: 'Fresh goods must arrive before the store opens at 8:00 AM.',
    },
    schedule: 'Dry groceries every operating day; chilled on the days you need them',
  },
  Style: {
    brand: 'Style',
    receiving: {
      earliest: '05:30',
      latest: '09:00',
      shortest: 60,
      step: 30,
      reason: 'Deliveries are received between 5:30 AM and 9:00 AM.',
    },
    schedule: 'One weekly order for your scheduled delivery day, larger ahead of seasonal peaks',
  },
  Tech: {
    brand: 'Tech',
    receiving: {
      earliest: '07:00',
      latest: '17:00',
      shortest: 60,
      step: 30,
      reason: 'Appliances are received during trading hours, 7:00 AM to 5:00 PM.',
    },
    schedule: 'As needed, often a single large item',
  },
}

const hhmm = (time?: string | null) => (time ? time.slice(0, 5) : undefined)
const clock12 = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}

/** An outlet's profile from the reference data a backend serves (`outlets.csv`). */
export function profileFromReference(outlet: {
  outlet_id: string
  brand: string
  district: string
  depot_code: string
  is_mall: boolean
  mall_window_open?: string | null
  mall_window_close?: string | null
  window_open_time?: string | null
  window_close_time?: string | null
}): OutletProfile {
  const brand = (
    ['Fresh', 'Style', 'Tech'].includes(outlet.brand) ? outlet.brand : 'Fresh'
  ) as OutletProfile['brand']
  const rules = brandRules[brand]
  const mallOpen = hhmm(outlet.mall_window_open)
  const mallClose = hhmm(outlet.mall_window_close)
  const receiving =
    outlet.is_mall && mallOpen && mallClose
      ? {
          ...rules.receiving,
          earliest: mallOpen,
          latest: mallClose,
          reason: `The mall only accepts deliveries between ${clock12(mallOpen)} and ${clock12(mallClose)}.`,
        }
      : rules.receiving
  const openAt = hhmm(outlet.window_open_time)
  const closeAt = hhmm(outlet.window_close_time)
  const start = outlet.is_mall && mallOpen && mallClose ? mallOpen : openAt
  const end = outlet.is_mall && mallOpen && mallClose ? mallClose : closeAt
  return {
    id: outlet.outlet_id,
    name: `${brand} ${outlet.district}`,
    brand,
    district: outlet.district,
    depot: outlet.depot_code,
    mall: outlet.is_mall,
    receiving,
    schedule: rules.schedule,
    window: start && end ? { start, end } : undefined,
  }
}

export const profileOf = (outletId: string) =>
  outletProfiles.find((profile) => profile.id === outletId)
