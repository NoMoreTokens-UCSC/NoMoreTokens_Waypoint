import { Search } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useState } from 'react'
import { toast } from 'sonner'
import type { AuditEntry } from '../../../../domain/models'
import { AdminIntro, AdminPage, Btn, Pager } from '../components/AdminKit'
import { usePaging } from '../lib/paging'
import { useAudit, useSummary } from '../lib/team'

type Range = 'all' | 'today'
const ranges: { value: Range; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'all', label: 'All time' },
]

/** "Today 06:12", "Yesterday 17:20": the reference times, or the time of a new entry. */
const when = (entry: AuditEntry) =>
  entry.referenceWhen ??
  `Today ${new Date(entry.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
const isToday = (entry: AuditEntry) => when(entry).startsWith('Today')
const who = (entry: AuditEntry) => entry.actor ?? 'Administrator'
const record = (entry: AuditEntry) => entry.recordName ?? entry.recordId ?? 'Workspace'

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`
function downloadCsv(entries: AuditEntry[]) {
  const lines = [
    ['When', 'Who', 'Action', 'Person or record', 'Detail'].map(csvCell).join(','),
    ...entries.map((entry) =>
      [when(entry), who(entry), entry.action, record(entry), entry.detail].map(csvCell).join(','),
    ),
  ]
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'waypoint-audit-log.csv'
  link.click()
  URL.revokeObjectURL(url)
}

/** A chip that opens a short list of choices. */
function Choice<T extends string>({
  dot,
  label,
  value,
  options,
  onChange,
}: {
  dot: string
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="ad-chip" aria-label={label}>
        <i className={`ad-dot ad-dot-${dot}`} aria-hidden="true" />
        {options.find((option) => option.value === value)?.label}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="ad-menu" align="start" sideOffset={6}>
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              data-checked={option.value === value}
              onSelect={() => onChange(option.value)}
            >
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Audit log: every access change, who made it, what changed and when. */
export default function AuditPage() {
  const { audit, loaded } = useAudit()
  const summary = useSummary().data
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [range, setRange] = useState<Range>('all')
  const text = search.trim().toLowerCase()
  const actions = [...new Set(audit.map((entry) => entry.action))].sort()
  const shown = audit.filter(
    (entry) =>
      (action === 'all' || entry.action === action) &&
      (range === 'all' || isToday(entry)) &&
      (!text ||
        `${who(entry)} ${entry.action} ${record(entry)} ${entry.detail}`
          .toLowerCase()
          .includes(text)),
  )
  const paging = usePaging(shown, `${text}|${action}|${range}`)
  if (!loaded || !summary) return null
  return (
    <AdminPage>
      <AdminIntro
        kicker="Administration · Accountability"
        title="Audit log"
        lead="Every access change is recorded with who did it, what changed and when."
      />
      <div className="ad-toolbar">
        <label className="ad-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Search person, action or record"
            placeholder="Search person, action or record"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Choice
          dot="orange"
          label="Filter by action"
          value={action}
          options={[
            { value: 'all', label: 'All actions' },
            ...actions.map((name) => ({ value: name, label: name })),
          ]}
          onChange={setAction}
        />
        <Choice
          dot="green"
          label="Filter by time"
          value={range}
          options={ranges}
          onChange={setRange}
        />
        <div className="ad-toolbar-end" style={{ display: 'block' }}>
          <Btn
            variant="grey"
            onClick={() => {
              downloadCsv(shown)
              toast.success(`Exported ${shown.length} events`)
            }}
            disabled={shown.length === 0}
          >
            Export CSV
          </Btn>
        </div>
      </div>

      <div className="ad-table-card">
        <table className="ad-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Person or record</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {paging.visible.map((entry) => (
              <tr key={entry.id}>
                <td className="ad-audit-when">{when(entry)}</td>
                <td className="ad-strong">{who(entry)}</td>
                <td>{entry.action}</td>
                <td>{record(entry)}</td>
                <td>{entry.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="ad-empty">No events match these filters.</p>}
        <div className="ad-table-foot">
          <span>
            Showing {paging.from}–{paging.to} of{' '}
            {shown.length === audit.length ? summary.auditEvents : shown.length} events
          </span>
          <span className="ad-foot-right">
            <Pager paging={paging} label="Audit log" />
            Newest first · kept for 12 months
          </span>
        </div>
      </div>
      <ul className="ad-audit-cards" aria-label="Audit events">
        {paging.visible.map((entry) => (
          <li key={entry.id}>
            <strong>
              {entry.action} · {record(entry)}
            </strong>
            <span>{entry.detail}</span>
            <small>
              {when(entry)} · {who(entry)}
            </small>
          </li>
        ))}
      </ul>
      <div className="ad-cards-pager">
        <Pager paging={paging} label="Audit log" />
      </div>
    </AdminPage>
  )
}
