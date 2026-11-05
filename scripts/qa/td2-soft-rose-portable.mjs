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
 const initial=await page.evaluate(()=>window.electronWork.account.status());
 if(!initial.ok||!initial.data.configured||!initial.data.secureStorage||initial.data.user)throw Error('Expected configured authentication with actual Windows secure storage');
 result.accountEnabled={verdict:'PASS',configured:true,secureStorage:true};
 await dock.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('navigation',{name:'설정 카테고리'}).getByRole('button',{name:'학교 프로필',exact:true}).click();
 result.accountUi=[];
 for(const [width,height] of [[980,700],[900,680]]){native('Resize',['-Width',String(width),'-Height',String(height)]);await delay(300);const section=page.getByRole('region',{name:'BOGUNON 계정 연결'}),button=section.getByRole('button',{name:'Google로 BOGUNON 로그인'});await button.scrollIntoViewIfNeeded();if(!await button.isEnabled())throw Error('Configured login is disabled');await page.screenshot({path:join(screenshots,`account-${width}.png`)});result.accountUi.push({width,height,enabledLogin:true,visible:await button.isVisible()});}
 const browserSnapshot=()=>{const raw=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',"@(Get-CimInstance Win32_Process|Where-Object{$_.Name -in @('msedge.exe','chrome.exe','firefox.exe','iexplore.exe')}|Select-Object ProcessId,Name,CreationDate,ExecutablePath)|ConvertTo-Json -Compress"],{encoding:'utf8'}).trim();const v=raw?JSON.parse(raw):[];return Array.isArray(v)?v:[v];};
 const priorBrowsers=browserSnapshot();let launchedBrowsers=[];
 const cleanupBrowsers=()=>{for(const p of launchedBrowsers){execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${p.ProcessId}';if($p -and $p.ExecutablePath -eq ${psQuote(p.ExecutablePath)} -and [datetime]$p.CreationDate -eq [datetime]${psQuote(p.CreationDate)}){Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue}`],{encoding:'utf8'});}const ids=new Set(launchedBrowsers.map(p=>p.ProcessId));const remaining=browserSnapshot().filter(p=>ids.has(p.ProcessId));result.browserCleanup={ownedCount:launchedBrowsers.length,remainingCount:remaining.length,unrelatedProcessesTerminated:0};if(remaining.length)throw Error('Owned authentication browser cleanup incomplete');};
 try{
 result.setup=await mainCall(async function(){
  try{const q=globalThis.__remainingQa,e=q.e,req=process.getBuiltinModule('module').createRequire(e.app.getAppPath()+'/package.json'),fs=req('node:fs/promises'),path=req('node:path');const load=async name=>req(path.join(e.app.getAppPath(),'main',name+'.js'));
  const {AccountVault}=await load('account-vault'),{AccountService}=await load('account-service'),{AccountLoopback}=await load('account-loopback'),{parseAccountConfig}=await load('account-network');const config=parseAccountConfig(JSON.parse(await fs.readFile(path.join(e.app.getAppPath(),'account-config.json'),'utf8')));if(!config)throw Error('Config');
  const root=path.join(e.app.getPath('userData'),'account02b-synthetic');await fs.mkdir(root,{recursive:true});const cipher={available:process.platform==='win32'&&e.safeStorage.isEncryptionAvailable(),encrypt:v=>e.safeStorage.encryptString(v),decrypt:v=>e.safeStorage.decryptString(v)};const vault=new AccountVault(path.join(root,'vault'),cipher),marker='SYNTHETIC_DPAPI_ACCOUNT02B';await vault.write({'sb-synthetic-auth-token':marker});const bytes=await fs.readFile(path.join(root,'vault','session.bin'));if(bytes.includes(Buffer.from(marker))||(await new AccountVault(path.join(root,'vault'),cipher).read())['sb-synthetic-auth-token']!==marker)throw Error('DPAPI');await vault.write({});
  const schoolFile=path.join(e.app.getPath('userData'),'work-data/school-profile/school.json'),schoolBefore=await fs.readFile(schoolFile);const sentinel=path.join(root,'work-sentinel.json');await fs.writeFile(sentinel,JSON.stringify({synthetic:true,task:'preserve',revision:1}));const workBefore=await fs.readFile(sentinel);
  const a=globalThis.__account02b={e,req,fs,path,root,config,cipher,AccountVault,AccountService,AccountLoopback,schoolFile,schoolBefore,sentinel,workBefore,originalOpen:e.shell.openExternal,openObserved:false,openResolved:false};
  e.shell.openExternal=async(target,options)=>{const u=new URL(target),back=new URL(u.searchParams.get('redirect_to'));if(u.origin!==config.origin||u.pathname!=='/auth/v1/authorize'||u.searchParams.get('provider')!=='google'||back.hostname!=='127.0.0.1')throw Error('Unexpected browser target');a.openObserved=true;a.redirect=back.origin+back.pathname;try{const r=await a.originalOpen.call(e.shell,target,options);a.openResolved=true;return r;}catch{a.openFailed=true;throw Error('Authentication browser launch failed');}};
  return {verdict:'PASS',publicConfig:true,actualWindowsDpapi:true,encryptedDiskRestore:true,rendererCredentialsExposed:false};}catch(error){return {verdict:'FAIL',errorCode:error.code??error.name};}
 });if(result.setup.verdict!=='PASS')throw Error('Configured account setup failed / '+result.setup.errorCode);
 if(priorBrowsers.length){result.browserStart={verdict:'NOT RUN',reason:'Existing browser processes present; no arbitrary browser/profile manipulation'};}
 else{
  const section=page.getByRole('region',{name:'BOGUNON 계정 연결'});await section.getByRole('button',{name:'Google로 BOGUNON 로그인'}).click();
  let dialog;for(let i=0;i<12;i++){dialog=native('DialogProbe');if(dialog.found)break;await delay(150);}if(!dialog?.found)throw Error('Actual authentication consent dialog missing');const approved=native('DialogApprove');if(!approved.clicked)throw Error('Authentication-start native consent unavailable');
  await section.getByRole('button',{name:'계정 로그인 취소'}).waitFor({timeout:20000});
  for(let i=0;i<12;i++){launchedBrowsers=browserSnapshot();if(launchedBrowsers.length)break;await delay(250);}
  const observed=await mainCall(async function(){const a=globalThis.__account02b;return {openObserved:a.openObserved,openResolved:a.openResolved,loopbackConfigured:!!a.redirect};});
  result.browserStart={verdict:observed.openObserved&&observed.openResolved&&launchedBrowsers.length?'PASS':'NOT RUN',...observed,actualSystemBrowserProcesses:launchedBrowsers.map(p=>({pid:p.ProcessId,name:p.Name})),realLogin:'NOT RUN',method:'Actual product IPC + actual native consent + original shell.openExternal; no credentials entered'};
  if(!observed.openObserved||!observed.openResolved||!observed.loopbackConfigured)throw Error('Product authentication start failed');
  await page.screenshot({path:join(screenshots,'account-auth-started.png')});await section.getByRole('button',{name:'계정 로그인 취소'}).click();
  for(let i=0;i<30;i++){const r=await page.evaluate(()=>window.electronWork.account.status());if(r.ok&&r.data.status==='signedOut')break;await delay(100);}
  const canceled=await page.evaluate(()=>window.electronWork.account.status());if(!canceled.ok||canceled.data.status!=='signedOut'||canceled.data.user||canceled.data.school)throw Error('Product auth cancellation did not clear identity');
  result.cancel=await mainCall(async function(){const a=globalThis.__account02b;let closed=false;try{await fetch(a.redirect);}catch{closed=true;}const vault=new a.AccountVault(a.path.join(a.e.app.getPath('userData'),'work-data/bogunon-account'),a.cipher);return {verdict:closed&&Object.keys(await vault.read()).length===0?'PASS':'FAIL',actualLoopbackClosed:closed,encryptedSessionMapEmpty:Object.keys(await vault.read()).length===0};});if(result.cancel.verdict!=='PASS')throw Error('Actual OAuth cancellation cleanup failed');
 }
 result.failureTimeout=await mainCall(async function(){
  const a=globalThis.__account02b;let stage='failure';const services=[];try{let active,redirect,transportCalls=0;const fetcher=async()=>{transportCalls++;throw Error('External requests disabled in synthetic test');};
  const create=(name,fail,short)=>{const vault=new a.AccountVault(a.path.join(a.root,name),a.cipher);const s=new a.AccountService({config:a.config,vault,fetch:fetcher,open:async()=>{if(fail)throw Error('Synthetic browser failure');},loopback:()=>{active=new a.AccountLoopback();if(short){const original=active.start.bind(active);active.start=async(cb,expired)=>{redirect=await original(cb,expired,80);return redirect;};}else{const original=active.start.bind(active);active.start=async(cb,expired)=>{redirect=await original(cb,expired);return redirect;};}return active;}});services.push(s);return s;};
  const failed=await create('failed',true,false).signIn();if(failed.status!=='signedOut')throw Error();let failureClosed=false;try{await fetch(redirect);}catch{failureClosed=true;}if(!failureClosed)throw Error();
  stage='timeout';const s=create('timeout',false,true);await s.signIn();await new Promise(r=>setTimeout(r,200));await s.flush();if((await s.status()).status!=='signedOut')throw Error();let timeoutClosed=false;try{await fetch(redirect);}catch{timeoutClosed=true;}if(!timeoutClosed||transportCalls)throw Error();
  if(!(await a.fs.readFile(a.schoolFile)).equals(a.schoolBefore)||!(await a.fs.readFile(a.sentinel)).equals(a.workBefore))throw Error();return {verdict:'PASS',browserFailure:'Synthetic open failure; real SDK, DPAPI and listener',timeout:'Real loopback timer with shortened QA timeout; production remains 180000ms',failureClosed,timeoutClosed,schoolBytesPreserved:true,workBytesPreserved:true,syntheticTransportRequests:transportCalls};
  }catch(error){return {verdict:'FAIL',stage,errorCode:error.code??error.name};}finally{for(const s of services){s.dispose();await s.flush();}}
 });if(result.failureTimeout.verdict!=='PASS')throw Error('Failure/timeout QA failed at '+result.failureTimeout.stage);
 result.reused={account01Run:41967106510,scope:'Unchanged SDK synthetic login/refresh/logout/school apply regression reused; new configured UI, DPAPI, actual start/cancel and listener failure/timeout checked here'};
 }finally{
  try{await mainCall(async function(){const a=globalThis.__account02b;if(a)a.e.shell.openExternal=a.originalOpen;return true;});}catch{}
  if(!priorBrowsers.length){const known=new Set(launchedBrowsers.map(p=>p.ProcessId));for(const p of browserSnapshot())if(!known.has(p.ProcessId))launchedBrowsers.push(p);cleanupBrowsers();}
 }
 await mainCall(async function(){const q=globalThis.__remainingQa,quit=q.e.Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.label==='완전 종료');quit.click();return true;});mainWs.close();mainWs=undefined;await waitForWrapperExit();result.shutdown.wrapperExited=true;
 result.realOAuth='NOT RUN: operator-approved redirect compatibility and test-account authorization required';result.verdict='PASS';
}catch(error){result.error=String(error).split('\n')[0].slice(0,500);result.verdict='FAIL';}
finally{if(mainWs){try{mainWs.close();}catch{}}try{await cleanupOwned();}catch(error){result.cleanupError=String(error);result.verdict='FAIL';}if(browser){try{await browser.close();}catch{}}await writeFile(join(evidenceRoot,'account02b-windows-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
if(result.verdict==='FAIL')process.exitCode=1;
