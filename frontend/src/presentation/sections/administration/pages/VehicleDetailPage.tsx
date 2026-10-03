import { Link, Navigate, useParams } from 'react-router-dom'
import { vehicleDepot, vehicleKind } from '../../../../domain/fleet'
import { useBreadcrumb } from '../../../shared/templates/Breadcrumbs'
import {
  AdminIntro,
  AdminPage,
  Avatar,
  Card,
  CardLabel,
  LinkBtn,
  Pill,
} from '../components/AdminKit'
import { initials, statusTone, useMembers } from '../lib/team'
import { capacityText, driverOf, useVehicles, vehicleStatusTone } from '../lib/vehicles'

/** One vehicle: what it is, what it can carry, where it is based and who drives it. */
export default function VehicleDetailPage() {
  const { vehicleId = '' } = useParams()
  const { vehicles, loaded } = useVehicles()
  const { members } = useMembers()
  const vehicle = vehicles.find((candidate) => candidate.id === vehicleId)
  useBreadcrumb([
    { label: 'Vehicles', to: '/administration/vehicles' },
    { label: vehicle ? vehicle.id : 'Vehicle' },
  ])
  if (!loaded) return null
  if (!vehicle) return <Navigate to="/administration/vehicles" replace />
  const driver = driverOf(vehicle, members)
  const rows: [string, string][] = [
    ['Brand', `Waypoint ${vehicle.brand}`],
    ['Type', vehicleKind(vehicle)],
    ['Depot', vehicleDepot(vehicle)],
    ['Capacity', capacityText(vehicle)],
    ['Registration', vehicle.registration ?? '—'],
    ['Right now', vehicle.location],
  ]
  return (
    <AdminPage>
      <AdminIntro
        kicker={`Administration · Vehicles · ${vehicle.brand}`}
        title={vehicle.id}
        lead={`${vehicleKind(vehicle)} · ${vehicleDepot(vehicle)} depot`}
        aside={<Pill tone={vehicleStatusTone(vehicle.status)}>{vehicle.status}</Pill>}
      />
      <div className="ad-detail-grid">
        <Card label="Vehicle details">
          <CardLabel>Vehicle</CardLabel>
          <dl className="ad-rows">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card label="Driver">
          <CardLabel>Driver</CardLabel>
          {driver ? (
            <>
              <div className="ad-user">
                <Avatar text={initials(driver.name)} />
                <div>
                  <Link to={`/administration/team/${driver.id}`}>{driver.name}</Link>
                  <small>{driver.mobile}</small>
                </div>
                <Pill tone={statusTone(driver.status)}>{driver.status}</Pill>
              </div>
              <LinkBtn variant="grey" to={`/administration/team/${driver.id}`}>
                View driver
              </LinkBtn>
            </>
          ) : (
            <>
              <p className="ad-lead">
                No driver yet. Create one and this vehicle is already chosen for them.
              </p>
              <LinkBtn to={`/administration/team/new?role=driver&vehicle=${vehicle.id}`}>
                Add driver
              </LinkBtn>
            </>
          )}
        </Card>
      </div>
    </AdminPage>
  )
}
