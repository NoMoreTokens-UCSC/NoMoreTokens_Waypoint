import { sourceFleet } from './fleetReference'
import { sourceAudit } from './auditReference'
import type { Order, Snapshot, Vehicle } from '../../domain/models'
import { sourceTeam, unlistedTeamCounts } from './teamReference'
import { outletOrderHistory } from './orderHistory'

const demand: [string, string, Order['brand'], string, number, number, Order['temperature']][] = [
  ['ORD1042', 'OUT001', 'Fresh', '05:30', 1.2, 120, 'Chilled'],
  ['ORD1066', 'OUT002', 'Fresh', '05:30', 0.8, 90, 'Ambient'],
  ['ORD1073', 'OUT009', 'Fresh', '05:30', 1.4, 140, 'Chilled'],
  ['ORD1080', 'OUT016', 'Style', '05:30', 2, 200, 'Ambient'],
  ['ORD1043', 'OUT001', 'Fresh', '06:00', 2.4, 240, 'Ambient'],
  ['ORD1065', 'OUT057', 'Fresh', '06:00', 0.6, 60, 'Chilled'],
  ['ORD1067', 'OUT003', 'Fresh', '06:00', 1.4, 140, 'Chilled'],
  ['ORD1074', 'OUT010', 'Fresh', '06:00', 2, 200, 'Chilled'],
  ['ORD1081', 'OUT017', 'Style', '06:00', 3.6, 320, 'Ambient'],
  ['ORD1068', 'OUT004', 'Fresh', '06:30', 2, 200, 'Chilled'],
  ['ORD1075', 'OUT011', 'Fresh', '06:30', 3.6, 320, 'Ambient'],
  ['ORD1082', 'OUT018', 'Style', '06:30', 4.2, 420, 'Ambient'],
  ['ORD1069', 'OUT005', 'Fresh', '07:00', 3.6, 320, 'Ambient'],
  ['ORD1076', 'OUT012', 'Fresh', '07:00', 4.2, 420, 'Chilled'],
  ['ORD1083', 'OUT019', 'Tech', '07:00', 1, 110, 'Ambient'],
  ['ORD1070', 'OUT006', 'Fresh', '07:00', 4.2, 420, 'Chilled'],
  ['ORD1077', 'OUT013', 'Fresh', '07:00', 1, 110, 'Chilled'],
  ['ORD1084', 'OUT020', 'Tech', '08:30', 0.8, 90, 'Ambient'],
  ['ORD1058', 'OUT032', 'Tech', '09:00', 3.2, 460, 'Ambient'],
  ['ORD1071', 'OUT007', 'Fresh', '07:00', 1, 110, 'Chilled'],
  ['ORD1078', 'OUT014', 'Fresh', '07:00', 0.8, 90, 'Ambient'],
  ['ORD1051', 'OUT010', 'Style', '10:00', 8.6, 280, 'Ambient'],
  ['ORD1072', 'OUT008', 'Fresh', '07:00', 0.8, 90, 'Ambient'],
  ['ORD1079', 'OUT015', 'Style', '10:00', 1.4, 140, 'Ambient'],
]

/** The demo's "now": Friday 25 September 2026, 15:42 in Sri Lanka. */
const demoPlacedAt = '2026-09-25T15:42:00+05:30'

export function createSeed(): Snapshot {
  const orders: Order[] = demand.map(
    ([id, outlet, brand, window, volume, weight, temperature]) => ({
      id,
      outlet,
      outletName:
        outlet === 'OUT001'
          ? 'Fresh Wattala'
          : outlet === 'OUT008'
            ? 'Fresh Kelaniya'
            : `${brand} ${outlet.slice(3)}`,
      brand,
      window,
      volume,
      weight,
      temperature,
      cases: id === 'ORD1042' ? 18 : id === 'ORD1072' ? 14 : Math.round(weight / 10),
      status: 'Confirmed',
      priority: outlet === 'OUT057',
      receipt: 'Pending',
      placedAt: demoPlacedAt,
    }),
  )
  const vehicles: Vehicle[] = sourceFleet.map((vehicle) => ({ ...vehicle }))
  return {
    orders,
    vehicles,
    loads: [
      {
        id: 'LOAD055-1',
        vehicleId: 'VEH055',
        trip: 1,
        revision: 3,
        bay: '03',
        items: [
          { outlet: 'OUT008', name: 'Kelaniya · dry groceries', expected: 14, loaded: 0, stop: 2 },
          {
            outlet: 'OUT001',
            name: 'Wattala · chilled groceries',
            expected: 18,
            loaded: 0,
            stop: 1,
          },
        ],
        checks: { refrigeration: false, condition: false, restraints: false },
        issueResolved: true,
        completed: false,
        released: false,
      },
    ],
    stops: [
      {
        id: 'STOP001',
        outlet: 'OUT001',
        name: 'Fresh Wattala',
        address: 'Rear dock · 42 Station Road, Wattala',
        window: '05:30–07:30',
        eta: '05:40',
        lat: 6.989,
        lng: 79.89,
        orderIds: ['ORD1042'],
        cases: 18,
        status: 'Upcoming',
      },
      {
        id: 'STOP008',
        outlet: 'OUT008',
        name: 'Fresh Kelaniya',
        address: 'Receiving bay · 18 Kandy Road, Kelaniya',
        window: '07:00–08:00',
        eta: '07:10',
        lat: 6.955,
        lng: 79.923,
        orderIds: ['ORD1072'],
        cases: 14,
        status: 'Upcoming',
      },
    ],
    members: sourceTeam.map((member) => ({ ...member })),
    unlistedTeamCounts: { ...unlistedTeamCounts },
    designDataVersion: 1,
    orderHistory: outletOrderHistory.map((order) => ({ ...order })),
    orderHistoryVersion: 1,
    activeDriverId: 'USR001',
    queue: [],
    drafts: [],
    audit: sourceAudit.map((entry) => ({ ...entry })),
    unlistedAuditCount: 207,
    auditReferenceVersion: 1,
    settings: {
      cutoffClosed: false,
      published: false,
      routeStarted: false,
      routeRevision: 3,
      simulatedOffline: false,
      syncOutcome: 'accepted',
      profileName: 'Sanjeewa Bandara',
      profilePhone: '+94 76 330 9187',
      notifications: true,
      compactRows: false,
    },
  }
}
