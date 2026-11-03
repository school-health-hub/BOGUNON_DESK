import {app,BrowserWindow,session} from 'electron';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import {approveHost} from '../native02/approved-host.js';
import {NativeHostLauncher} from '../native02/launcher.js';
import {HostError,fixedError} from '../native02/errors.js';
import {WindowsInspector} from '../native02/windows-inspector.js';
import {createMainHostSession} from '../native03/main-session.js';
import {installNativeQuitBoundary} from '../native03/quit-boundary.js';
import {DryRunExtension,cases} from './dry-run.js';
const sha=z.string().regex(/^[a-f0-9]{40}$/);
const manifest=z.strictObject({sourceSha:sha,hostSha256:z.string().regex(/^[a-f0-9]{64}$/),caseId:z.enum(cases)});
/** Explicit Main-only isolated entry; synchronous profile redirection precedes first await. */
export async function runWorkerwDryRunQa():Promise<void>{
  if(process.platform!=='win32'||app.isPackaged||app.commandLine.hasSwitch('no-sandbox')
    ||app.commandLine.hasSwitch('disable-web-security'))throw new HostError('AuthenticationFailed');
  const root=app.getAppPath();
  const config=manifest.parse(JSON.parse(readFileSync(join(root,'native-surface-qa.json'),'utf8')));
  const build=z.strictObject({sourceSha:sha}).parse(JSON.parse(readFileSync(join(root,'build-meta.json'),'utf8')));
  if(config.sourceSha!==build.sourceSha)throw new HostError('AuthenticationFailed');
  const qa=join(root,'native-surface-qa');if(existsSync(qa))throw new HostError('PathRejected');mkdirSync(qa);
  for(const name of ['profile','chromium','crashes','logs'])mkdirSync(join(qa,name));
  app.setName('BOGUNON Native04B isolated QA');
  app.setPath('userData',join(qa,'profile'));app.setPath('sessionData',join(qa,'chromium'));
  app.setPath('crashDumps',join(qa,'crashes'));app.setAppLogsPath(join(qa,'logs'));
  await app.whenReady();
  const partition=session.fromPartition('native04b-ephemeral');
  partition.setPermissionRequestHandler((_a,_b,done)=>done(false));partition.setPermissionCheckHandler(()=>false);
  partition.webRequest.onBeforeRequest((_details,done)=>done({cancel:true}));
  const window=new BrowserWindow({show:false,width:640,height:480,webPreferences:{session:partition,
    sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,webviewTag:false}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  const extension=new DryRunExtension(config.sourceSha,config.caseId);
  const inspector=new WindowsInspector();
  let launcher:NativeHostLauncher|null=null,approved:Awaited<ReturnType<typeof approveHost>>|null=null;
  let normalWindowRequests=0,passed=false,error:string|null=null,authenticated=false;
  const service=createMainHostSession({mode:'isolated-qa',packaged:app.isPackaged},()=>{
    if(!approved)throw new HostError('AuthenticationFailed');
    launcher=new NativeHostLauncher(approved,inspector,undefined,extension);return launcher;
  },()=>{if(!window.isDestroyed())normalWindowRequests++;});
  const started=Date.now();
  installNativeQuitBoundary(app,service,async stopError=>{
    const snapshot=service.snapshot,host=snapshot.host,ordinaryWindowAlive=!window.isDestroyed();
    const result={schema:1,sourceSha:config.sourceSha,caseId:config.caseId,electron:process.versions.electron,
      passed:passed&&stopError===null&&ordinaryWindowAlive&&host?.processExitVerified===true
        &&host.forcedTermination===false&&host.error===null,error:stopError??error,
      authenticated,reports:extension.reports,ordinaryWindowAlive,normalWindowRequests,elapsedMs:Date.now()-started,
      processExitVerified:host?.processExitVerified===true,nativeCleanup:'NotVerified',nativeAttachmentVerified:false,snapshot};
    writeFileSync(join(qa,'RESULT.json'),JSON.stringify(result,null,2),{flag:'wx'});
    if(!result.passed)process.exitCode=1;
  });
  try{
    approved=await approveHost({mode:'packaged',root,sha256:config.hostSha256,sourceSha:config.sourceSha});
    authenticated=(await service.start()).state==='Authenticated';
    if(!launcher)throw new HostError('AuthenticationFailed');
    await (launcher as NativeHostLauncher).runTrustedExtension();passed=authenticated&&!window.isDestroyed();
  }catch(cause){error=fixedError(cause).code;passed=false;}
  app.quit();
}
