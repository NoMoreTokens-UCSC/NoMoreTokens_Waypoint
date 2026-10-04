import type { NewVehicle } from '../fleet'
import type { Vehicle } from '../models'

/** A distribution centre vehicles leave from. */
export interface Depot {
  code: string
  name: string
  lat: number
  lng: number
}

/** Vehicle capability, capacity and live position. */
export interface FleetApi {
  listDepots(): Promise<Depot[]>
  listVehicles(): Promise<Vehicle[]>
  getVehicle(vehicleId: string): Promise<Vehicle | undefined>
  /**
   * Adds a vehicle with the next free id, available at its depot. Fails for a refrigerated vehicle
   * that is not Fresh, a capacity outside the sensible range, or a registration already in use.
   */
  createVehicle(input: NewVehicle): Promise<Vehicle>
}
