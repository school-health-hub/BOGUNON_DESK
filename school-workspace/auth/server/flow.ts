import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WorkspaceAuthError } from '../common/types.js';
export const randomHandle = (): string => randomBytes(32).toString('base64url');
export function sameSecret(a: string, b: string): boolean {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export interface LoginFlow { id: string; state: string; expiresAt: number; claimed: boolean }
export class CallbackFlows {
  #flows = new Map<string, LoginFlow>();
  constructor(readonly callbackBase: string, private readonly now: () => number = Date.now) {
    const u = new URL(callbackBase);
    if (!['https:','bogunon-desk:'].includes(u.protocol) || u.username || u.password || u.search || u.hash)
      throw new WorkspaceAuthError('CONFIGURATION_ERROR');
  }
  create(): { flow: LoginFlow; redirectTo: string } {
    this.prune();
    if (this.#flows.size >= 1000) throw new WorkspaceAuthError('AUTH_SERVER_ERROR');
    const flow = { id: randomHandle(), state: randomHandle(), expiresAt: this.now() + 300_000, claimed: false };
    this.#flows.set(flow.id, flow);
    const u = new URL(this.callbackBase); u.searchParams.set('ws_flow', flow.id); u.searchParams.set('ws_state', flow.state);
    return { flow: { ...flow }, redirectTo: u.href };
  }
  consume(raw: string, expectedFlow?: string): { flowId: string; code: string } {
    let u: URL;
    try { if (raw.length > 8192) throw Error(); u = new URL(raw); } catch { throw new WorkspaceAuthError('INVALID_CALLBACK'); }
    const b = new URL(this.callbackBase), keys = [...u.searchParams.keys()];
    if (u.protocol !== b.protocol || u.hostname !== b.hostname || u.port !== b.port || u.pathname !== b.pathname
      || u.username || u.password || u.hash || keys.some(k => !['code','ws_flow','ws_state','error'].includes(k))
      || new Set(keys).size !== keys.length) throw new WorkspaceAuthError('INVALID_CALLBACK');
    const id = u.searchParams.get('ws_flow') ?? '', state = u.searchParams.get('ws_state') ?? '';
    const flow = this.#flows.get(id);
    if (!flow || (expectedFlow !== undefined && !sameSecret(id, expectedFlow)) || !sameSecret(state, flow.state))
      throw new WorkspaceAuthError('FLOW_MISMATCH');
    if (flow.expiresAt <= this.now()) { this.#flows.delete(id); throw new WorkspaceAuthError('FLOW_EXPIRED'); }
    if (flow.claimed) throw new WorkspaceAuthError('CALLBACK_REPLAY');
    if (u.searchParams.has('error') && !u.searchParams.has('code')) {
      flow.claimed = true; throw new WorkspaceAuthError('AUTH_CANCELLED');
    }
    const code = u.searchParams.get('code');
    if (!code || code.length > 2048 || !/^[A-Za-z0-9._~-]+$/.test(code) || u.searchParams.has('error'))
      throw new WorkspaceAuthError('INVALID_CALLBACK');
    flow.claimed = true; // Consume synchronously, before any exchange await; never retry a used code.
    return { flowId: id, code };
  }
  cancel(id: string): void { this.#flows.delete(id); }
  private prune(): void { for (const [id, f] of this.#flows) if (f.expiresAt <= this.now()) this.#flows.delete(id); }
}
