import type {
  AuditEntry,
  MemberActivity,
  MobileInvitation,
  NewUser,
  TeamMember,
  TeamSummary,
  Workspace,
} from '../models'

/** People, roles, assignments and the audit trail (administration). */
export interface TeamApi {
  listMembers(): Promise<TeamMember[]>
  listAudit(): Promise<AuditEntry[]>
  /** Totals across everyone, including people the list does not page in. */
  getSummary(): Promise<TeamSummary>
  /** A person's recent activity, newest first. */
  listActivity(memberId: string): Promise<MemberActivity[]>
  invite(name: string, email: string, role: Workspace): Promise<void>
  inviteByMobile(invitation: MobileInvitation): Promise<void>
  /**
   * Creates an account with a username and a temporary password. The system does not send them: the
   * administrator gives them to the person. Fails if the username or mobile number is taken.
   */
  createUser(user: NewUser): Promise<void>
  completeInvitation(memberId: string): Promise<void>
  /** Sets a new temporary password for the administrator to hand over. It is not stored here. */
  resetAccess(memberId: string, password?: string): Promise<void>
  /** The person's own name, phone and email. Role, outlet and depot need an administrator. */
  updateContact(
    memberId: string,
    contact: { name: string; mobile: string; email: string },
  ): Promise<void>
  requestAccountChange(memberId: string, detail: string): Promise<void>
  changeAssignment(memberId: string, depot: string, assignment: string): Promise<void>
  reassignTrip(fromMemberId: string, toMemberId: string): Promise<void>
  updateRole(memberId: string, role: Workspace): Promise<void>
  /**
   * `scheduled` defers suspension of an on-route driver until the trip completes. Suspending an
   * on-route driver right away needs a `reason`; the dispatcher is alerted that the route has no driver.
   */
  suspend(memberId: string, scheduled?: boolean, reason?: string): Promise<void>
}
