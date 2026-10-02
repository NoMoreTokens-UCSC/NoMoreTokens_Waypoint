export type IssueKind = 'Missing' | 'Damaged'
export interface IssueDraft {
  kind: IssueKind
  received: string
  affected: string
  description: string
}
export type IssueErrors = Partial<Record<'received' | 'affected' | 'description', string>>

const count = (text: string) => (text.trim() === '' ? Number.NaN : Number(text))

/** Checks a report against the order before it is sent; the rules are enforced again behind the API. */
export function checkIssue(draft: IssueDraft, ordered: number, unit = 'case'): IssueErrors {
  const received = count(draft.received)
  const affected = count(draft.affected)
  const errors: IssueErrors = {}
  if (!Number.isInteger(received) || received < 0 || received > ordered)
    errors.received = `Enter the ${unit}s you counted, 0 to ${ordered}.`
  if (!Number.isInteger(affected) || affected < 1 || affected > ordered)
    errors.affected = `Enter how many ${unit}s were ${draft.kind === 'Missing' ? 'missing' : 'damaged'}, 1 to ${ordered}.`
  if (!errors.received && !errors.affected) {
    if (draft.kind === 'Missing' && received + affected !== ordered)
      errors.affected = `Received and missing ${unit}s must add up to the ${ordered} ordered.`
    if (draft.kind === 'Damaged' && affected > received)
      errors.affected = `Damaged ${unit}s cannot be more than the ${unit}s received.`
  }
  if (draft.description.trim().length < 4) errors.description = 'Describe what happened.'
  return errors
}

/** The line shown in "Receipt record after submission". */
export function issueSummary(draft: IssueDraft, ordered: number) {
  const received = Number(draft.received) || 0
  const affected = Number(draft.affected) || 0
  return draft.kind === 'Missing'
    ? `${received} received · ${affected} missing · ${ordered} expected`
    : `${received} received · ${affected} damaged · ${Math.max(received - affected, 0)} usable`
}
