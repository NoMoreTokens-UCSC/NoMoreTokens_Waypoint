import type { TeamMember, Vehicle } from '../../../../domain/models'
import { useApiQuery } from '../../../hooks/useApiQuery'

/** The driver a vehicle is assigned to, if any. */
export const driverOf = (vehicle: Pick<Vehicle, 'id'>, members: TeamMember[]) =>
  members.find((member) => member.role === 'driver' && member.vehicleId === vehicle.id)

export const vehicleStatusTone = (status: Vehicle['status']) =>
  status === 'Available'
    ? 'green'
    : status === 'Offline'
      ? 'red'
      : status === 'Loading'
        ? 'amber'
        : 'orange'

export const capacityText = (vehicle: Pick<Vehicle, 'weightCapacity' | 'volumeCapacity'>) =>
  `${vehicle.weightCapacity.toLocaleString('en-GB')} kg · ${vehicle.volumeCapacity} m³`

/** Vehicle types an administrator can add: type and refrigeration together, as the fleet is described. */
export const vehicleTypes: {
  type: Vehicle['type']
  reefer: boolean
  label: string
  note: string
}[] = [
  {
    type: 'Truck',
    reefer: false,
    label: 'Dry-box truck',
    note: 'Garments, appliances and dry groceries.',
  },
  {
    type: 'Truck',
    reefer: true,
    label: 'Refrigerated truck',
    note: 'Chilled and frozen groceries. Fresh only.',
  },
  {
    type: 'Van',
    reefer: false,
    label: 'Van',
    note: 'Small loads and outlets trucks cannot reach.',
  },
  {
    type: 'Van',
    reefer: true,
    label: 'Refrigerated van',
    note: 'Small chilled loads. Fresh only.',
  },
]

export function useVehicles() {
  const query = useApiQuery(['vehicles'], (apis) => apis.fleet.listVehicles())
  return { ...query, vehicles: query.data ?? [], loaded: query.data !== undefined }
}
