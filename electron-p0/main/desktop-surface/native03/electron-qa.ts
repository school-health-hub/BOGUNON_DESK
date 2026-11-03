import {app,BrowserWindow,session} from 'electron';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import {approveHost} from '../native02/approved-host.js';
import {NativeHostLauncher} from '../native02/launcher.js';
import {HostError,fixedError} from '../native02/errors.js';
import {WindowsInspector} from '../native02/windows-inspector.js';
import {createMainHostSession} from './main-session.js';
import {installNativeQuitBoundary} from './quit-boundary.js';
import {QaChildObservation,rejectForeignGrant} from './qa-scenarios.js';

const sha=z.string().regex(/^[a-f0-9]{40}$/);
const manifest=z.strictObject({sourceSha:sha,hostSha256:z.string().regex(/^[a-f0-9]{64}$/),
  caseId:z.enum(['normal','foreign-grant','unexpected-exit','quit-delay','missing-exe','digest-mismatch'])});
const meta=z.strictObject({sourceSha:sha});

/** Selected only by Main's isolated QA switch. No product profile, services or renderer bridge is initialized. */
export async function runNativeMainQa():Promise<void>{
  if(process.platform!=='win32'||app.isPackaged||app.commandLine.hasSwitch('no-sandbox')
    ||app.commandLine.hasSwitch('disable-web-security'))throw new HostError('AuthenticationFailed');
  const root=app.getAppPath();
  const config=manifest.parse(JSON.parse(readFileSync(join(root,'native-surface-qa.json'),'utf8')));
  const build=meta.parse(JSON.parse(readFileSync(join(root,'build-meta.json'),'utf8')));
  if(config.sourceSha!==build.sourceSha)throw new HostError('AuthenticationFailed');
  const qa=join(root,'native-surface-qa');
  if(existsSync(qa))throw new HostError('PathRejected');
  mkdirSync(qa);
  for(const name of ['profile','chromium','crashes','logs'])mkdirSync(join(qa,name));
  app.setName('BOGUNON Native03 isolated QA');
  app.setPath('userData',join(qa,'profile'));app.setPath('sessionData',join(qa,'chromium'));
  app.setPath('crashDumps',join(qa,'crashes'));app.setAppLogsPath(join(qa,'logs'));
  await app.whenReady();
  const partition=session.fromPartition('native03-ephemeral');
  partition.setPermissionRequestHandler((_a,_b,done)=>done(false));
  partition.setPermissionCheckHandler(()=>false);
  partition.webRequest.onBeforeRequest((_details,done)=>done({cancel:true}));
  const window=new BrowserWindow({show:false,width:640,height:480,
    webPreferences:{session:partition,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,webviewTag:false}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  const observation=new QaChildObservation(config.caseId==='quit-delay');
  const inspector=new WindowsInspector();
  let normalWindowRequests=0;
  const service=createMainHostSession({mode:'isolated-qa',packaged:app.isPackaged},()=>{
    if(!approved)throw new HostError('AuthenticationFailed');
    return new NativeHostLauncher(approved,inspector,observation.spawn);
  },()=>{if(!window.isDestroyed())normalWindowRequests++;});
  let approved:Awaited<ReturnType<typeof approveHost>>|null=null;
  let passed=false,error:string|null=null,authenticated=false,rejected=false,unexpected=false;
  let foreignExitVerified=false;
  const started=Date.now();
  installNativeQuitBoundary(app,service,async stopError=>{
    const ordinaryWindowAlive=!window.isDestroyed();
    const snapshot=service.snapshot;
    const processExitVerified=snapshot.host?.processExitVerified??
      (config.caseId==='foreign-grant'?foreignExitVerified:!observation.child);
    const host=snapshot.host;
    const terminalExpected=!host||(!host.forcedTermination&&
      (config.caseId==='unexpected-exit'?host.state==='CleanupUnknown':host.error===null));
    const result={schema:1,sourceSha:config.sourceSha,caseId:config.caseId,electron:process.versions.electron,
      passed:passed&&stopError===null&&ordinaryWindowAlive&&processExitVerified&&terminalExpected,error:stopError??error,
      authenticated,rejected,unexpected,ordinaryWindowAlive,normalWindowRequests,
      exitObservationDelayMs:config.caseId==='quit-delay'?500:0,
      elapsedMs:Date.now()-started,processExitVerified,nativeCleanup:'NotVerified',nativeAttachmentVerified:false,
      beforeQuitObserved:true,snapshot};
    writeFileSync(join(qa,'RESULT.json'),JSON.stringify(result,null,2),{flag:'wx'});
    if(!result.passed)process.exitCode=1;
  });
  try{
    approved=await approveHost({mode:'packaged',root,sha256:config.caseId==='digest-mismatch'?'0'.repeat(64):config.hostSha256,
      sourceSha:config.sourceSha});
    if(config.caseId==='foreign-grant'){
      rejected=await rejectForeignGrant(approved,inspector);foreignExitVerified=rejected;passed=rejected;
    }else{
      authenticated=(await service.start()).state==='Authenticated';
      if(config.caseId==='unexpected-exit'){
        await observation.unexpectedExit(service);unexpected=true;
      }else{
        await service.checkHealth();
        try{await service.start();throw new HostError('ProtocolRejected');}
        catch(cause){if(!(cause instanceof HostError)||cause.code!=='AlreadyStarted')throw cause;}
      }
      passed=authenticated&&(!window.isDestroyed());
    }
  }catch(cause){
    error=fixedError(cause).code;
    rejected=(config.caseId==='missing-exe'&&error==='MissingExecutable')
      ||(config.caseId==='digest-mismatch'&&error==='DigestMismatch');
    passed=rejected;
  }
  app.quit();
}
