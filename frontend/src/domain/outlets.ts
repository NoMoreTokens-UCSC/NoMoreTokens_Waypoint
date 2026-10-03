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

export const profileOf = (outletId: string) =>
  outletProfiles.find((profile) => profile.id === outletId)
