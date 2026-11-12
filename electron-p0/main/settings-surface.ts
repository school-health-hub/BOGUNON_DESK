import { BrowserWindow, session, type IpcMain } from 'electron';
import { createSchoolHandlers, type SchoolProfileStore } from './school-profile.js';
import { createAccountHandlers } from './account-ipc.js';
import { createAiHandlers, type AiService } from './ai-service.js';
import { createChatGptHandlers, type ChatGptService } from './chatgpt-service.js';
import { createAdminHandlers } from './admin-ipc.js';
import type { AccountService } from './account-service.js';
import { resourceAllowed } from './policy.js';
import { notifySchoolChange } from './school-settings-notification.js';

export function createSettingsWindow(input: Readonly<{ preload: string; renderer: string; dev?: string; quitting: () => boolean }>): BrowserWindow {
  const isolated = session.fromPartition('persist:electron-p0-settings');
  isolated.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  isolated.setPermissionCheckHandler(() => false);
  isolated.on('will-download', event => event.preventDefault());
  isolated.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !resourceAllowed(details.url, input.renderer, input.dev ? new URL(input.dev).origin : undefined) }));
  const window = new BrowserWindow({ title: 'BOGUNON DESK 설정', width: 1080, height: 780, minWidth: 720, minHeight: 560, show: false,
    webPreferences: { preload: input.preload, session: isolated, sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-redirect', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('close', event => { if (!input.quitting()) { event.preventDefault(); window.hide(); } });
  return window;
}

type Services = Readonly<{
  account: AccountService;
  school: SchoolProfileStore;
  schoolFetch: Parameters<typeof createSchoolHandlers>[2]['fetch'];
  reviewAccount: Parameters<typeof createAccountHandlers>[4];
  ai: AiService;
  chatgpt: ChatGptService;
  admin: Parameters<typeof createAdminHandlers>[2];
  schoolChanged: () => void;
}>;

// Each factory still checks the actual Settings webContents, main frame and URL.
// Only configuration capabilities are registered; business generation/file APIs are absent.
export function registerSettingsCapabilities(ipc: IpcMain, window: BrowserWindow, url: string, services: Services): () => void {
  const school = createSchoolHandlers(window.webContents, url, { store: services.school, fetch: services.schoolFetch });
  const account = createAccountHandlers(window.webContents, url, services.account, services.school, services.reviewAccount);
  const ai = createAiHandlers(window.webContents, url, services.ai);
  const chatgpt = createChatGptHandlers(window.webContents, url, services.chatgpt);
  const admin = createAdminHandlers(window.webContents, url, services.admin);
  for (const action of ['load','search','select','cancel'] as const) ipc.handle(`p0:settings:school:${action}`, action==='select'?notifySchoolChange(school[action],services.schoolChanged):school[action]);
  for (const action of ['status','signIn','signOut','cancel','refresh','applySchool'] as const) ipc.handle(`p0:settings:account:${action}`, action==='applySchool'?notifySchoolChange(account[action],services.schoolChanged):account[action]);
  for (const action of ['status','connectFromClipboard','restore','selectModel','cancel','disconnect'] as const) ipc.handle(`p0:settings:ai:${action}`, ai[action]);
  for (const action of ['status','signIn','refreshModels','selectModel','acknowledge','disconnect','cancel'] as const) ipc.handle(`p0:settings:chatgpt:${action}`, chatgpt[action]);
  for (const action of ['schoolAddresses','applySchoolAddresses','openSystem','cancel'] as const) ipc.handle(`p0:settings:admin:${action}`, action==='applySchoolAddresses'?notifySchoolChange(admin[action],services.schoolChanged):admin[action]);
  window.webContents.on('will-navigate', account.invalidate);
  window.webContents.on('render-process-gone', account.invalidate);
  return () => { school.dispose(); account.invalidate(); admin.dispose(); };
}
