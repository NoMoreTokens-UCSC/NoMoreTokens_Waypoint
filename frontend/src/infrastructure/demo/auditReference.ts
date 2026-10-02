import type { AuditEntry } from '../../domain/models'

/** Only the seven records visible in the source are supplied as identities. */
export const sourceAudit: AuditEntry[] = [
  ['Today 06:12', 'Administrator', 'Sent invite', 'Chamari Wijesinghe', 'Driver · Kandy · VEH012'],
  ['Today 05:58', 'Administrator', 'Changed vehicle', 'Sanjeewa Bandara', 'VEH054 to VEH055'],
  [
    'Today 05:40',
    'System',
    'Suspended access',
    'Ishara Gunawardena',
    'Six failed sign-in attempts',
  ],
  ['Today 05:31', 'Administrator', 'Reset access', 'Ruwan Silva', 'New invite link sent'],
  ['Yesterday 17:20', 'Administrator', 'Added depot access', 'Kasun Fernando', 'Kandy hub'],
  [
    'Yesterday 16:45',
    'Kasun Fernando',
    'Approved reassignment',
    'Trip 2 · VEH019',
    'Driver changed',
  ],
  ['Yesterday 14:10', 'Administrator', 'Sent invite', 'Nimal Perera', 'Store manager · OUT001'],
].map(([referenceWhen, actor, action, recordName, detail], index) => ({
  id: `FIGMA-AUD-${index + 1}`,
  at: `2026-09-${index < 4 ? '25' : '24'}T${referenceWhen.slice(-5)}:00+05:30`,
  referenceWhen,
  actor,
  action,
  recordName,
  detail,
}))
