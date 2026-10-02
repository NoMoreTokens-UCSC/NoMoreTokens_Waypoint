import { resolveProductFrame } from '../../../design/presentationManifest'
import { AccountOverlay } from '../../../design/AccountOverlay'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { TeamMember, Workspace } from '../../../../domain/models'
import type { DesignControls } from '../../../design/DesignReferencePage'
import { ProductFrameView as DesignFrameView } from '../../../design/ProductFrameView'
import { allText, useDesignAssets, useDesignCatalog, useDesignFrame } from '../../../design/hooks'
import { SourceOverlay } from '../../../design/SourceOverlay'
import type { Layer, PrototypeAction } from '../../../design/types'
import { useAction, useOperations } from '../../../hooks/useOperations'
import { useServices } from '../../../providers/ServicesContext'

const roles: Record<string, Workspace> = {
  Dispatcher: 'dispatcher',
  Loader: 'loader',
  Driver: 'driver',
  'Store manager': 'store-manager',
}
const roleName = (role: Workspace) =>
  Object.keys(roles).find((name) => roles[name] === role) ?? 'Administrator'
const sourceSlots = ['USR002', 'USR003', 'USR001', 'USR005', 'USR004', 'USR006']
const sourceNames = [
  'Kasun Fernando',
  'Ruwan Silva',
  'Sanjeewa Bandara',
  'Chamari Wijesinghe',
  'Nimal Perera',
  'Ishara Gunawardena',
]
type Decision =
  | 'role'
  | 'reset'
  | 'suspend'
  | 'assignment'
  | 'reassign'
  | 'mobile-details'
  | 'sent'
  | 'roles-filter'
  | 'depot-filter'
  | 'menu'
  | 'member'
  | null

export default function FigmaAdminPage() {
  const catalog = useDesignCatalog().data
  const assets = useDesignAssets().data
  const { data } = useOperations()
  const service = useServices()
  const mutation = useAction()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [width, setWidth] = useState(window.innerWidth)
  const [selectedId, setSelectedId] = useState('USR001')
  const [overlay, setOverlay] = useState<string | null>(null)
  const [decision, setDecision] = useState<Decision>(() =>
    location.pathname.endsWith('/assignments') ? 'assignment' : null,
  )
  const [role, setRole] = useState<Workspace>('driver')
  const [fields, setFields] = useState<Record<string, string>>({
    'Full name': 'Chamari Wijesinghe',
    'Mobile number': '+94 77 123 4567',
    Depot: 'Kandy',
    Vehicle: 'VEH012 · Refrigerated van',
  })
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [depotFilter, setDepotFilter] = useState('All depots')
  const [replacement, setReplacement] = useState('')
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const mobile = width < 768
  const defaultId = location.pathname.endsWith('/roles')
    ? '342:21137'
    : location.pathname.endsWith('/audit')
      ? '342:21555'
      : mobile
        ? '343:21162'
        : '338:21061'
  const requested = params.get('frame') ?? defaultId
  const responsive =
    mobile && ['338:21061', '339:21078'].includes(requested)
      ? requested === '338:21061'
        ? '343:21162'
        : '343:21240'
      : !mobile && requested === '343:21162'
        ? '338:21061'
        : !mobile && requested === '343:21240'
          ? '339:21078'
          : requested
  const frame = resolveProductFrame(catalog, responsive, width)
  const source = useDesignFrame(frame?.url).data
  const selected = data?.members.find((member) => member.id === selectedId)
  if (!catalog || !assets || !data || !frame || !selected) return <p>Opening team and access…</p>
  const filtered = data.members.filter(
    (member) =>
      `${member.name} ${member.mobile} ${member.assignment}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (roleFilter === 'All roles' || roleName(member.role) === roleFilter) &&
      (depotFilter === 'All depots' || member.depot === depotFilter),
  )
  const ordered = [...filtered].sort((a, b) => {
    const ai = sourceSlots.indexOf(a.id),
      bi = sourceSlots.indexOf(b.id)
    return (ai < 0 ? -1 : ai) - (bi < 0 ? -1 : bi)
  })
  const slotMap = new Map<string, TeamMember>()
  const metrics = new Map<string, string>()
  const auditRows = new Map<string, number>()
  let rowIndex = 0
  let auditIndex = 0
  let mobileIndex = 0
  const mobileMembers = ordered.filter(
    (member) =>
      search ||
      roleFilter !== 'All roles' ||
      depotFilter !== 'All depots' ||
      !['USR003', 'USR004'].includes(member.id),
  )
  const totals = Object.fromEntries(
    ['Active', 'Invited', 'Suspended'].map((status) => [
      status,
      data.members.filter((member) => member.status === status).length +
        (data.unlistedTeamCounts?.[status as 'Active'] ?? 0),
    ]),
  )
  function collect(layer: Layer) {
    if (layer.name === 'Row' && layer.children?.some((child) => child.name === 'Cell/User')) {
      const member = ordered[rowIndex++]
      if (member) slotMap.set(layer.id, member)
    }
    if (layer.name.startsWith('UserCard/')) {
      const member = mobileMembers[mobileIndex++]
      if (member) slotMap.set(layer.id, member)
    }
    if (layer.name === 'Row' && layer.children?.some((child) => child.name === 'Cell/When'))
      auditRows.set(layer.id, auditIndex++)
    if (/^Summary\//.test(layer.name)) {
      const name = allText(layer)
        .replace(/^\d+\s*/, '')
        .trim()
      metrics.set(
        layer.id,
        String(
          name === 'Total users'
            ? Object.values(totals).reduce((sum, count) => sum + count, 0)
            : (totals[name] ?? ''),
        ),
      )
    }
    layer.children?.forEach(collect)
  }
  if (source) collect(source)
  function go(id: string) {
    setOverlay(null)
    setDecision(null)
    navigate(`/administration/team?frame=${encodeURIComponent(id)}`)
    window.scrollTo(0, 0)
  }
  const team = () => go(mobile ? '343:21162' : '338:21061')
  const add = () => go(mobile ? '343:21240' : '339:21078')
  function act(action: PrototypeAction) {
    if (action.type === 'CLOSE') {
      setOverlay(null)
      return
    }
    if (action.type === 'BACK') {
      navigate(-1)
      return
    }
    if (action.destinationId === '7:6') {
      navigate('/workspaces')
      return
    }
    if (action.navigation === 'OVERLAY' || action.navigation === 'SWAP') {
      setOverlay(action.destinationId ?? null)
      return
    }
    const target = catalog?.frames.find((frame) => frame.id === action.destinationId)
    if (target?.section === 'administration') go(target.id)
  }
  function invite() {
    mutation.run(async () => {
      await service.inviteByMobile({
        name: fields['Full name'],
        mobile: fields['Mobile number'],
        role,
        depot: fields.Depot,
        assignment: fields.Vehicle,
      })
      if (mobile) go('343:21294')
      else setDecision('sent')
    })
  }
  function activate(layer: Layer, scope?: string) {
    const label = allText(layer)
    if (layer.name.startsWith('NavigationItem/')) {
      const destination = layer.name.slice(15)
      if (destination === 'Users') team()
      else if (destination === 'Roles & access') navigate('/administration/roles')
      else if (destination === 'Audit log') navigate('/administration/audit')
      else if (destination === 'Assignments') setDecision('assignment')
      return true
    }
    if (/^(Role|ReasonRow)\//.test(layer.name) && roles[layer.name.split('/')[1]]) {
      const nextRole = roles[layer.name.split('/')[1]]
      setRole(nextRole)
      setFields((current) => ({
        ...current,
        Vehicle:
          nextRole === 'store-manager'
            ? 'OUT001'
            : nextRole === 'loader'
              ? 'Dock 03'
              : nextRole === 'dispatcher'
                ? 'Planning office'
                : 'VEH012',
      }))
      return true
    }
    if (
      (layer.name === 'MenuButton' || layer.name === 'Cell/More') &&
      scope?.startsWith('member:')
    ) {
      setSelectedId(scope.split(':')[1])
      if (mobile) setDecision('member')
      else go('339:21367')
      return true
    }
    if (layer.name === 'MenuButton') {
      setDecision('menu')
      return true
    }
    if (layer.name.startsWith('UserCard/')) {
      const member = slotMap.get(layer.id)
      if (member) {
        setSelectedId(member.id)
        setDecision('member')
      }
      return true
    }
    if (
      /^(Action\/|Button\/)/.test(layer.name) ||
      /Filter/.test(layer.name) ||
      ['All roles', 'All depots'].includes(label.trim())
    ) {
      if (label === 'Add user' || label === 'Add another user') {
        add()
        return true
      }
      if (label === 'Continue') {
        setDecision('mobile-details')
        return true
      }
      if (label === 'Send invite') {
        invite()
        return true
      }
      if (label === 'Cancel' || /Back to Team/.test(label)) {
        team()
        return true
      }
      if (label === 'Change role') {
        setRole(selected!.role)
        setDecision('role')
        return true
      }
      if (label === 'Reset access') {
        setDecision('reset')
        return true
      }
      if (label === 'Suspend user') {
        if (selected!.onRoute && !mobile) go('339:21654')
        else setDecision('suspend')
        return true
      }
      if (label === 'Reassign trip') {
        setDecision('reassign')
        return true
      }
      if (label === 'All roles') {
        setDecision('roles-filter')
        return true
      }
      if (label === 'All depots') {
        setDecision('depot-filter')
        return true
      }
    }
    if (
      layer.name === 'WebBackButton' ||
      (layer.name === 'WebBreadcrumbLink' && label === 'Team & access')
    ) {
      team()
      return true
    }
    return false
  }
  const controls: DesignControls = {
    label: (layer, scope) =>
      layer.name === 'Cell/More' && scope
        ? `View ${data.members.find((member) => member.id === scope.split(':')[1])?.name}`
        : undefined,
    busy: mutation.isPending,
    values: fields,
    change: (field, value) => setFields((current) => ({ ...current, [field]: value })),
    activate,
    isInteractive: (layer) =>
      /^(Action\/|Role\/|ReasonRow\/|UserCard\/|NavigationItem\/|Filter)/.test(layer.name) ||
      ['MenuButton', 'Cell/More'].includes(layer.name) ||
      (layer.type !== 'TEXT' && ['All roles', 'All depots'].includes(allText(layer).trim())),
    context: (layer, scope) =>
      layer.name === 'Preview'
        ? 'access-summary'
        : /^(Role|ReasonRow)\//.test(layer.name)
          ? `role:${roles[layer.name.split('/')[1]]}`
          : auditRows.has(layer.id)
            ? `audit:${auditRows.get(layer.id)}`
            : slotMap.has(layer.id)
              ? `member:${slotMap.get(layer.id)!.id}`
              : metrics.has(layer.id)
                ? `metric:${metrics.get(layer.id)}`
                : layer.name.startsWith('Cell/')
                  ? `${scope}:${layer.name.slice(5)}`
                  : scope,
    hidden: (layer) =>
      layer.name === 'Row' && layer.children?.some((child) => child.name === 'Cell/User')
        ? !slotMap.has(layer.id)
        : layer.name.startsWith('UserCard/') && !slotMap.has(layer.id),
    style: (layer, scope) =>
      layer.name === 'Radio' && scope?.startsWith('role:') && role !== 'driver'
        ? {
            outlineColor: scope.slice(5) === role ? '#f26a2e' : 'rgba(61,66,74,.22)',
            outlineWidth: scope.slice(5) === role ? 2 : 1,
            outlineOffset: scope.slice(5) === role ? -2 : -1,
          }
        : undefined,
    replace: (layer, scope) =>
      layer.name === 'Radio' && role !== 'driver' && scope?.startsWith('role:') ? (
        <>
          {scope.slice(5) === role && (
            <span
              style={{
                position: 'absolute',
                left: 6,
                top: 6,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#f26a2e',
              }}
            />
          )}
        </>
      ) : layer.name === 'Placeholder' && /Search/.test(layer.characters ?? '') ? (
        <input
          aria-label="Search name, mobile or outlet"
          placeholder={allText(layer)}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="figma-native-input"
          style={{
            width: '100%',
            height: '100%',
            padding: 0,
            borderRadius: 'inherit',
            fontSize: 14,
          }}
        />
      ) : undefined,
    text: (layer, scope) => {
      const original = layer.characters
      if (!original) return undefined
      if (scope === 'access-summary' && role !== 'driver') {
        if (original === 'Driver') return roleName(role)
        const capabilities: Record<string, string[]> = {
          dispatcher: [
            'Plan allocations and publish deliveries',
            'Review fleet capacity and deferrals',
            'Record loading or delivery evidence',
          ],
          loader: [
            'Review assigned loads and loading sequence',
            'Reconcile quantities and attach loading proof',
            'Publish plans or release vehicles',
          ],
          'store-manager': [
            'Place chilled and dry orders for the assigned outlet',
            'Track deliveries and confirm store receipt',
            'Change dispatch plans or other outlets',
          ],
        }
        const source = [
          'Record proof of delivery, even offline',
          'See assigned route and delivery manifest',
          'See other drivers or change plans',
        ]
        const index = source.indexOf(original)
        if (index >= 0) return capabilities[role]?.[index] ?? original
      }

      if (scope?.startsWith('audit:')) {
        const [, index, cell] = scope.split(':')
        const entry = data.audit[Number(index)]
        if (!entry) return ''
        if (cell === 'When')
          return (
            entry.referenceWhen ??
            `Today ${new Date(entry.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
          )
        if (cell === 'Who') return entry.actor ?? 'Administrator'
        if (cell === 'Action') return entry.action
        if (cell === 'Person or record') return entry.recordName ?? entry.recordId ?? 'Workspace'
        if (cell === 'Detail') return entry.detail
      }
      if (scope?.startsWith('metric:') && layer.name === 'Value') return scope.slice(7)
      if (scope?.startsWith('member:')) {
        const [, memberId, cell] = scope.split(':')
        const member = data.members.find((member) => member.id === memberId)!
        if (cell === 'User' || !cell) {
          if (sourceNames.includes(original)) return member.name
          if (/^\+94/.test(original)) return member.mobile ?? ''
          if (/^[A-Z]{2}$/.test(original))
            return member.name
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('')
          if (!cell && Object.keys(roles).includes(original)) return roleName(member.role)
          if (!cell && ['Active', 'Invited', 'Suspended'].includes(original)) return member.status
          if (!cell && /VEH|OUT|Planning office|Dock bay/.test(original)) return member.assignment
          if (!cell && ['Peliyagoda', 'Kandy'].includes(original)) return member.depot
        }
        if (cell === 'Role') return roleName(member.role)
        if (cell === 'Assignment') return member.assignment ?? ''
        if (cell === 'Depot') return member.depot ?? ''
        if (cell === 'Status')
          return member.suspensionScheduled ? 'Suspends after trip' : member.status
        if (cell === 'Last active' && member.id === 'USR001' && !member.onRoute)
          return 'Ready for Trip 1'
      }
      if (/Showing 6 of 48/.test(original))
        return `Showing ${Math.min(6, ordered.length)} of ${Object.values(totals).reduce((sum, count) => sum + count, 0)} users`
      if (original === 'All roles') return roleFilter
      if (/Showing 7 of 214/.test(original))
        return `Showing ${Math.min(7, data.audit.length)} of ${data.audit.length + (data.unlistedAuditCount ?? 0)} events`
      if (original === 'All depots') return depotFilter
      if (frame?.id === '339:21367' || frame?.id === '339:21654') {
        if (original === 'Sanjeewa Bandara') return selected!.name
        if (/^\+94 76/.test(original)) return `${selected!.mobile} · Joined 24 September`
        if (original === 'Driver') return roleName(selected!.role)
        if (original === 'Active') return selected!.status
        if (original === 'VEH055') return selected!.vehicleId ?? selected!.assignment ?? ''
        if (original === 'Peliyagoda') return selected!.depot
        if (/On route · Trip 1/.test(original))
          return selected!.onRoute ? original : 'Ready for Trip 1'
        if (/waiting to sync/.test(original))
          return `${data.queue.filter((record) => record.status !== 'accepted').length} waiting to sync`
      }
      if (frame?.id === '343:21294') {
        if (/Chamari has/.test(original))
          return `${fields['Full name'].split(' ')[0]} has been invited.`
        if (/An SMS/.test(original))
          return `A demo invite for ${fields['Mobile number']} is saved locally. The link expires in 48 hours.`
        if (original === 'Driver') return roleName(role)
        if (original === 'Kandy') return fields.Depot
        if (original === 'VEH012') return fields.Vehicle.match(/VEH\d+/)?.[0] ?? fields.Vehicle
      }
      if (original === 'Vehicle' && role !== 'driver')
        return role === 'store-manager' ? 'Outlet' : 'Assignment'
      return undefined
    },
  }
  const dialogTitle =
    decision === 'menu'
      ? 'Administration'
      : decision === 'mobile-details'
        ? 'Step 2 of 2 · Contact and assignment'
        : decision === 'sent'
          ? 'Invite sent'
          : decision === 'member'
            ? selected.name
            : decision === 'role'
              ? 'Change role'
              : decision === 'reset'
                ? 'Reset access'
                : decision === 'suspend'
                  ? 'Suspend user'
                  : decision === 'reassign'
                    ? 'Reassign trip'
                    : decision === 'assignment'
                      ? 'Change assignment'
                      : decision === 'roles-filter'
                        ? 'Filter by role'
                        : 'Filter by depot'
  function finish(action: () => Promise<unknown>) {
    mutation.run(async () => {
      await action()
      setDecision(null)
    })
  }
  return (
    <main
      className="figma-entry"

      aria-busy={mutation.isPending}
    >
      <div>
        <DesignFrameView
          id={frame.id}
          catalog={catalog}
          assets={assets}
          onAction={act}
          controls={controls}
        />
      </div>
      {overlay && (
        <AccountOverlay
          id={overlay}
          catalog={catalog}
          assets={assets}
          change={setOverlay}
          close={() => setOverlay(null)}
          reviewPath="/dispatcher/deferrals"
        />
      )}
      {decision && (
        <SourceOverlay title={dialogTitle} close={() => setDecision(null)}>
          <form
            className="figma-account-dialog"
            onSubmit={(event) => {
              event.preventDefault()
              if (mutation.isPending) return
              if (decision === 'mobile-details') invite()
              else if (decision === 'role') finish(() => service.updateMember(selected.id, role))
              else if (decision === 'reset') finish(() => service.resetAccess(selected.id))
              else if (decision === 'assignment')
                finish(() => service.changeAssignment(selected.id, fields.Depot, fields.Vehicle))
              else if (decision === 'reassign')
                finish(() => service.reassignTrip(selected.id, replacement))
              else if (decision === 'suspend') finish(() => service.suspend(selected.id))
              else if (decision === 'sent') team()
            }}
          >
            <h2>{dialogTitle}</h2>
            {decision === 'menu' && (
              <nav aria-label="Administration">
                {['team', 'roles', 'assignments', 'audit'].map((route, index) => (
                  <button
                    key={route}
                    type="button"
                    className="figma-primary-action"
                    onClick={() => {
                      setDecision(null)
                      navigate(`/administration/${route}`)
                    }}
                  >
                    {['Team & access', 'Roles & access', 'Assignments', 'Audit log'][index]}
                  </button>
                ))}
              </nav>
            )}
            {decision === 'mobile-details' && (
              <>
                <p>
                  {fields['Full name']} · {roleName(role)}
                </p>
                {['Mobile number', 'Depot', 'Vehicle'].map((field) => (
                  <label key={field}>
                    {field === 'Vehicle' && role !== 'driver' ? 'Assignment' : field}
                    <input
                      required
                      value={fields[field]}
                      onChange={(event) =>
                        setFields((current) => ({ ...current, [field]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </>
            )}
            {decision === 'role' && (
              <label>
                Role
                <select value={role} onChange={(event) => setRole(event.target.value as Workspace)}>
                  {Object.entries(roles).map(([name, value]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {decision === 'reset' && (
              <p>A recovery request for {selected.mobile} will be recorded in this demo.</p>
            )}
            {decision === 'sent' && (
              <p>{fields['Full name']} has been invited. The demo invitation is saved locally.</p>
            )}
            {decision === 'suspend' && (
              <>
                <p>
                  {selected.onRoute
                    ? 'This driver is on route. Hand over the trip or suspend access after the trip.'
                    : `Suspend access for ${selected.name}?`}
                </p>
                {selected.onRoute && (
                  <>
                    <button type="button" onClick={() => setDecision('reassign')}>
                      Reassign trip
                    </button>
                    <button
                      type="button"
                      onClick={() => finish(() => service.suspend(selected.id, true))}
                    >
                      Suspend after trip
                    </button>
                  </>
                )}
              </>
            )}
            {decision === 'assignment' && (
              <>
                <label>
                  Person
                  <select
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                  >
                    {data.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                {['Depot', 'Vehicle'].map((field) => (
                  <label key={field}>
                    {field === 'Vehicle' ? 'Assignment' : field}
                    <input
                      required
                      value={fields[field]}
                      onChange={(event) =>
                        setFields((current) => ({ ...current, [field]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </>
            )}
            {decision === 'reassign' && (
              <label>
                Available driver
                <select
                  required
                  value={replacement}
                  onChange={(event) => setReplacement(event.target.value)}
                >
                  <option value="">Choose driver</option>
                  {data.members
                    .filter(
                      (member) =>
                        member.role === 'driver' &&
                        member.status === 'Active' &&
                        !member.onRoute &&
                        member.id !== selected.id,
                    )
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {decision === 'roles-filter' &&
              ['All roles', ...Object.keys(roles)].map((name) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => {
                    setRoleFilter(name)
                    setDecision(null)
                  }}
                >
                  {name}
                </button>
              ))}
            {decision === 'depot-filter' &&
              ['All depots', 'Peliyagoda', 'Kandy'].map((name) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => {
                    setDepotFilter(name)
                    setDecision(null)
                  }}
                >
                  {name}
                </button>
              ))}
            {decision === 'member' && (
              <>
                <p>
                  {selected.mobile} · {roleName(selected.role)} · {selected.status}
                </p>
                <p>
                  {selected.depot} · {selected.assignment}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRole(selected.role)
                    setDecision('role')
                  }}
                >
                  Change role
                </button>
                <button type="button" onClick={() => setDecision('reset')}>
                  Reset access
                </button>
                <button type="button" onClick={() => setDecision('suspend')}>
                  Suspend user
                </button>
                {selected.status === 'Invited' && (
                  <button
                    type="button"
                    onClick={() => finish(() => service.completeInvitation(selected.id))}
                  >
                    Complete demo sign-in
                  </button>
                )}
              </>
            )}
            {!['menu', 'member', 'roles-filter', 'depot-filter'].includes(decision) &&
              !(decision === 'suspend' && selected.onRoute) && (
                <button type="submit" disabled={mutation.isPending}>
                  {decision === 'mobile-details'
                    ? 'Send invite'
                    : decision === 'sent'
                      ? 'Back to Team & access'
                      : 'Confirm'}
                </button>
              )}
            <button type="button" onClick={() => setDecision(null)}>
              Cancel
            </button>
          </form>
        </SourceOverlay>
      )}
    </main>
  )
}
