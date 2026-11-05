/** Safe DTOs only: no token, verifier, storage or platform callback types. */
export type WorkspaceCurrentUser = Readonly<{ id: string }>;
export type AuthSessionSummary = Readonly<{ user: WorkspaceCurrentUser; expiresAt: number }>;
export type WorkspaceAuthStatus =
  | Readonly<{ kind: 'signed_out'; remoteRevocation?: 'unconfirmed' }>
  | Readonly<{ kind: 'signing_in' | 'expired' }>
  | Readonly<{ kind: 'authenticated'; session: AuthSessionSummary }>
  | Readonly<{ kind: 'error'; error: WorkspaceAuthErrorCode }>;
export type WorkspaceRole = 'SCHOOL_ADMIN' | 'HEALTH_TEACHER' | 'HEALTH_ASSISTANT';
export type WorkspaceMembershipContext = Readonly<{
  schoolId: string; role: WorkspaceRole; memberCode: string; epoch: number;
  version: number; permissions: readonly string[]; evidence: 'MOCK' | 'SERVER';
}>;
export type WorkspaceAuthErrorCode = 'AUTH_SERVER_ERROR' | 'AUTH_CANCELLED' | 'INVALID_CALLBACK' | 'FLOW_MISMATCH'
  | 'FLOW_EXPIRED' | 'CALLBACK_REPLAY' | 'STALE_RESPONSE' | 'STORAGE_UNAVAILABLE'
  | 'SESSION_CORRUPT' | 'UNAUTHENTICATED' | 'ACCESS_DENIED' | 'CSRF_REJECTED'
  | 'ORIGIN_REJECTED' | 'IPC_REJECTED' | 'CONFIGURATION_ERROR';
export class WorkspaceAuthError extends Error {
  constructor(readonly code: WorkspaceAuthErrorCode) { super(code); this.name = 'WorkspaceAuthError'; }
}
export const asAuthError = (e: unknown): WorkspaceAuthError =>
  e instanceof WorkspaceAuthError ? e : new WorkspaceAuthError('AUTH_SERVER_ERROR');
export interface AuthAdapter {
  getStatus(): Promise<WorkspaceAuthStatus>;
  restore(): Promise<void>;
  logout(): Promise<void>;
}
export function userSummary(id: string): WorkspaceCurrentUser {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new WorkspaceAuthError('AUTH_SERVER_ERROR');
  return Object.freeze({ id });
}
