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
}
