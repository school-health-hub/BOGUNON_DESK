import { Mutex, type SecretSession } from '../server/ports.js';
export interface WebSessionRecord { revision: number; secret: SecretSession; csrf: string; hardExpiresAt: number; workspaceGeneration: number; workspaceSchoolId?: string }
/** Production implementation MUST supply atomic CAS/revoke and a shared per-key lock across all BFF instances. */
export interface WebSessionStore {
  readonly testOnly: boolean;
  get(keyHash: string): Promise<WebSessionRecord | null>;
  create(keyHash: string, record: WebSessionRecord): Promise<void>;
  compareAndSwap(keyHash: string, revision: number, next: WebSessionRecord): Promise<boolean>;
  revoke(keyHash: string): Promise<void>;
  withLock<T>(keyHash: string, work: () => Promise<T>): Promise<T>;
}
/** TEST ONLY: plaintext RAM secrets, single-process lifetime, never a production store. */
export class MemoryWebSessionStore implements WebSessionStore {
  readonly testOnly = true;
  #records = new Map<string, WebSessionRecord>();
  #locks = new Map<string, { mutex: Mutex; users: number }>();
  async get(k: string): Promise<WebSessionRecord | null> { const v = this.#records.get(k); return v ? structuredClone(v) : null; }
  async create(k: string, r: WebSessionRecord): Promise<void> { if (this.#records.has(k)) throw Error(); this.#records.set(k, structuredClone(r)); }
  async compareAndSwap(k: string, revision: number, r: WebSessionRecord): Promise<boolean> {
    if (this.#records.get(k)?.revision !== revision) return false;
    this.#records.set(k, structuredClone(r)); return true;
  }
  async revoke(k: string): Promise<void> { this.#records.delete(k); }
  async withLock<T>(k: string, work: () => Promise<T>): Promise<T> {
    const entry = this.#locks.get(k) ?? { mutex: new Mutex(), users: 0 }; entry.users++; this.#locks.set(k, entry);
    try { return await entry.mutex.run(work); } finally { if (--entry.users === 0) this.#locks.delete(k); }
  }
}
