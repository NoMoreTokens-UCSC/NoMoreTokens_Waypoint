import { Link, Navigate, useParams } from 'react-router-dom'
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
import { managerOf, parkingLabel, useOutlets, windowLabel } from '../lib/outlets'
import { initials, statusTone, useMembers } from '../lib/team'

/** One outlet: its brand, delivery hours and access, and the store manager assigned to it. */
export default function OutletDetailPage() {
  const { outletId = '' } = useParams()
  const { outlets, loaded } = useOutlets()
  const { members } = useMembers()
  const outlet = outlets.find((candidate) => candidate.id === outletId)
  useBreadcrumb([
    { label: 'Outlets', to: '/administration/outlets' },
    { label: outlet ? `${outlet.id}` : 'Outlet' },
  ])
  if (!loaded) return null
  if (!outlet) return <Navigate to="/administration/outlets" replace />
  const manager = managerOf(outlet, members)
  const rows: [string, string][] = [
    ['Brand', `Waypoint ${outlet.brand}`],
    ['District', outlet.district || '—'],
    ['Depot', outlet.depot],
    ['Delivery window', windowLabel(outlet)],
    ['Access', parkingLabel(outlet)],
    ['Ordering', outlet.schedule],
  ]
  return (
    <AdminPage>
      <AdminIntro
        kicker={`Administration · Outlets · ${outlet.brand}`}
        title={outlet.name}
        lead={`${outlet.id} · ${outlet.depot} depot`}
      />
      <div className="ad-detail-grid">
        <Card label="Outlet details">
          <CardLabel>Outlet</CardLabel>
          <dl className="ad-rows">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="ad-lead">{outlet.receiving.reason}</p>
        </Card>
        <Card label="Store manager">
          <CardLabel>Store manager</CardLabel>
          {manager ? (
            <>
              <div className="ad-user">
                <Avatar text={initials(manager.name)} />
                <div>
                  <Link to={`/administration/team/${manager.id}`}>{manager.name}</Link>
                  <small>{manager.mobile}</small>
                </div>
                <Pill tone={statusTone(manager.status)}>{manager.status}</Pill>
              </div>
              <LinkBtn variant="grey" to={`/administration/team/${manager.id}`}>
                View store manager
              </LinkBtn>
            </>
          ) : (
            <>
              <p className="ad-lead">
                No store manager yet. Create one and choose this outlet, so they can place orders.
              </p>
              <LinkBtn to={`/administration/team/new?role=store-manager&outlet=${outlet.id}`}>
                Add store manager
              </LinkBtn>
            </>
          )}
        </Card>
      </div>
    </AdminPage>
  )
}
