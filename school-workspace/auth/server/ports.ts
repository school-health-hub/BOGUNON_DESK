/** MAIN/BFF only. Never import into Renderer or common DTO modules. */
export interface SecretSession { userId: string; accessToken: string; refreshToken: string; expiresAt: number }
export interface IdentityProvider {
  start(input: { flowId: string; redirectTo: string }): Promise<string>;
  exchange(flowId: string, code: string): Promise<SecretSession>;
  forget(flowId: string): void;
  refresh(session: SecretSession): Promise<SecretSession>;
  revoke(session: SecretSession): Promise<void>;
}
export interface SecretVault { load(): Promise<SecretSession | null>; save(value: SecretSession): Promise<void>; clear(): Promise<void> }
export class Mutex {
  #tail: Promise<unknown> = Promise.resolve();
  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(work); this.#tail = result.catch(() => undefined); return result;
  }
}
