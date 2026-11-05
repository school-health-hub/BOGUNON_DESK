/** Optional Main composition seam. Does not register OS protocols, open windows or connect to Auth at import time. */
import { WindowsSessionVault, FileSessionBlob, type SafeStoragePort } from './vault.js';
import { ElectronMainAuthAdapter } from './main-adapter.js';
import { registerWorkspaceAuthIpc, type IpcMainPort } from './ipc.js';
import { CallbackFlows } from '../server/flow.js';
import type { IdentityProvider } from '../server/ports.js';
import { WorkspaceAuthError } from '../common/types.js';
export function assembleElectronWorkspaceAuth(input: {
  processType: string; platform: NodeJS.Platform; userData: string; safeStorage: SafeStoragePort;
  ipcMain: IpcMainPort; contents: { mainFrame: unknown; getURL(): string }; rendererUrl: string;
  callbackBase: string; authOrigin: string; openExternal: (url: string) => Promise<void>; provider: IdentityProvider;
}): { adapter: ElectronMainAuthAdapter; handleOsCallback: (url: string) => Promise<void>; dispose: () => void } {
  if (input.processType !== 'browser') throw new WorkspaceAuthError('CONFIGURATION_ERROR');
  const adapter = new ElectronMainAuthAdapter(input.provider,
    new WindowsSessionVault(input.safeStorage,new FileSessionBlob(input.userData),input.platform),
    new CallbackFlows(input.callbackBase),input.openExternal,input.authOrigin);
  const removeHandlers = registerWorkspaceAuthIpc(input.ipcMain,input.contents,input.rendererUrl,adapter);
  return { adapter, handleOsCallback: url=>adapter.handleCallback(url), dispose: ()=>{adapter.workspace.invalidate();removeHandlers();} };
}
