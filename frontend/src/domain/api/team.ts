import type { AuditEntry, MobileInvitation, TeamMember, Workspace } from '../models'

/** People, roles, assignments and the audit trail (administration). */
export interface TeamApi {
  listMembers(): Promise<TeamMember[]>
  listAudit(): Promise<AuditEntry[]>
  invite(name: string, email: string, role: Workspace): Promise<void>
  inviteByMobile(invitation: MobileInvitation): Promise<void>
  completeInvitation(memberId: string): Promise<void>
  resetAccess(memberId: string): Promise<void>
  requestAccountChange(memberId: string, detail: string): Promise<void>
  changeAssignment(memberId: string, depot: string, assignment: string): Promise<void>
  reassignTrip(fromMemberId: string, toMemberId: string): Promise<void>
  updateRole(memberId: string, role: Workspace): Promise<void>
  /** `scheduled` defers suspension of an on-route driver until the trip completes. */
  suspend(memberId: string, scheduled?: boolean): Promise<void>
}
