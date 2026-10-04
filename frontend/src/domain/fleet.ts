import type { Vehicle } from './models'
import type { Brand } from './outlets'

/** What an administrator enters to add a vehicle; the system assigns the id (VEH061 and so on). */
export interface NewVehicle {
  brand: Brand
  type: Vehicle['type']
  /** Only Fresh carries chilled goods, so only Fresh vehicles can be refrigerated. */
  reefer: boolean
  depot: string
  weightCapacity: number
  volumeCapacity: number
  /** Number plate, optional. */
  registration?: string
}

/** Where each depot is (demo coordinates). A new vehicle starts at its depot. */
export const depotCoordinates: Record<string, { lat: number; lng: number }> = {
  Peliyagoda: { lat: 6.953, lng: 79.884 },
  Kandy: { lat: 7.2906, lng: 80.6337 },
}

/** Usual capacity by type in the demo fleet: a van carries 800 kg and 4 m³, a truck 2,400 kg and 12 m³. */
export const defaultCapacity = (type: Vehicle['type']) =>
  type === 'Van' ? { weight: 800, volume: 4 } : { weight: 2400, volume: 12 }

/** The depot a vehicle works from. The sample fleet predates the field: Kandy-based ones say so. */
export const vehicleDepot = (vehicle: Pick<Vehicle, 'depot' | 'location'>) =>
  vehicle.depot ?? (/Kandy/.test(vehicle.location) ? 'Kandy' : 'Peliyagoda')

/** "Refrigerated van", "Dry-box truck". */
export function vehicleKind(vehicle: Pick<Vehicle, 'type' | 'reefer'>) {
  if (vehicle.type === 'Van') return vehicle.reefer ? 'Refrigerated van' : 'Van'
  return vehicle.reefer ? 'Refrigerated truck' : 'Dry-box truck'
}
