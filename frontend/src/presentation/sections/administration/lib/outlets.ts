import type { TeamMember } from '../../../../domain/models'
import type { Brand, OutletProfile, Parking } from '../../../../domain/outlets'
import { useApiQuery } from '../../../hooks/useApiQuery'

export const brands: { brand: Brand; summary: string }[] = [
  { brand: 'Fresh', summary: 'Groceries, chilled and frozen. Daily, before the store opens.' },
  { brand: 'Style', summary: 'Hanging garments and cartons. Weekly, with seasonal peaks.' },
  { brand: 'Tech', summary: 'Appliances and electronics. As needed, fragile and valuable.' },
]
export const parkingOptions: { value: Parking; label: string; detail: string }[] = [
  {
    value: 'normal',
    label: 'Any vehicle',
    detail: 'Trucks and vans can reach the delivery point.',
  },
  { value: 'van_only', label: 'Vans only', detail: 'Trucks cannot reach it; only small vans can.' },
  {
    value: 'mall_dock',
    label: 'Mall delivery window',
    detail: 'A shared mall dock that only accepts deliveries in a fixed window.',
  },
]
export const parkingLabel = (outlet: OutletProfile) =>
  parkingOptions.find(
    (option) => option.value === (outlet.parking ?? (outlet.mall ? 'mall_dock' : 'normal')),
  )?.label ?? 'Any vehicle'

/** "5:30 AM". */
export function time12(time: string) {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
export const windowLabel = (outlet: OutletProfile) =>
  `${time12(outlet.receiving.earliest)} – ${time12(outlet.receiving.latest)}`

/** Every half hour from 04:00 to 22:00, for the delivery window pickers. */
export const timeOptions = Array.from({ length: 37 }, (_, index) => {
  const minutes = 4 * 60 + index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})
export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

/** The store manager an outlet already has, if any. */
export const managerOf = (outlet: { id: string }, members: TeamMember[]) =>
  members.find((member) => member.role === 'store-manager' && member.outletId === outlet.id)

/** "OUT001 · Fresh": how a store manager's assignment reads in the team list. */
export const outletAssignment = (outlet: OutletProfile) => `${outlet.id} · ${outlet.brand}`

export function useOutlets() {
  const query = useApiQuery(['outlets'], (apis) => apis.outlets.listOutlets())
  return { ...query, outlets: query.data ?? [], loaded: query.data !== undefined }
}
