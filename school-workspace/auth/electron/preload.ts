import { AUTH_CHANNELS, type AuthPreloadBridge, type AuthReply } from './ipc-contract.js';
export function createAuthPreloadBridge(invoke: (channel: string) => Promise<AuthReply>): Readonly<AuthPreloadBridge> {
  return Object.freeze({ status: () => invoke(AUTH_CHANNELS.status), begin: () => invoke(AUTH_CHANNELS.begin),
    restore: () => invoke(AUTH_CHANNELS.restore), logout: () => invoke(AUTH_CHANNELS.logout) });
}

export function exposeWorkspaceAuthBridge(exposeInMainWorld: (key: string, api: Readonly<AuthPreloadBridge>) => void, invoke: (channel: string) => Promise<AuthReply>): void {
  exposeInMainWorld('workspaceAuth',createAuthPreloadBridge(invoke));
}
