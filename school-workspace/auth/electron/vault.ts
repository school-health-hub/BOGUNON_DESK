import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { WorkspaceAuthError } from '../common/types.js';
import { validateSession } from '../server/session.js';
import type { SecretSession, SecretVault } from '../server/ports.js';
export interface SafeStoragePort { isEncryptionAvailable(): boolean; encryptString(value: string): Buffer; decryptString(value: Buffer): string }
export interface CipherBlobPort { read(): Promise<Buffer | null>; replace(value: Buffer): Promise<void>; remove(): Promise<void> }
export class WindowsSessionVault implements SecretVault {
  constructor(private readonly storage: SafeStoragePort, private readonly blob: CipherBlobPort,
    private readonly platform = process.platform) {}
  private available(): void {
    if (this.platform !== 'win32' || !this.storage.isEncryptionAvailable()) throw new WorkspaceAuthError('STORAGE_UNAVAILABLE');
  }
  async load(): Promise<SecretSession | null> {
    this.available();
    try { const b = await this.blob.read(); return b ? validateSession(JSON.parse(this.storage.decryptString(b))) : null; }
    catch { throw new WorkspaceAuthError('SESSION_CORRUPT'); }
  }
  async save(s: SecretSession): Promise<void> {
    this.available();
    try { await this.blob.replace(this.storage.encryptString(JSON.stringify(validateSession(s)))); }
    catch { throw new WorkspaceAuthError('STORAGE_UNAVAILABLE'); }
  }
  async clear(): Promise<void> {
    try { await this.blob.remove(); } catch { throw new WorkspaceAuthError('STORAGE_UNAVAILABLE'); }
  }
}
/** Fixed path, independent from Finance/AI/Tauri. No caller-supplied filename API. */
export class FileSessionBlob implements CipherBlobPort {
  readonly #directory: string;
  readonly #path: string;
  constructor(profileDirectory: string) {
    this.#directory = join(profileDirectory, 'school-workspace-auth-v1'); this.#path = join(this.#directory, 'session.bin');
  }
  private async check(): Promise<void> {
    for (const path of [this.#directory, this.#path]) {
      try { const s = await lstat(path); if (s.isSymbolicLink() || (path === this.#path && (!s.isFile() || s.nlink !== 1 || s.size > 262144))) throw Error(); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    }
  }
  async read(): Promise<Buffer | null> {
    await this.check();
    try { return await readFile(this.#path); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
  }
  async replace(value: Buffer): Promise<void> {
    if (value.length > 262144) throw Error();
    await mkdir(this.#directory, { recursive: true, mode: 0o700 }); await this.check();
    const tmp = `${this.#path}.${randomUUID()}.tmp`;
    try { const f = await open(tmp, 'wx', 0o600); try { await f.writeFile(value); await f.sync(); } finally { await f.close(); }
      await rename(tmp, this.#path); } finally { await unlink(tmp).catch(() => undefined); }
  }
  async remove(): Promise<void> { await this.check(); await unlink(this.#path).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
}
