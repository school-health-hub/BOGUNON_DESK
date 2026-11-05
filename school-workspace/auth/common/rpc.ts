import { WorkspaceAuthError, type WorkspaceMembershipContext, type WorkspaceRole } from './types.js';
export interface WorkspaceRpcContracts {
  ws_v1_bootstrap: { args: Record<string, never>; result: { actor_id: string } };
  ws_v1_get_context: { args: { p_school_id: string }; result: {
    school_id: string; role: WorkspaceRole; member_code: string; epoch: number; version: number; permissions: string[];
  } };
  ws_v1_request_join: { args: { p_school_id: string; p_requested_role: 'HEALTH_TEACHER' | 'HEALTH_ASSISTANT'; p_request_id: string }; result: { join_request_id: string; membership_id: string; epoch: number } };
  ws_v1_decide_join: { args: { p_school_id: string; p_join_request_id: string; p_decision: 'approve' | 'reject'; p_approved_role: 'HEALTH_TEACHER' | 'HEALTH_ASSISTANT' | null; p_valid_until: string | null; p_expected_version: number; p_request_id: string }; result: { approved: boolean } };
  ws_v1_set_member_role: { args: { p_school_id: string; p_membership_id: string; p_new_role: 'HEALTH_TEACHER' | 'HEALTH_ASSISTANT'; p_expected_version: number; p_request_id: string }; result: { version: number } };
  ws_v1_set_membership_state: { args: { p_school_id: string; p_membership_id: string; p_state: 'active' | 'suspended' | 'revoked'; p_expected_version: number; p_request_id: string }; result: { version: number } };
  ws_v1_leave_school: { args: { p_school_id: string; p_expected_version: number; p_request_id: string }; result: { left: boolean } };
}
export type WorkspaceRpcName = keyof WorkspaceRpcContracts;
export const WORKSPACE_RPC_NAMES: readonly WorkspaceRpcName[] = Object.freeze([
  'ws_v1_bootstrap','ws_v1_get_context','ws_v1_request_join','ws_v1_decide_join',
  'ws_v1_set_member_role','ws_v1_set_membership_state','ws_v1_leave_school',
]);
export interface WorkspaceRpcPort {
  readonly evidence: 'MOCK' | 'SERVER';
  call<N extends WorkspaceRpcName>(name: N, args: WorkspaceRpcContracts[N]['args'], signal: AbortSignal): Promise<WorkspaceRpcContracts[N]['result']>;
}
/** Discards even a transport that ignores AbortSignal. This is UI hygiene, never server authorization. */
export class WorkspaceRequestScope {
  #generation = 0;
  #controller = new AbortController();
  #context: WorkspaceMembershipContext | null = null;
  #data = new Map<string, unknown>();
  invalidate(): void {
    this.#generation++; this.#controller.abort(); this.#controller = new AbortController();
    this.#context = null; this.#data.clear();
  }
  get generation(): number { return this.#generation; }
  get context(): WorkspaceMembershipContext | null { return this.#context && structuredClone(this.#context); }
  cache(key: string, value: unknown): void { this.#data.set(key, value); }
  get cachedCount(): number { return this.#data.size; }
  async run<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const g = this.#generation, signal = this.#controller.signal;
    let value: T;
    try { value = await work(signal); }
    catch (e) { if (g !== this.#generation || signal.aborted) throw new WorkspaceAuthError('STALE_RESPONSE'); throw e; }
    if (g !== this.#generation || signal.aborted) throw new WorkspaceAuthError('STALE_RESPONSE');
    return value;
  }
  async switchSchool(rpc: WorkspaceRpcPort, schoolId: string): Promise<WorkspaceMembershipContext> {
    this.invalidate();
    try {
      const v = await this.run(signal => rpc.call('ws_v1_get_context', { p_school_id: schoolId }, signal));
      if (v.school_id !== schoolId || !['SCHOOL_ADMIN','HEALTH_TEACHER','HEALTH_ASSISTANT'].includes(v.role)
        || !Number.isSafeInteger(v.epoch) || v.epoch < 1 || !Number.isSafeInteger(v.version) || v.version < 1
        || typeof v.member_code !== 'string' || !Array.isArray(v.permissions) || !v.permissions.every(p => typeof p === 'string'))
        throw new WorkspaceAuthError('ACCESS_DENIED');
      this.#context = Object.freeze({ schoolId, role: v.role, memberCode: v.member_code, epoch: v.epoch,
        version: v.version, permissions: Object.freeze([...v.permissions]), evidence: rpc.evidence });
      return this.context!;
    } catch (e) {
      // A late failure of school A must not clear a newer successful school B.
      if (!(e instanceof WorkspaceAuthError && e.code === 'STALE_RESPONSE')) this.#context = null;
      throw e;
    }
  }
  requireApprovedSchool(): WorkspaceMembershipContext {
    if (!this.#context) throw new WorkspaceAuthError('ACCESS_DENIED');
    return this.context!;
  }
}
