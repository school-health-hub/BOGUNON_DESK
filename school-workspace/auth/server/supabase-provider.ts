import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { WorkspaceAuthError, userSummary } from '../common/types.js';
import type { IdentityProvider, SecretSession } from './ports.js';
/** Offline by default. Caller MUST deliberately inject an approved transport; no global fetch fallback. */
export class SupabaseIdentityProvider implements IdentityProvider {
  #flows = new Map<string, { client: SupabaseClient; values: Map<string, string> }>();
  constructor(private readonly origin: string, private readonly publishableKey: string,
    private readonly transport: typeof fetch = async () => { throw new WorkspaceAuthError('CONFIGURATION_ERROR'); }) {
    const u = new URL(origin);
    if (u.protocol !== 'https:' || u.origin !== origin || !publishableKey.startsWith('sb_publishable_'))
      throw new WorkspaceAuthError('CONFIGURATION_ERROR');
  }
  private client(values = new Map<string, string>()): SupabaseClient {
    return createClient(this.origin, this.publishableKey, { global: { fetch: (input, init) => {
      const u = new URL(input instanceof Request ? input.url : String(input));
      if (u.origin !== this.origin || !['/auth/v1/token','/auth/v1/user','/auth/v1/logout'].includes(u.pathname))
        throw new WorkspaceAuthError('CONFIGURATION_ERROR');
      return this.transport(input,{ ...init, redirect: 'error' });
    } }, auth: {
      flowType: 'pkce', detectSessionInUrl: false, autoRefreshToken: false, persistSession: true,
      storageKey: 'ws-server-auth', storage: { getItem: k => values.get(k) ?? null,
        setItem: (k,v) => { values.set(k,v); }, removeItem: k => { values.delete(k); } },
    } });
  }
  async start({ flowId, redirectTo }: { flowId: string; redirectTo: string }): Promise<string> {
    const values = new Map<string, string>(), client = this.client(values);
    this.#flows.set(flowId, { client, values });
    try {
      const { data, error } = await client.auth.signInWithOAuth({ provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
      if (error || !data.url) throw new WorkspaceAuthError('AUTH_SERVER_ERROR');
      this.assertAuthorizationUrl(data.url); return data.url;
    } catch { this.forget(flowId); throw new WorkspaceAuthError('AUTH_SERVER_ERROR'); }
  }
  assertAuthorizationUrl(raw: string): void {
    const u = new URL(raw);
    if (u.origin !== this.origin || u.pathname !== '/auth/v1/authorize' || u.username || u.password || u.hash
      || u.searchParams.get('provider') !== 'google' || u.searchParams.get('code_challenge_method') !== 's256')
      throw new WorkspaceAuthError('CONFIGURATION_ERROR');
  }
  async exchange(flowId: string, code: string): Promise<SecretSession> {
    const f = this.#flows.get(flowId); if (!f) throw new WorkspaceAuthError('FLOW_MISMATCH');
    try {
      const { data, error } = await f.client.auth.exchangeCodeForSession(code);
      if (error || !data.session) throw Error(); return this.toSecret(data.session);
    } catch { throw new WorkspaceAuthError('AUTH_SERVER_ERROR'); }
    finally { this.forget(flowId); }
  }
  forget(id: string): void { const f = this.#flows.get(id); if (f) { f.client.auth.stopAutoRefresh(); f.values.clear(); this.#flows.delete(id); } }
  async refresh(session: SecretSession): Promise<SecretSession> {
    const values = new Map<string,string>(), client = this.client(values);
    try {
      const { data, error } = await client.auth.refreshSession({ refresh_token: session.refreshToken });
      if (error || !data.session || data.session.user.id !== session.userId) throw Error();
      return this.toSecret(data.session);
    } catch { throw new WorkspaceAuthError('AUTH_SERVER_ERROR'); }
    finally { client.auth.stopAutoRefresh(); values.clear(); }
  }
  async revoke(session: SecretSession): Promise<void> {
    // Official user-session API only; the client has a publishable key, never service_role.
    const values = new Map<string,string>(), client = this.client(values);
    try {
      const restored = await client.auth.setSession({ access_token: session.accessToken, refresh_token: session.refreshToken });
      if (restored.error) throw Error();
      const { error } = await client.auth.signOut({ scope: 'local' }); if (error) throw Error();
    }
    catch { throw new WorkspaceAuthError('AUTH_SERVER_ERROR'); }
    finally { values.clear(); client.auth.stopAutoRefresh(); }
  }
  private toSecret(s: Session): SecretSession {
    return { userId: userSummary(s.user.id).id, accessToken: s.access_token,
      refreshToken: s.refresh_token, expiresAt: (s.expires_at ?? 0) * 1000 };
  }
}
