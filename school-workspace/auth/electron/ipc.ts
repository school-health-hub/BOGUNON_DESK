import { AUTH_CHANNELS, type AuthReply } from './ipc-contract.js';
import { assertSender } from '../../../electron-p0/main/policy.js';
import { asAuthError } from '../common/types.js';
import type { ElectronMainAuthAdapter } from './main-adapter.js';
export interface IpcMainPort { handle(channel: string, handler: (event: { sender: unknown; senderFrame: unknown }, ...args: unknown[]) => Promise<AuthReply>): void; removeHandler(channel: string): void }
export function registerWorkspaceAuthIpc(ipc: IpcMainPort, contents: { mainFrame: unknown; getURL(): string }, expectedUrl: string, adapter: ElectronMainAuthAdapter): () => void {
  for (const [action, channel] of Object.entries(AUTH_CHANNELS)) ipc.handle(channel, async (event, ...args) => {
    try { assertSender(event, contents, expectedUrl); if (args.length) return { ok: false, error: 'IPC_REJECTED' }; }
    catch { return { ok: false, error: 'IPC_REJECTED' }; }
    try {
      if (action === 'begin') await adapter.beginSignIn();
      if (action === 'restore') await adapter.restore();
      if (action === 'logout') await adapter.logout();
      assertSender(event, contents, expectedUrl);
      return { ok: true, status: await adapter.getStatus() };
    } catch (e) { return { ok: false, error: asAuthError(e).code }; }
  });
  return () => { for (const channel of Object.values(AUTH_CHANNELS)) ipc.removeHandler(channel); };
}
