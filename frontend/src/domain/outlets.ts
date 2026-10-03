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
export type Brand = 'Fresh' | 'Style' | 'Tech'
export type Parking = 'normal' | 'van_only' | 'mall_dock'
export interface OutletProfile {
  id: string
  name: string
  brand: Brand
  district: string
  depot: string
  receiving: ReceivingLimits
  /** `outlets.csv` `parking_constraint`: any vehicle, vans only, or the mall's delivery window. */
  parking?: Parking
  /** True for mall outlets, which accept deliveries only in the mall's fixed access window. */
  mall: boolean
  /** How often this brand orders: Style weekly for a scheduled day, Tech as needed. */
  schedule: string
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
  {
    id: 'OUT014',
    name: 'Style Majestic City',
    brand: 'Style',
    district: 'Colombo',
    depot: 'Peliyagoda',
    parking: 'mall_dock',
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
]

export const profileOf = (outletId: string) =>
  outletProfiles.find((profile) => profile.id === outletId)

/** What an administrator enters to add an outlet; the system assigns the id. */
export interface NewOutlet {
  name: string
  brand: Brand
  district: string
  depot: string
  parking: Parking
  /** The window deliveries may arrive in, "HH:MM". For a mall this is the mall's access window. */
  earliest: string
  latest: string
}

const schedules: Record<Brand, string> = {
  Fresh: 'Dry groceries every operating day; chilled on the days you need them',
  Style: 'One weekly order for your scheduled delivery day, larger ahead of seasonal peaks',
  Tech: 'As needed, often a single large item',
}
export const scheduleFor = (brand: Brand) => schedules[brand]

/** Usual receiving hours by brand: Fresh before the 8 AM opening, mall outlets in their own window. */
export function defaultWindow(brand: Brand): { earliest: string; latest: string } {
  return brand === 'Fresh'
    ? { earliest: '04:00', latest: '08:00' }
    : brand === 'Style'
      ? { earliest: '05:30', latest: '09:00' }
      : { earliest: '07:00', latest: '17:00' }
}

const time12 = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** The limits and the sentence the order form shows under its window picker. */
export function receivingFor(
  brand: Brand,
  parking: Parking,
  earliest: string,
  latest: string,
): ReceivingLimits {
  const mall = parking === 'mall_dock'
  return {
    earliest,
    latest,
    shortest: 60,
    step: 30,
    reason: mall
      ? `The mall only accepts deliveries between ${time12(earliest)} and ${time12(latest)}.`
      : brand === 'Fresh'
        ? `Fresh goods must arrive before the store opens at ${time12(latest)}.`
        : brand === 'Tech'
          ? `Appliances are received during trading hours, ${time12(earliest)} to ${time12(latest)}.`
          : `Garments are received between ${time12(earliest)} and ${time12(latest)}.`,
  }
}

/** Builds the profile for an outlet from what was entered. */
export function profileFromInput(id: string, input: NewOutlet): OutletProfile {
  return {
    id,
    name: input.name.trim(),
    brand: input.brand,
    district: input.district.trim(),
    depot: input.depot,
    parking: input.parking,
    mall: input.parking === 'mall_dock',
    receiving: receivingFor(input.brand, input.parking, input.earliest, input.latest),
    schedule: scheduleFor(input.brand),
  }
}
