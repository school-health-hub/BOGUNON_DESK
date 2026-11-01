import { app, BrowserWindow, ipcMain, session, Menu, Tray, nativeImage, screen } from 'electron';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { APP_ID, PRODUCT_NAME, PROFILE_NAME } from '../protocol.js';
import { desktopDefaults, validateDesktop, fitBounds, type DesktopState } from './desktop.js';
import { SettingsStore } from './settings.js';
import { createSampleHandler, SAMPLE_SUMMARY_CHANNEL } from './sample-ipc.js';
import { assertSender, resourceAllowed } from './policy.js';
if (app.commandLine.hasSwitch('no-sandbox') || app.commandLine.hasSwitch('disable-web-security')) throw new Error('Unsafe Electron launch flags denied');
app.setName(PRODUCT_NAME);
const testRun = process.env.ELECTRON_P0_TEST_RUN;
if (testRun && !/^[a-f0-9-]{36}$/.test(testRun)) throw new Error('Invalid PoC test run');
const userData = testRun ? join(app.getPath('appData'),PROFILE_NAME,'test-runs',testRun) : join(app.getPath('appData'),PROFILE_NAME);
app.setPath('userData',userData);
app.setPath('sessionData',join(userData,'chromium'));
app.setAppUserModelId(APP_ID);
const store = new SettingsStore(join(userData,'poc-settings'));
let quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  void app.whenReady().then(async()=>{
  const desktopStore=new SettingsStore<DesktopState>(join(userData,'poc-settings'),'desktop.json',validateDesktop);
  let desktop=await desktopStore.read().catch(()=>null)??desktopDefaults();
  let tray:Tray|null=null;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const renderer = join(app.getAppPath(),'renderer');
  const dev = process.env.ELECTRON_P0_DEV_URL || undefined;
  if (dev && (app.isPackaged || dev !== 'http://127.0.0.1:5174/')) throw new Error('Invalid PoC dev URL');
  const url = dev ?? pathToFileURL(join(renderer,'index.html')).href;
  const isolated = session.fromPartition('persist:electron-p0');
  isolated.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  isolated.setPermissionCheckHandler(()=>false);
  isolated.on('will-download',event=>event.preventDefault());
  isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!resourceAllowed(details.url,renderer,dev ? new URL(dev).origin : undefined)}));
  const window = new BrowserWindow({ title:PRODUCT_NAME,...fitBounds(desktop.bounds,screen.getAllDisplays().map(d=>d.workArea)),show:false,
    webPreferences:{ preload:join(app.getAppPath(),'preload','preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webviewTag:false,session:isolated,webSecurity:true } });
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.on('will-redirect',event=>event.preventDefault());
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  const meta = JSON.parse(await readFile(join(app.getAppPath(),'build-meta.json'),'utf8')) as {sourceSha:string};
  for (const channel of ['p0:info','p0:read-settings','p0:write-settings']) ipcMain.handle(channel,async(event,...args: unknown[])=>{
    assertSender(event,window.webContents,url);
    if (args.length !== (channel === 'p0:write-settings' ? 1 : 0)) throw new Error('Invalid PoC IPC arguments');
    if (channel === 'p0:info') return {appId:APP_ID,productName:PRODUCT_NAME,userData,sourceSha:meta.sourceSha,electron:process.versions.electron};
    if (channel === 'p0:read-settings') return store.read();
    return store.write(args[0]);
  });
  ipcMain.handle(SAMPLE_SUMMARY_CHANNEL,createSampleHandler(window.webContents,url));
  const show=()=>{if(window.isMinimized())window.restore();window.show();window.focus();};
  const persist=async()=>{
    try{await desktopStore.write(desktop);return true;}
    catch{desktop.closeBehavior='quit';refreshMenu();return false;}
  };
  const capture=()=>{if(!window.isDestroyed()&&!window.isMinimized()){desktop.bounds=fitBounds(window.getNormalBounds(),screen.getAllDisplays().map(d=>d.workArea));desktop.maximized=window.isMaximized();}};
  const quit=()=>{if(quitting)return;quitting=true;clearTimeout(timer);capture();void persist().then(()=>Promise.all([store.flush(),desktopStore.flush()])).finally(()=>{tray?.destroy();app.quit();});};
  const refreshMenu=()=>{
    const items:Electron.MenuItemConstructorOptions[]=[
      {label:'창 열기',click:show},{label:'최소화',click:()=>window.minimize()},
      {label:'닫을 때 트레이로 숨기기',type:'checkbox',checked:desktop.closeBehavior==='tray',enabled:tray!==null,click:async item=>{desktop.closeBehavior=item.checked?'tray':'quit';await persist();refreshMenu();}},
      {type:'separator'},{label:'완전 종료',click:quit}
    ];
    tray?.setContextMenu(Menu.buildFromTemplate(items));
    Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'창',submenu:items}]));
  };
  try{const icon=nativeImage.createFromPath(join(app.getAppPath(),'tray.png'));if(icon.isEmpty())throw Error('No tray icon');tray=new Tray(icon);tray.setToolTip(PRODUCT_NAME);tray.on('double-click',show);}catch{desktop.closeBehavior='quit';}
  refreshMenu();
  const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>{capture();void persist();},250);};
  window.on('move',changed);window.on('resize',changed);window.on('maximize',changed);window.on('unmaximize',changed);
  const adjust=()=>{const bounds=fitBounds(window.getNormalBounds(),screen.getAllDisplays().map(d=>d.workArea));window.setBounds(bounds);changed();};
  screen.on('display-added',adjust);screen.on('display-removed',adjust);screen.on('display-metrics-changed',adjust);
  app.on('second-instance',show);
  window.once('ready-to-show',()=>{if(desktop.maximized)window.maximize();window.show();});
  window.on('close',event=>{if(quitting)return;event.preventDefault();if(desktop.closeBehavior==='tray'&&tray){capture();window.hide();void persist().then(ok=>{if(!ok)show();});}else quit();});
  app.on('before-quit',event=>{if(!quitting){event.preventDefault();quit();}});
  app.on('window-all-closed',quit);
  await window.loadURL(url);
  }).catch((error: unknown)=>{ console.error('Electron P0 startup failed:', error instanceof Error ? error.message : 'unknown'); app.exit(1); });
}
