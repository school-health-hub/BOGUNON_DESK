import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const expectedSha=process.env.TD2_EXPECTED_SOURCE_SHA;
const executable=process.env.TD2_PORTABLE_EXE;
const evidenceRoot=process.env.TD2_EVIDENCE_ROOT;
const qaRoot=process.env.ELECTRON_P0_QA_ROOT;
const productRoot=process.env.TD2_PRODUCT_ROOT;
if(!expectedSha||!executable||!evidenceRoot||!qaRoot||!productRoot)throw new Error('Missing TD2 QA environment');
const requireFromProduct=createRequire(join(resolve(productRoot),'package.json'));
const {chromium}=requireFromProduct('@playwright/test');

const qaRun=randomUUID();
const port=19227;
const screenshots=join(evidenceRoot,'screenshots');
await mkdir(screenshots,{recursive:true});

const result={
  sourceSha:expectedSha,
  portableExecutable:resolve(executable),
  qaRun,
  qaRoot,
  actualUserData:'',
  devicePixelRatio:0,
  captures:[],
  actionability:{quickMemo:false,tools:false},
  shutdown:{browserCloseSent:false,wrapperExited:false},
  violations:[],
  verdict:'FAIL',
  error:null,
};

const isolatedAppData=join(qaRoot,'appdata'),isolatedLocalAppData=join(qaRoot,'localappdata');
await mkdir(isolatedAppData,{recursive:true});await mkdir(isolatedLocalAppData,{recursive:true});
const launch=()=>spawn(executable,[`--remote-debugging-port=${port}`,'--inspect=127.0.0.1:19228'],{
  cwd:process.cwd(),
  env:{...process.env,APPDATA:isolatedAppData,LOCALAPPDATA:isolatedLocalAppData,ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_TEST_RUN:qaRun,ELECTRON_P0_QA_ROOT:qaRoot,ELECTRON_P0_DEV_URL:''},
  stdio:['ignore','pipe','pipe'],
  windowsHide:false,
});

const seedRoot=join(qaRoot,'test-runs',qaRun,'user-data');
await mkdir(join(seedRoot,'poc-settings'),{recursive:true});
await writeFile(join(seedRoot,'poc-settings','desktop.json'),JSON.stringify({version:1,closeBehavior:'tray',maximized:false}));
await mkdir(join(seedRoot,'work-data/school-profile'),{recursive:true});
await writeFile(join(seedRoot,'work-data/school-profile/school.json'),JSON.stringify({version:1,revision:1,school:{officeCode:'K10',officeName:'강원특별자치도교육청',schoolCode:'1234567',schoolName:'합성 QA 긴 학교명 화면 표시 확인 전용 초등학교'}}));
await mkdir(join(seedRoot,'work-data/local-events'),{recursive:true});

let child=launch();
child.stdout.on('data',()=>{});
child.stderr.on('data',()=>{});

const ownedPids=new Set([child.pid]);
const psQuote=v=>"'"+v.replaceAll("'","''")+"'";
const ownedSnapshot=()=>{
 const script=`$all=@(Get-CimInstance Win32_Process);$ids=[System.Collections.Generic.HashSet[int]]::new();foreach($i in @(${[...ownedPids].join(',')})){[void]$ids.Add($i)};do{$added=$false;foreach($p in $all){if($ids.Contains([int]$p.ParentProcessId)-and !$ids.Contains([int]$p.ProcessId)){[void]$ids.Add([int]$p.ProcessId);$added=$true}}}while($added);$root=${psQuote(resolve(process.env.TEMP)+'\\')};$exe=${psQuote(resolve(executable))};@($all|Where-Object{($_.ExecutablePath -and ($_.ExecutablePath.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)-or $_.ExecutablePath -eq $exe))-and ($ids.Contains([int]$_.ProcessId)-or $_.Name -like 'BOGUNON*')}|Select-Object ProcessId,ParentProcessId,ExecutablePath,CreationDate)|ConvertTo-Json -Compress`;
 const raw=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8'}).trim();const v=raw?JSON.parse(raw):[];const rows=Array.isArray(v)?v:[v];for(const p of rows)ownedPids.add(p.ProcessId);return rows;
};
const cleanupOwned=async()=>{
 await closeBrowser();
 let remaining=ownedSnapshot();result.shutdown.beforeCleanup=remaining;
 for(let i=0;i<5&&remaining.length;i++){await delay(500);remaining=ownedSnapshot();}
 result.shutdown.forced=remaining.length>0;
 for(const p of remaining){
  const script=`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${p.ProcessId}';if($p -and [datetime]$p.CreationDate -eq [datetime] ${psQuote(p.CreationDate)}){Stop-Process -Id ${p.ProcessId} -Force -ErrorAction Stop}`;
  execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8'});
 }
 for(let i=0;i<10;i++){remaining=ownedSnapshot();if(!remaining.length)break;await delay(500);}
 result.shutdown.remaining=remaining;result.shutdown.zeroResidual=remaining.length===0;
 if(remaining.length)throw Error('Owned QA process cleanup failed');
};
let mainWs;
let browser;
let browserSession;
const delay=ms=>new Promise(resolveDelay=>setTimeout(resolveDelay,ms));
const closeBrowser=async()=>{
  if(!browserSession||result.shutdown.browserCloseSent)return;
  result.shutdown.browserCloseSent=true;
  await Promise.race([
    browserSession.send('Browser.close').catch(()=>undefined),
    delay(3000),
  ]);
};
const waitForCdp=async()=>{
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Portable wrapper exited before CDP: ${child.exitCode}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/version`);
      if(response.ok)return;
    }catch(error){
      if(!(error instanceof TypeError))throw error;
    }
    await delay(250);
  }
  throw new Error('Timed out waiting for Portable Electron CDP');
};
const waitForWrapperExit=async()=>{
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    if(child.exitCode!==null){
      if(child.exitCode!==0)throw new Error(`Portable wrapper exit ${child.exitCode}`);
      return;
    }
    await delay(100);
  }
  throw new Error('Portable wrapper did not exit after Browser.close');
};

const pngSize=buffer=>({
  width:buffer.readUInt32BE(16),
  height:buffer.readUInt32BE(20),
});
const setWindowBounds=(width,height)=>{
  const helper=join(dirname(fileURLToPath(import.meta.url)),'td2-window.ps1');
  const output=execFileSync('pwsh',['-NoProfile','-File',helper,'-ExecutableRoot',process.env.TEMP??'','-Width',String(width),'-Height',String(height)],{encoding:'utf8'});
  return JSON.parse(output);
};

const native=(action,extra=[])=>JSON.parse(execFileSync('pwsh',['-NoProfile','-File',join(dirname(fileURLToPath(import.meta.url)),'td2-window.ps1'),'-ExecutableRoot',process.env.TEMP,'-Action',action,...extra],{encoding:'utf8',timeout:25000}).trim());
let mainCall;
try{
 await waitForCdp();browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);browserSession=await browser.newBrowserCDPSession();const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('file:'));await page.waitForLoadState('domcontentloaded');const dock=page.getByRole('navigation',{name:'주요 기능'});await dock.waitFor();
 const info=await page.evaluate(()=>window.electronP0.info());if(info.sourceSha!==expectedSha||resolve(info.userData).toLowerCase()!==resolve(seedRoot).toLowerCase()||!info.qaProfile||!info.qaProfile.stores.every(p=>resolve(p).toLowerCase().startsWith(resolve(seedRoot).toLowerCase()+'\\')))throw Error('Immutable source/QA profile mismatch');result.actualUserData=info.userData;result.profileIsolation={verdict:'PASS',...info.qaProfile};result.environment=native('Probe');result.remainingChecks={};
 const endpoints=await (await fetch('http://127.0.0.1:19228/json/list')).json();mainWs=new WebSocket(endpoints[0].webSocketDebuggerUrl);await new Promise((ok,bad)=>{mainWs.addEventListener('open',ok,{once:true});mainWs.addEventListener('error',bad,{once:true});});let seq=0;const callbacks=new Map();mainWs.addEventListener('message',event=>{const m=JSON.parse(event.data);callbacks.get(m.id)?.(m);callbacks.delete(m.id);});
 mainCall=async fn=>{const id=++seq;const m=await new Promise((ok,bad)=>{const timer=setTimeout(()=>{callbacks.delete(id);bad(Error('Main observation timeout'));},15000);callbacks.set(id,m=>{clearTimeout(timer);ok(m);});mainWs.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:'('+fn.toString()+')()',awaitPromise:true,returnByValue:true}}));});if(m.error||m.result?.exceptionDetails)throw Error('Main observation failed');return m.result.result.value;};
 await mainCall(async function(){const e=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');globalThis.__remainingQa={e,w:e.BrowserWindow.getAllWindows().find(w=>w.isVisible())};return true;});
 // Capability detection only: never select a different/unidentified tray icon.
 const trayProbe=native('TrayReturn',['-Screenshot',join(screenshots,'tray-capability.png')]);
 if(trayProbe.verdict==='NOT RUN'){result.remainingChecks.tray={verdict:'NOT RUN',attempts:1,reason:trayProbe.reason,diagnostic:trayProbe,priorEvidence:'Three prior locator/host approaches exposed no unique app icon; no further blind retries or arbitrary clicks.'};}
 else{
  const state=()=>mainCall(async function(){const q=globalThis.__remainingQa;return {id:q.w.id,wc:q.w.webContents.id,visible:q.w.isVisible(),destroyed:q.w.isDestroyed()};});const initial=await state(),cycles=[];
  for(let i=0;i<3;i++){native('Close');await delay(250);const hidden=await state();if(hidden.destroyed||hidden.visible)throw Error('Native tray hide failed');const gesture=native('TrayReturn',['-Screenshot',join(screenshots,`tray-${i}.png`)]);await delay(500);const restored=await state();if(gesture.verdict==='NOT RUN'||!restored.visible||restored.id!==initial.id||restored.wc!==initial.wc)throw Error('Identified tray icon did not restore same window');cycles.push({hidden,gesture,restored});}result.remainingChecks.tray={verdict:'PASS',cycles,actualExplorerIcon:true};
 }
 result.nativeOwner=native('Resize',['-Width','900','-Height','680']);await delay(200);await dock.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('navigation',{name:'설정 카테고리'}).getByRole('button',{name:'학교 프로필',exact:true}).click();const input=page.getByLabel('학교명',{exact:true});await input.fill('합성 입력 유지 검증');
 const begin=async()=>{const l=await page.evaluate(()=>window.electronWork.admin.schoolAddresses());if(!l.ok)throw Error('Address preview failed');await page.evaluate(p=>{window.__pendingNative=window.electronWork.admin.applySchoolAddresses({officeCode:p.school.officeCode,schoolCode:p.school.schoolCode,expectedRevision:p.revision,environment:p.environment,systems:['portal']});return true;},l.data);};
 const waitDialog=async name=>{for(let i=0;i<8;i++){const p=native('DialogProbe',['-Screenshot',join(screenshots,name+'.png')]);if(p.found)return p;await delay(150);}throw Error('Actual owned native dialog unavailable');};
 const fits=p=>p.width>0&&p.height>0&&p.width<=900&&p.height<=680&&p.left>=0&&p.top>=0&&p.left+p.width<=p.screenWidth&&p.top+p.height<=p.screenHeight;
 const before=await page.evaluate(()=>window.electronWork.admin.load());await begin();const canceledDialog=await waitDialog('native-900-cancel');if(!fits(canceledDialog))throw Error('900px native dialog clipped or outside desktop');const cancel=native('DialogCancel');if(!cancel.clicked)throw Error('Actual native cancel button unavailable');const canceled=await page.evaluate(()=>window.__pendingNative);const afterCancel=await page.evaluate(()=>window.electronWork.admin.load());if(!canceled.ok||canceled.data!==null||JSON.stringify(before)!==JSON.stringify(afterCancel)||await input.inputValue()!=='합성 입력 유지 검증')throw Error('Native cancel did not preserve input/settings');
 await begin();const approvedDialog=await waitDialog('native-900-approve');if(!fits(approvedDialog))throw Error('Approval dialog clipped');const approve=native('DialogApprove');if(!approve.clicked)throw Error('Actual native approval button unavailable');const saved=await page.evaluate(()=>window.__pendingNative);if(!saved.ok||!saved.data?.document.systems.portal||await input.inputValue()!=='합성 입력 유지 검증')throw Error('Native approval/save invariant failed');
 const baseline=await page.evaluate(()=>window.electronWork.admin.load());await begin();const lateDialog=await waitDialog('native-900-late-approval');await page.evaluate(()=>window.electronWork.admin.cancel());const late=native('DialogApprove');if(!late.clicked)throw Error('Late native approval button unavailable');const lateResult=await page.evaluate(()=>window.__pendingNative);const afterLate=await page.evaluate(()=>window.electronWork.admin.load());if(lateResult.ok&&lateResult.data!==null||JSON.stringify(baseline)!==JSON.stringify(afterLate)||await input.inputValue()!=='합성 입력 유지 검증')throw Error('Late native approval modified input/settings');
 result.remainingChecks.native900={verdict:'PASS',owner:result.nativeOwner,dialogs:{canceledDialog,approvedDialog,lateDialog},cancel,approve,late,inputPreserved:true,settingsPreservedOnCancel:true,lateApprovalInvalidated:true,method:'Actual owned #32770 dialogs and native Button BM_CLICK; no response injection'};
 result.remainingChecks.dpi125={verdict:'NOT RUN',reason:'No approved interactive display-scale/relogon session; no registry/system-setting change or browser emulation'};result.remainingChecks.dpi150={...result.remainingChecks.dpi125};
 const adminFile=join(seedRoot,'work-data/school-admin/admin.json'),bytes=await readFile(adminFile);await begin();const pendingQuitDialog=await waitDialog('native-900-pending-quit');
 await mainCall(async function(){const q=globalThis.__remainingQa,quit=q.e.Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.label==='완전 종료');if(!quit)throw Error('Existing quit action unavailable');quit.click();return true;});mainWs.close();mainWs=undefined;await waitForWrapperExit();result.shutdown.wrapperExited=true;
 if(!(await readFile(adminFile)).equals(bytes))throw Error('Quit with consent pending changed settings');result.remainingChecks.pendingNativeQuit={verdict:'PASS',dialogWasVisible:pendingQuitDialog.found,settingsBytesPreserved:true,method:'Existing product complete-quit handler while actual native dialog is visible'};
 result.reused={run:41958196951,guiFix01:'PASS preserved; not repeated',portableRebuilt:false,productChanges:false};result.attempts={native900:1,productFixes:0,tray:'One current capability probe; prior distinct automation attempts retained'};
 result.verdict=Object.values(result.remainingChecks).some(r=>r.verdict==='FAIL')?'FAIL':Object.values(result.remainingChecks).some(r=>r.verdict==='NOT RUN')?'PARTIAL':'PASS';
}catch(error){result.error=String(error).split('\n')[0].slice(0,500);result.verdict='FAIL';}
finally{if(mainWs){try{mainWs.close();}catch{}}try{await cleanupOwned();}catch(error){result.cleanupError=String(error);result.verdict='FAIL';}if(browser){try{await browser.close();}catch{}}await writeFile(join(evidenceRoot,'autonomous-remaining-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
if(result.verdict==='FAIL')process.exitCode=1;
