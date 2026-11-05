import { createHash } from 'node:crypto';
import { WorkspaceAuthError, userSummary, type AuthAdapter, type WorkspaceAuthStatus, type WorkspaceMembershipContext } from '../common/types.js';
import { WorkspaceRequestScope, type WorkspaceRpcPort } from '../common/rpc.js';
import { CallbackFlows, randomHandle, sameSecret } from '../server/flow.js';
import type { IdentityProvider, SecretSession } from '../server/ports.js';
import { validateSession } from '../server/session.js';
import type { WebSessionRecord, WebSessionStore } from './session-store.js';
export const SESSION_COOKIE = '__Host-ws_session', FLOW_COOKIE = '__Host-ws_flow';
export interface BffRequest { method: string; origin: string | null; cookies: Readonly<Record<string, string | undefined>>; csrfToken?: string }
export interface BffLoginReply { status: WorkspaceAuthStatus; csrfToken: string; setCookies: readonly string[] }
const keyOf = (handle: string): string => createHash('sha256').update(handle).digest('hex');
const cookie = (name: string, value: string, seconds: number): string => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
function handleValue(value: string | undefined): string {
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new WorkspaceAuthError('UNAUTHENTICATED'); return value;
}
export class WebBffAuthAdapter {
  #pending = new Map<string, { flowId: string; expiresAt: number }>();
  #scopes = new Map<string, WorkspaceRequestScope>();
  constructor(private readonly provider: IdentityProvider, private readonly store: WebSessionStore,
    private readonly flows: CallbackFlows, private readonly appOrigin: string, private readonly authOrigin: string,
    mode: 'test' | 'production', private readonly now = Date.now) {
    if ((mode === 'production' && store.testOnly) || !appOrigin.startsWith('https:') || new URL(appOrigin).origin !== appOrigin
      || new URL(flows.callbackBase).origin !== appOrigin) throw new WorkspaceAuthError('CONFIGURATION_ERROR');
  }
  private origin(req: BffRequest): void {
    if (req.origin !== this.appOrigin) throw new WorkspaceAuthError('ORIGIN_REJECTED');
    if (req.method !== 'POST') throw new WorkspaceAuthError('CSRF_REJECTED');
  }
  private scope(k: string): WorkspaceRequestScope {
    const s = this.#scopes.get(k) ?? new WorkspaceRequestScope(); this.#scopes.set(k, s); return s;
  }
  private async drop(k: string): Promise<void> { this.#scopes.get(k)?.invalidate(); this.#scopes.delete(k); await this.store.revoke(k); }
  private csrf(req: BffRequest, r: WebSessionRecord): void {
    if (!req.csrfToken || !sameSecret(req.csrfToken, r.csrf)) throw new WorkspaceAuthError('CSRF_REJECTED');
  }
  async begin(req: BffRequest): Promise<{ authorizationUrl: string; setCookies: readonly string[] }> {
    this.origin(req);
    // Account switching requires the old session's CSRF proof before invalidation.
    const oldHandle = req.cookies[SESSION_COOKIE];
    if (oldHandle) {
      const k = keyOf(handleValue(oldHandle)), r = await this.store.get(k);
      if (r) { this.csrf(req,r); await this.drop(k); void this.provider.revoke(r.secret).catch(() => undefined); }
    }
    for (const [k,p] of this.#pending) if (p.expiresAt <= this.now()) { this.provider.forget(p.flowId); this.flows.cancel(p.flowId); this.#pending.delete(k); }
    const previous = req.cookies[FLOW_COOKIE];
    if (previous) { const p = this.#pending.get(keyOf(previous)); if (p) { this.provider.forget(p.flowId); this.flows.cancel(p.flowId); this.#pending.delete(keyOf(previous)); } }
    const { flow, redirectTo } = this.flows.create(), binding = randomHandle();
    this.#pending.set(keyOf(binding), { flowId: flow.id, expiresAt: flow.expiresAt });
    try {
      const url = await this.provider.start({ flowId: flow.id, redirectTo });
      const u = new URL(url);
      if (u.origin !== this.authOrigin || u.pathname !== '/auth/v1/authorize' || u.protocol !== 'https:' || u.username || u.password || u.hash)
        throw new WorkspaceAuthError('CONFIGURATION_ERROR');
      return { authorizationUrl: url, setCookies: [cookie(FLOW_COOKIE,binding,300),cookie(SESSION_COOKIE,'',0)] };
    } catch { this.#pending.delete(keyOf(binding)); this.flows.cancel(flow.id); this.provider.forget(flow.id); throw new WorkspaceAuthError('AUTH_SERVER_ERROR'); }
  }
  /** Navigation callback uses HttpOnly flow binding + app state, not a cross-site Origin header. */
  async callback(raw: string, cookies: BffRequest['cookies']): Promise<BffLoginReply> {
    const binding = handleValue(cookies[FLOW_COOKIE]), k = keyOf(binding), p = this.#pending.get(k);
    if (!p) throw new WorkspaceAuthError('FLOW_MISMATCH');
    let callback: { flowId: string; code: string };
    try { callback = this.flows.consume(raw,p.flowId); }
    catch (e) {
      if (e instanceof WorkspaceAuthError && ['FLOW_EXPIRED','AUTH_CANCELLED'].includes(e.code)) {
        this.provider.forget(p.flowId); this.#pending.delete(k); this.flows.cancel(p.flowId);
      }
      throw e;
    }
    const { flowId, code } = callback;
    try {
      const secret = validateSession(await this.provider.exchange(flowId, code));
      // Logout or a replacement flow may invalidate while code exchange is in flight.
      if (this.#pending.get(k) !== p || p.expiresAt <= this.now()) throw new WorkspaceAuthError('STALE_RESPONSE');
      if (secret.expiresAt <= this.now()) throw new WorkspaceAuthError('UNAUTHENTICATED');
      const handle = randomHandle(), csrf = randomHandle();
      await this.store.create(keyOf(handle), { revision: 1, secret, csrf, hardExpiresAt: this.now()+43_200_000, workspaceGeneration: 0 });
      if (this.#pending.get(k) !== p) { await this.drop(keyOf(handle)); throw new WorkspaceAuthError('STALE_RESPONSE'); }
      return { status: this.summary(secret), csrfToken: csrf,
        setCookies: [cookie(SESSION_COOKIE,handle,43200),cookie(FLOW_COOKIE,'',0)] };
    } catch (e) { throw e instanceof WorkspaceAuthError ? e : new WorkspaceAuthError('AUTH_SERVER_ERROR'); }
    finally { this.provider.forget(flowId); }
  }
  private summary(s: SecretSession): WorkspaceAuthStatus {
    return { kind: 'authenticated', session: { user: userSummary(s.userId), expiresAt: s.expiresAt } };
  }
  private async session(req: BffRequest): Promise<{ key: string; record: WebSessionRecord }> {
    this.origin(req); const key = keyOf(handleValue(req.cookies[SESSION_COOKIE]));
    return this.store.withLock(key, async () => {
      let r = await this.store.get(key);
      if (!r) { this.#scopes.get(key)?.invalidate(); this.#scopes.delete(key); throw new WorkspaceAuthError('UNAUTHENTICATED'); }
      this.csrf(req,r);
      if (r.hardExpiresAt <= this.now()) { await this.drop(key); throw new WorkspaceAuthError('UNAUTHENTICATED'); }
      if (r.secret.expiresAt <= this.now()+30_000) {
        try {
          const secret = validateSession(await this.provider.refresh(r.secret));
          if (secret.userId !== r.secret.userId || secret.expiresAt <= this.now()) throw Error();
          const next = { ...r, secret, revision: r.revision+1 };
          if (!await this.store.compareAndSwap(key,r.revision,next)) throw new WorkspaceAuthError('STALE_RESPONSE');
          r = next;
        } catch (e) { await this.drop(key); throw e instanceof WorkspaceAuthError ? e : new WorkspaceAuthError('AUTH_SERVER_ERROR'); }
      }
      return { key, record: r };
    });
  }
  async status(req: BffRequest): Promise<WorkspaceAuthStatus> { return this.summary((await this.session(req)).record.secret); }
  forRequest(req: BffRequest): AuthAdapter {
    return { getStatus: () => this.status(req), restore: async () => { await this.session(req); }, logout: async () => { await this.logout(req); } };
  }
  async logout(req: BffRequest): Promise<{ setCookies: readonly string[]; remoteRevocation: 'confirmed' | 'unconfirmed' }> {
    this.origin(req);
    const pendingBinding = req.cookies[FLOW_COOKIE];
    if (pendingBinding) {
      const p = this.#pending.get(keyOf(pendingBinding));
      if (p) { this.#pending.delete(keyOf(pendingBinding)); this.flows.cancel(p.flowId); this.provider.forget(p.flowId); }
    }
    let remoteRevocation: 'confirmed' | 'unconfirmed' = 'confirmed';
    const raw = req.cookies[SESSION_COOKIE];
    if (raw) {
      const k = keyOf(handleValue(raw)), record = await this.store.get(k);
      if (record) { this.csrf(req,record); await this.drop(k); try { await this.provider.revoke(record.secret); } catch { remoteRevocation = 'unconfirmed'; } }
    }
    return { setCookies: [cookie(SESSION_COOKIE,'',0),cookie(FLOW_COOKIE,'',0)], remoteRevocation };
  }
  /** SCHOOL-01C: server-only bootstrap/self-membership seam before a school is selected. */
  async runAccountRequest<T>(req:BffRequest,work:(accessToken:string,signal:AbortSignal)=>Promise<T>):Promise<T> {
    const {key,record}=await this.session(req),scope=this.scope(key);
    return scope.run(async signal=>{
      const value=await work(record.secret.accessToken,signal);
      if(!await this.store.get(key))throw new WorkspaceAuthError('STALE_RESPONSE');
      return value;
    });
  }
  async switchSchool(req: BffRequest, schoolId: string, rpc: (accessToken: string) => WorkspaceRpcPort): Promise<WorkspaceMembershipContext> {
    const { key } = await this.session(req);
    const record = await this.store.withLock(key, async () => {
      const current = await this.store.get(key); if (!current) throw new WorkspaceAuthError('UNAUTHENTICATED');
      const next = { ...current, revision: current.revision+1, workspaceGeneration: current.workspaceGeneration+1, workspaceSchoolId: undefined };
      if (!await this.store.compareAndSwap(key,current.revision,next)) throw new WorkspaceAuthError('STALE_RESPONSE');
      return next;
    });
    const scope = this.scope(key), pending = scope.switchSchool(rpc(record.secret.accessToken),schoolId), ticket = scope.generation;
    try {
      const context = await pending;
      await this.store.withLock(key, async () => {
        const current = await this.store.get(key);
        if (!current || current.workspaceGeneration !== record.workspaceGeneration) throw new WorkspaceAuthError('STALE_RESPONSE');
        if (!await this.store.compareAndSwap(key,current.revision,{ ...current, revision: current.revision+1, workspaceSchoolId: schoolId }))
          throw new WorkspaceAuthError('STALE_RESPONSE');
      });
      return context;
    } catch (e) {
      const current = await this.store.get(key);
      if (scope.generation === ticket) scope.invalidate();
      if (!current || current.workspaceGeneration !== record.workspaceGeneration) throw new WorkspaceAuthError('STALE_RESPONSE');
      throw e;
    }
  }

  async runWorkspace<T>(req: BffRequest, work: (accessToken: string, signal: AbortSignal, schoolId: string) => Promise<T>): Promise<T> {
    const { key, record } = await this.session(req), scope = this.scope(key);
    if (!record.workspaceSchoolId) throw new WorkspaceAuthError('ACCESS_DENIED');
    try {
      return await scope.run(async signal => {
        const value = await work(record.secret.accessToken,signal,record.workspaceSchoolId!);
        const current = await this.store.get(key);
        if (!current || current.workspaceGeneration !== record.workspaceGeneration) throw new WorkspaceAuthError('STALE_RESPONSE');
        return value;
      });
    } catch (e) {
      if (e instanceof WorkspaceAuthError && e.code === 'ACCESS_DENIED') {
        await this.store.withLock(key, async () => {
          const current = await this.store.get(key);
          if (current && current.workspaceGeneration === record.workspaceGeneration) {
            await this.store.compareAndSwap(key,current.revision,{ ...current, revision: current.revision+1,
              workspaceGeneration: current.workspaceGeneration+1, workspaceSchoolId: undefined });
            scope.invalidate();
          }
        });
      }
      throw e;
    }
  }
}
