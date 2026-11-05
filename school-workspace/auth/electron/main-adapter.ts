import { asAuthError, WorkspaceAuthError, userSummary, type AuthAdapter, type WorkspaceAuthStatus } from '../common/types.js';
import { WorkspaceRequestScope } from '../common/rpc.js';
import { CallbackFlows } from '../server/flow.js';
import { Mutex, type IdentityProvider, type SecretSession, type SecretVault } from '../server/ports.js';
import { validateSession } from '../server/session.js';
export class ElectronMainAuthAdapter implements AuthAdapter {
  #status: WorkspaceAuthStatus = { kind: 'signed_out' };
  #session: SecretSession | null = null;
  #generation = 0;
  #activeFlow?: string;
  #mutex = new Mutex();
  constructor(private readonly provider: IdentityProvider, private readonly vault: SecretVault,
    private readonly flows: CallbackFlows, private readonly openBrowser: (url: string) => Promise<void>,
    private readonly authOrigin: string, readonly workspace = new WorkspaceRequestScope(), private readonly now = Date.now) {}
  private invalidate(): number { this.workspace.invalidate(); return ++this.#generation; }
  private check(g: number): void { if (g !== this.#generation) throw new WorkspaceAuthError('STALE_RESPONSE'); }
  private cancelFlow(): void { if (this.#activeFlow) { this.provider.forget(this.#activeFlow); this.flows.cancel(this.#activeFlow); this.#activeFlow = undefined; } }
  async getStatus(): Promise<WorkspaceAuthStatus> {
    if (this.#status.kind === 'authenticated' && this.#session && this.#session.expiresAt <= this.now()) {
      this.invalidate(); this.#status = { kind: 'expired' };
    }
    return structuredClone(this.#status);
  }
  async restore(): Promise<void> {
    const g = this.invalidate(); this.cancelFlow(); this.#session = null; this.#status = { kind: 'signed_out' };
    await this.#mutex.run(async () => {
      try {
        let s = await this.vault.load(); this.check(g); if (!s) return;
        s = validateSession(s);
        if (s.expiresAt <= this.now() + 30_000) {
          const next = validateSession(await this.provider.refresh(s)); this.check(g);
          if (next.userId !== s.userId || next.expiresAt <= this.now()) throw new WorkspaceAuthError('AUTH_SERVER_ERROR');
          s = next;
        }
        await this.commit(s, g);
      } catch (e) {
        if (g !== this.#generation) return;
        this.#session = null; await this.vault.clear().catch(() => undefined);
        this.#status = { kind: 'error', error: asAuthError(e).code };
      }
    });
  }
  async beginSignIn(): Promise<void> {
    const old = this.#session, g = this.invalidate(); this.cancelFlow(); this.#session = null;
    this.#status = { kind: 'signing_in' };
    try {
      await this.#mutex.run(async () => { this.check(g); await this.vault.clear(); this.check(g); });
      if (old) void this.provider.revoke(old).catch(() => undefined);
      const { flow, redirectTo } = this.flows.create(); this.#activeFlow = flow.id;
      const url = await this.provider.start({ flowId: flow.id, redirectTo }); this.check(g);
      const u = new URL(url);
      if (u.origin !== this.authOrigin || u.protocol !== 'https:' || u.pathname !== '/auth/v1/authorize' || u.username || u.password || u.hash)
        throw new WorkspaceAuthError('CONFIGURATION_ERROR');
      await this.openBrowser(url); this.check(g);
    } catch (e) {
      if (g === this.#generation) { this.cancelFlow(); this.#status = { kind: 'error', error: asAuthError(e).code }; }
      throw asAuthError(e);
    }
  }
  /** Main-only OS callback entry; deliberately absent from Preload contract. */
  async handleCallback(raw: string): Promise<void> {
    let parsed: { flowId: string; code: string };
    try { parsed = this.flows.consume(raw,this.#activeFlow); }
    catch (e) {
      if (e instanceof WorkspaceAuthError && ['FLOW_EXPIRED','AUTH_CANCELLED'].includes(e.code)) { this.cancelFlow(); this.#status = { kind: 'error', error: e.code }; }
      throw e;
    }
    const { flowId, code } = parsed, g = this.#generation;
    try {
      const s = validateSession(await this.provider.exchange(flowId, code)); this.check(g);
      await this.#mutex.run(() => this.commit(s, g));
      if (g === this.#generation) this.#activeFlow = undefined;
    } catch (e) {
      if (g === this.#generation) { this.#session = null; this.workspace.invalidate(); this.#status = { kind: 'error', error: asAuthError(e).code }; }
      throw asAuthError(e);
    } finally { this.provider.forget(flowId); }
  }
  private async commit(s: SecretSession, g: number): Promise<void> {
    this.check(g); if (s.expiresAt <= this.now()) throw new WorkspaceAuthError('UNAUTHENTICATED');
    try { await this.vault.save(s); }
    catch { await this.vault.clear().catch(() => undefined); throw new WorkspaceAuthError('STORAGE_UNAVAILABLE'); }
    if (g !== this.#generation) { await this.vault.clear(); throw new WorkspaceAuthError('STALE_RESPONSE'); }
    this.workspace.invalidate(); this.#session = { ...s };
    this.#status = { kind: 'authenticated', session: { user: userSummary(s.userId), expiresAt: s.expiresAt } };
  }
  /** Token access is scoped to trusted Main transport code, never an IPC response. */
  async runAuthorized<T>(work: (accessToken: string, signal: AbortSignal) => Promise<T>): Promise<T> {
    const status = await this.getStatus();
    if (status.kind !== 'authenticated' || !this.#session) throw new WorkspaceAuthError('UNAUTHENTICATED');
    try { return await this.workspace.run(signal => work(this.#session!.accessToken, signal)); }
    catch (e) { if (e instanceof WorkspaceAuthError && e.code === 'ACCESS_DENIED') this.workspace.invalidate(); throw e; }
  }
  async logout(): Promise<void> {
    const old = this.#session; this.invalidate(); this.cancelFlow(); this.#session = null; this.#status = { kind: 'signed_out' };
    try { await this.#mutex.run(() => this.vault.clear()); }
    catch { this.#status = { kind: 'error', error: 'STORAGE_UNAVAILABLE' }; throw new WorkspaceAuthError('STORAGE_UNAVAILABLE'); }
    if (old) { try { await this.provider.revoke(old); } catch { if (this.#status.kind === 'signed_out') this.#status = { kind: 'signed_out', remoteRevocation: 'unconfirmed' }; } }
  }
}
