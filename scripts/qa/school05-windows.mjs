import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

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
const candidateUnpackaged=process.env.SCHOOL_TD2_CANDIDATE==='1';
const portableMode=mode=>mode.startsWith('packaged')&&!candidateUnpackaged;
const school09Gate=process.env.SCHOOL09_IMMUTABLE_GATE_ONLY==='1';
const electronExecutable=school09Gate?executable:requireFromProduct('electron');
const launch=(mode)=>spawn(portableMode(mode)?executable:electronExecutable,[...(portableMode(mode)?[]:[join(productRoot,'build/electron-p0-app')]),`--remote-debugging-port=${port}`,'--inspect=127.0.0.1:19228'],{
  cwd:process.cwd(),
  env:{...process.env,APPDATA:isolatedAppData,LOCALAPPDATA:isolatedLocalAppData,ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_TEST_RUN:qaRun,ELECTRON_P0_QA_ROOT:qaRoot,ELECTRON_P0_DEV_URL:'',SCHOOL_WORKSPACE_MODE:mode==='packaged-default'?'':'synthetic',NODE_ENV:mode==='unpackaged-production'?'production':'development'},
  stdio:['ignore','pipe','pipe'],
  windowsHide:false,
});

const seedRoot=join(qaRoot,'test-runs',qaRun,'user-data');
await mkdir(join(seedRoot,'poc-settings'),{recursive:true});
await writeFile(join(seedRoot,'poc-settings','desktop.json'),JSON.stringify({version:1,closeBehavior:'tray',maximized:false}));
await mkdir(join(seedRoot,'work-data/school-profile'),{recursive:true});
await writeFile(join(seedRoot,'work-data/school-profile/school.json'),JSON.stringify({version:1,revision:1,school:{officeCode:'K10',officeName:'강원특별자치도교육청',schoolCode:'1234567',schoolName:'합성 QA 긴 학교명 화면 표시 확인 전용 초등학교'}}));
await mkdir(join(seedRoot,'work-data/local-events'),{recursive:true});

let child,launchError;

const ownedPids=new Set();
const psQuote=v=>"'"+v.replaceAll("'","''")+"'";
const ownedSnapshot=()=>{
 const script=`$all=@(Get-CimInstance Win32_Process);$ids=[System.Collections.Generic.HashSet[int]]::new();foreach($i in @(${[...ownedPids].join(',')})){[void]$ids.Add($i)};do{$added=$false;foreach($p in $all){if($ids.Contains([int]$p.ParentProcessId)-and !$ids.Contains([int]$p.ProcessId)){[void]$ids.Add([int]$p.ProcessId);$added=$true}}}while($added);$root=${psQuote(resolve(process.env.TEMP)+'\\')};$exe=${psQuote(resolve(executable))};$electron=${psQuote(resolve(electronExecutable))};@($all|Where-Object{($_.ExecutablePath -and ($_.ExecutablePath.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)-or $_.ExecutablePath -eq $exe -or $_.ExecutablePath -eq $electron))-and ($ids.Contains([int]$_.ProcessId)-or $_.Name -like 'BOGUNON*')}|Select-Object ProcessId,ParentProcessId,ExecutablePath,CreationDate)|ConvertTo-Json -Compress`;
 const raw=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',timeout:20000}).trim();const v=raw?JSON.parse(raw):[];const rows=Array.isArray(v)?v:[v];for(const p of rows)ownedPids.add(p.ProcessId);return rows;
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
    if(launchError)throw new Error('Pinned QA runtime launch failed: '+launchError.code);
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

let nativeExecutableRoot=process.env.TEMP,ownedMainPid=0;
const native=(action,extra=[])=>JSON.parse(execFileSync('pwsh',['-NoProfile','-File',join(dirname(fileURLToPath(import.meta.url)),'td2-window.ps1'),'-ExecutableRoot',nativeExecutableRoot,'-OwnedProcessId',String(ownedMainPid),'-Action',action,...extra],{encoding:'utf8',timeout:25000}).trim());
const phases=[];const mark=name=>{result.currentCheck=name;requireFromProduct('node:fs').writeFileSync(join(evidenceRoot,'progress.json'),JSON.stringify({sourceSha:expectedSha,phase:result.currentPhase,check:name}));console.log('SCHOOL05 checkpoint: '+name);};const check=(ok,label)=>{if(!ok)throw Error(label);};
async function connectMain(){const endpoints=await(await fetch('http://127.0.0.1:19228/json/list')).json();mainWs=new WebSocket(endpoints[0].webSocketDebuggerUrl);await new Promise((ok,bad)=>{mainWs.addEventListener('open',ok,{once:true});mainWs.addEventListener('error',bad,{once:true});});let seq=0;const pending=new Map();mainWs.addEventListener('message',event=>{const m=JSON.parse(event.data);pending.get(m.id)?.(m);pending.delete(m.id);});mainCall=async fn=>{const id=++seq,m=await new Promise((ok,bad)=>{const t=setTimeout(()=>{pending.delete(id);bad(Error('Main observation timeout'));},20000);pending.set(id,m=>{clearTimeout(t);ok(m);});mainWs.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:'('+fn.toString()+')()',awaitPromise:true,returnByValue:true}}));});if(m.error||m.result?.exceptionDetails)throw Error('Main observation failed');return m.result.result.value;};await mainCall(async function(){const e=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');globalThis.__school05qa={e,w:e.BrowserWindow.getAllWindows().find(w=>w.isVisible())};return true;});}
async function start(mode){mark('start-'+mode);result.currentPhase=mode;result.shutdown={browserCloseSent:false,wrapperExited:false};launchError=null;child=launch(mode);child.on('error',error=>{launchError=error;});if(child.pid)ownedPids.add(child.pid);child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});await waitForCdp();browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);browserSession=await browser.newBrowserCDPSession();const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('file:'));page.setDefaultTimeout(30000);const evaluate=page.evaluate.bind(page);page.evaluate=async(...args)=>{let t;try{return await Promise.race([evaluate(...args),new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Renderer request timed out at '+result.currentCheck)),45000);})]);}finally{clearTimeout(t);}};await page.getByRole('navigation',{name:'주요 기능'}).waitFor();await connectMain();const info=await page.evaluate(()=>window.electronP0.info());check(info.sourceSha===expectedSha&&resolve(info.userData).toLowerCase()===resolve(seedRoot).toLowerCase()&&info.qaProfile?.stores.every(p=>resolve(p).toLowerCase().startsWith(resolve(seedRoot).toLowerCase()+'\\')),'Source/profile mismatch');result.actualUserData=info.userData;result.profileIsolation={verdict:'PASS',...info.qaProfile};const prefs=await mainCall(async function(){const q=globalThis.__school05qa,p=q.w.webContents.getLastWebPreferences();return {pid:process.pid,packaged:q.e.app.isPackaged,sandbox:p.sandbox,contextIsolation:p.contextIsolation,nodeIntegration:p.nodeIntegration};});check(prefs.sandbox&&prefs.contextIsolation&&!prefs.nodeIntegration,'Electron security preferences changed');ownedMainPid=prefs.pid;nativeExecutableRoot=portableMode(mode)?process.env.TEMP:dirname(electronExecutable);return {page,prefs};}
async function stop(mode){mark('stop-'+mode);await mainCall(async function(){const q=globalThis.__school05qa;const item=q.e.Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.label==='완전 종료');item.click();return true;});mainWs.close();mainWs=undefined;await waitForWrapperExit();result.shutdown.wrapperExited=true;if(mode==='synthetic'){let present=false;try{await readFile(join(seedRoot,'school05-qa-only/school-workspace-auth-v1/session.bin'));present=true;}catch(e){if(e.code!=='ENOENT')throw e;}result.workspaceVaultAfterQuit={fileAbsent:!present};check(!present,'Workspace QA session persisted after final quit');}await cleanupOwned();phases.push({mode,...result.shutdown});check(!result.shutdown.forced&&result.shutdown.zeroResidual,'Normal phase exit left processes');if(browser)await browser.close().catch(()=>{});browser=undefined;browserSession=undefined;}
async function openWorkspace(page){const dock=page.getByRole('navigation',{name:'주요 기능'});await dock.locator('button[data-dock-item="toolbox"]').click();await page.getByRole('button',{name:/우리 보건실 · 학교 공유/}).click();const region=page.getByRole('region',{name:'우리 보건실 제품 화면'});await region.waitFor();return region;}
async function closeWorkspace(page){await page.getByRole('button',{name:'개인 업무 · 이 PC로 돌아가기',exact:true}).click();await page.getByRole('navigation',{name:'주요 기능'}).waitFor();}
async function capture(page,name){await page.screenshot({path:join(screenshots,name+'.png')});}
const pgControl=action=>{mark('native-db-'+action);const data=resolve(process.env.SCHOOL05_PG_DATA??''),root=resolve(process.env.TD2_ROOT),bin=process.env.SCHOOL05_PG_BIN;if(!bin||!data.startsWith(root+'\\'))throw Error('Owned native DB identity mismatch');const args=['-D',data,...(action==='Offline'?['-m','fast','-w','stop']:['-l',join(root,'school05-pg-runtime.log'),'-w','start'])];execFileSync(join(bin,'pg_ctl.exe'),args,{stdio:'ignore',windowsHide:true,timeout:action==='Offline'?30000:90000});mark('native-db-'+action+'-done');};
let mainCall;
let scenarioTimer;try{
 await Promise.race([(async()=>{
 let current=await start('packaged-default');let page=current.page;
 if(school09Gate){
  result.controllerSourceSha=process.env.GITHUB_SHA;result.verificationScope='SCHOOL09 unchanged product runtime reuse, not a newly built Portable';
  const a=await page.evaluate(()=>window.electronWork.account.status());check(a.ok&&a.data.configured,'Existing public auth configuration lost');result.account={configured:true,actualLogin:'NOT RUN'};
  const gate=await page.evaluate(()=>window.electronWorkspace.status());check(gate.mode==='disabled'&&!gate.connected,'Default Workspace gate opened');
  const denied=await page.evaluate(async()=>{try{await window.electronWorkspace.school.signIn({});return false;}catch{return true;}});check(denied,'Disabled Workspace accepted login');
  const dpapi=await mainCall(async function(){const e=globalThis.__school05qa.e;const sample='synthetic SCHOOL09 memory-only check';return {available:e.safeStorage.isEncryptionAvailable(),roundTrip:e.safeStorage.decryptString(e.safeStorage.encryptString(sample))===sample};});check(dpapi.available&&dpapi.roundTrip,'Actual Windows DPAPI failed');result.dpapi=dpapi;
  await openWorkspace(page);await page.getByText('공동 기능 연결 준비 중',{exact:true}).waitFor();check(await page.getByLabel('검증 계정').count()===0,'Synthetic login leaked');native('Resize',['-Width','900','-Height','680']);await capture(page,'school09-immutable-portable-closed-900');result.workspaceGate={verdict:'PASS',packaged:true,mode:'disabled'};
  await stop('packaged-default');current=await start('packaged-default');page=current.page;check((await page.evaluate(()=>window.electronWorkspace.status())).mode==='disabled','Restart opened Workspace');await stop('packaged-default');result.verdict='PASS';result.hosted='NOT RUN';return;
 }

 const account=await page.evaluate(()=>window.electronWork.account.status());check(account.ok&&(candidateUnpackaged||account.data.configured),'ACCOUNT-02B public injection lost');result.account={configured:account.ok&&account.data.configured,previousRun:41969614375,actualLogin:'NOT RUN; not repeated'};
 const personal=await page.evaluate(async()=>{const api=window.electronWork;const t=await api.tasks.load();if(!t.ok)throw Error('Task load');const doc={...t.data.document,tasks:[{id:crypto.randomUUID(),title:'SCHOOL05 개인 업무 보존',scheduledDate:'2026-11-05',dueDate:null,completed:false,priority:'normal',category:'보고',dday:false}]};const saved=await api.tasks.save(doc,t.data.document.revision);const memo=await api.memo.write({version:1,text:'SCHOOL05 개인 메모 보존'});const e=await api.events.load();if(!e.ok)throw Error('Event load');const event=await api.events.save({event:{id:crypto.randomUUID(),title:'SCHOOL05 개인 일정 보존',startDate:'2026-11-05',endDate:'2026-11-05',startTime:null,endTime:null,allDay:true,description:'합성 QA',location:'',category:'교육'},expectedRevision:e.data.document.revision,expectedUpdatedAt:null});return {task:saved.ok,memo:memo.ok,event:event.ok};});check(personal.task&&personal.memo&&personal.event,'Personal seed persistence failed');
 const status=await page.evaluate(()=>window.electronWorkspace.status());check(status.mode==='disabled'&&!status.connected,'Default Workspace gate open');const denied=await page.evaluate(async()=>{try{await window.electronWorkspace.school.signIn({});return false;}catch{return true;}});check(denied,'Disabled packaged Workspace accepted signIn');await openWorkspace(page);await page.getByText('공동 기능 연결 준비 중',{exact:true}).waitFor();check(await page.getByLabel('검증 계정').count()===0,'Synthetic controls leaked into packaged product');
 for(const [w,h] of [[980,700],[900,680]]){native('Resize',['-Width',String(w),'-Height',String(h)]);await delay(200);check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Workspace horizontal overflow');await page.getByRole('button',{name:'개인 업무 · 이 PC로 돌아가기',exact:true}).scrollIntoViewIfNeeded();await capture(page,'packaged-disabled-'+w+'x'+h);}
 await closeWorkspace(page);result.packagedDefault={verdict:'PASS',execution:candidateUnpackaged?'Actual unpackaged Windows Electron; no Portable built':'Portable',...current.prefs,loginNotRequiredForDesk:true,workspace:status.mode};
 // Actual 900px OS confirmation, cancel only; no external request or OAuth repeat.
 await page.evaluate(async()=>{const p=await window.electronWork.admin.schoolAddresses();if(!p.ok)throw Error('Address preview');window.__s05Confirm=window.electronWork.admin.applySchoolAddresses({officeCode:p.data.school.officeCode,schoolCode:p.data.school.schoolCode,expectedRevision:p.data.revision,environment:p.data.environment,systems:['portal']});});let dialog;for(let i=0;i<10;i++){dialog=native('DialogProbe',['-Screenshot',join(screenshots,'native-confirm-900.png')]);if(dialog.found)break;await delay(150);}check(dialog?.found,'900px actual native dialog missing');check(dialog.left>=0&&dialog.top>=0&&dialog.left+dialog.width<=dialog.screenWidth&&dialog.top+dialog.height<=dialog.screenHeight,'Native dialog clipped');const cancel=native('DialogCancel');check(cancel.clicked,'Actual native cancel unavailable');const canceled=await page.evaluate(()=>window.__s05Confirm);check(canceled.ok&&canceled.data===null,'Native cancel changed addresses');result.native900={verdict:'PASS',dialog,cancel,method:'Actual owned Win32 confirmation; no synthetic response injection'};
 const tray=native('TrayReturn');result.tray=tray.verdict==='NOT RUN'?{verdict:'NOT RUN',reason:tray.reason,noArbitraryClicks:true}:{verdict:'PARTIAL',reason:'Icon identified; full 3-cycle manual behavior not inferred from this probe'};result.dpi={dpi125:'NOT RUN',dpi150:'NOT RUN',systemSettingsChanged:false};
 await stop('packaged-default');
 current=await start('packaged-synthetic-flag');page=current.page;check((await page.evaluate(()=>window.electronWorkspace.status())).mode==='disabled','Packaged synthetic override enabled');const restored=await page.evaluate(async()=>({tasks:await window.electronWork.tasks.load(),memo:await window.electronWork.memo.read(),events:await window.electronWork.events.load()}));check(restored.tasks.ok&&restored.tasks.data.document.tasks.some(t=>t.title==='SCHOOL05 개인 업무 보존')&&restored.memo.ok&&restored.memo.data.text==='SCHOOL05 개인 메모 보존'&&restored.events.ok&&restored.events.data.document.events.some(e=>e.title==='SCHOOL05 개인 일정 보존'),'Personal restart restore failed');result.restart={verdict:'PASS',task:true,event:true,memo:true};await stop('packaged-synthetic-flag');
 current=await start('unpackaged-production');page=current.page;check((await page.evaluate(()=>window.electronWorkspace.status())).mode==='disabled','Production synthetic override enabled');result.productionGate={verdict:'PASS',...current.prefs};await stop('unpackaged-production');
 current=await start('synthetic');page=current.page;check((await page.evaluate(()=>window.electronWorkspace.status())).mode==='qa','Isolated synthetic provider did not start');const workspace=await openWorkspace(page);
 async function loginRole(id){mark("login-role-"+id);await workspace.getByLabel('검증 계정').selectOption(String(id));await workspace.getByRole('button',{name:'로그인',exact:true}).click();await workspace.getByLabel('학교명',{exact:true}).fill('늘봄');await workspace.getByLabel('시도교육청').selectOption(id===6?'C10':'B10');await workspace.getByRole('button',{name:'학교 검색',exact:true}).click();await workspace.getByRole('button',{name:'이 학교 선택',exact:true}).click();}
 async function openShared(){await workspace.getByRole('button',{name:'학교 공동 공간 열기',exact:true}).click();await workspace.getByRole('navigation',{name:'우리 보건실 메뉴'}).waitFor();}
 async function tab(name){mark("tab-"+name);await workspace.getByRole('navigation',{name:'우리 보건실 메뉴'}).getByRole('button',{name,exact:true}).click();}
 await loginRole(3);await openShared();await tab('공동 업무');await workspace.getByRole('button',{name:'새 공동 업무',exact:true}).click();await workspace.getByLabel('업무 제목').fill('Windows 합성 공동 업무');await workspace.getByLabel('간단한 설명').fill('개인 자료 없는 운영 QA');await workspace.getByLabel('M-SYNTH-4 · 지원강사',{exact:true}).check();await workspace.getByLabel('개인정보 없는 운영 업무임을 확인했습니다.').check();await workspace.getByRole('button',{name:'업무 등록',exact:true}).click();await workspace.getByRole('article',{name:'공동 업무 Windows 합성 공동 업무',exact:true}).waitFor();await capture(page,'windows-shared-task');
 await tab('공동 일정');await workspace.getByRole('button',{name:'일정 등록',exact:true}).click();await workspace.getByLabel('일정 제목').fill('Windows 합성 공동 일정');await workspace.getByLabel('개인정보 없는 운영 내용임을 확인했습니다.').check();await workspace.getByRole('button',{name:'일정 저장',exact:true}).click();await workspace.getByRole('article',{name:'일정 Windows 합성 공동 일정',exact:true}).waitFor();
 for(const[w,h]of[[980,700],[900,680]]){native('Resize',['-Width',String(w),'-Height',String(h)]);await delay(150);check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Active Workspace horizontal overflow');await capture(page,'windows-shared-calendar-'+w+'x'+h);}
 await tab('인수인계');await workspace.getByRole('button',{name:'전달사항 작성',exact:true}).click();await workspace.getByLabel('전달 제목').fill('Windows 합성 인수인계');await workspace.getByLabel('짧은 전달 내용').fill('합성 물품 목록 확인');await workspace.getByLabel('M-SYNTH-4',{exact:true}).check();await workspace.getByLabel('개인정보 없는 운영 내용임을 확인했습니다.').check();await workspace.getByRole('button',{name:'전달사항 저장',exact:true}).click();await workspace.getByRole('article',{name:'전달사항 Windows 합성 인수인계',exact:true}).waitFor();

 mark('inventory-teacher');await tab('공동 물품관리');const inventory=workspace.getByRole('region',{name:'공동 물품관리',exact:true});
 await inventory.getByRole('button',{name:'물품 등록',exact:true}).click();await inventory.getByLabel('물품명',{exact:true}).fill('Windows 합성 거즈');await inventory.getByLabel('최소 수량').fill('10');await inventory.getByLabel('개인정보 없는 물품 정보임을 확인했습니다.').check();await inventory.getByRole('button',{name:'물품 저장',exact:true}).click();await inventory.getByRole('article',{name:'물품 Windows 합성 거즈',exact:true}).waitFor();
 const invSaved=async()=>{await inventory.getByRole('button',{name:'수량 저장',exact:true}).click();await inventory.getByRole('button',{name:'수량 저장',exact:true}).waitFor({state:'detached'});await inventory.getByRole('status').filter({hasText:'서버 저장'}).waitFor();};
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await inventory.getByRole('button',{name:'새 입고 기록',exact:true}).click();await inventory.getByLabel('기록 수량',{exact:true}).fill('6');await inventory.getByLabel('유효기간 (없으면 비워 두기)',{exact:true}).fill(today);await invSaved();
 let lot=inventory.getByRole('article').filter({has:page.getByRole('button',{name:'사용 기록',exact:true})}).first();await lot.getByRole('button',{name:'사용 기록',exact:true}).click();await inventory.getByLabel('기록 수량',{exact:true}).fill('1');await invSaved();
 lot=inventory.getByRole('article').filter({has:page.getByRole('button',{name:'수량 조정',exact:true})}).first();await lot.getByRole('button',{name:'수량 조정',exact:true}).click();await inventory.getByLabel('조정 후 수량',{exact:true}).fill('4');await invSaved();
 await lot.getByRole('button',{name:'폐기 기록',exact:true}).click();await inventory.getByLabel('기록 수량',{exact:true}).fill('1');await invSaved();const stockCard=inventory.getByRole('article',{name:'물품 Windows 합성 거즈',exact:true});await stockCard.getByText('사용 가능 3 개',{exact:true}).waitFor();await stockCard.getByText('부족 재고 · 최소 10',{exact:true}).waitFor();
 await inventory.getByRole('button',{name:'새 입고 기록',exact:true}).click();await inventory.getByLabel('기록 수량',{exact:true}).fill('2');await inventory.getByLabel('유효기간 (없으면 비워 두기)',{exact:true}).fill('2020-01-01');await invSaved();
 const expired=inventory.getByRole('article').filter({hasText:'2020-01-01'});check(await expired.getByRole('button',{name:'사용 기록',exact:true}).isDisabled(),'Expired lot use enabled');
 for(const[w,h]of[[980,700],[900,680]]){native('Resize',['-Width',String(w),'-Height',String(h)]);check(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Inventory horizontal overflow');await capture(page,'windows-inventory-'+w+'x'+h);}
 result.inventory={verdict:'PASS',actualNativeDb:true,create:true,receive:true,use:true,adjust:true,dispose:true,lowStock:true,soonAndExpired:true,expiredUseDisabled:true};
 await (await import('./school-td2-instructor-gui.mjs')).checkInstructor({page,workspace,tab,mainCall:fn=>mainCall(fn),screenshots,evidenceRoot,result,check});
 await loginRole(4);await openShared();await tab('공동 업무');const own=workspace.getByRole('article',{name:'공동 업무 Windows 합성 공동 업무',exact:true});await own.getByRole('button',{name:'진행 시작'}).click();await own.getByRole('button',{name:'완료',exact:true}).click();await own.getByText('완료',{exact:true}).waitFor();check(await workspace.getByRole('button',{name:'새 공동 업무'}).count()===0,'Assistant editor leaked');
 await tab('인수인계');await workspace.getByRole('article',{name:'전달사항 Windows 합성 인수인계',exact:true}).getByRole('button',{name:'전달사항 보기'}).click();await workspace.getByRole('button',{name:'이 내용 읽음 확인'}).click();await workspace.getByText('현재 내용 읽음 확인 완료',{exact:true}).waitFor();await capture(page,'windows-handover-ack');
 await tab('공동 물품관리');check(await workspace.getByRole('button',{name:'물품 등록',exact:true}).count()===0,'Assistant management leaked');result.inventory.assistantRestricted=true;await loginRole(5);await workspace.getByText('관리자 승인 대기',{exact:true}).first().waitFor();check(await workspace.getByRole('button',{name:'학교 공동 공간 열기'}).count()===0,'Pending membership access leaked');await capture(page,'windows-membership-pending');
 await loginRole(1);await openShared();await workspace.getByRole('button',{name:'학교 구성원 관리',exact:true}).click();await workspace.getByRole('article',{name:'구성원 M-SYNTH-1',exact:true}).waitFor();await capture(page,'windows-member-admin');
 const vault=await mainCall(async function(){const q=globalThis.__school05qa,req=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json'),fs=req('node:fs/promises'),path=req('node:path');const file=path.join(q.e.app.getPath('userData'),'school05-qa-only','school-workspace-auth-v1','session.bin');const bytes=await fs.readFile(file);const decoded=JSON.parse(q.e.safeStorage.decryptString(bytes));return {encrypted:!bytes.toString().includes('accessToken'),roundTrip:!!decoded.accessToken,underIsolatedUserData:true};});check(vault.encrypted&&vault.roundTrip,'Actual Workspace DPAPI vault failed');result.workspaceVault={verdict:'PASS',...vault};
 await workspace.getByRole('button',{name:'공동 계정 로그아웃',exact:true}).click();await workspace.getByRole('button',{name:'로그인',exact:true}).waitFor();check(await workspace.getByRole('article',{name:'전달사항 Windows 합성 인수인계',exact:true}).count()===0,'Logout retained Workspace data');
 await loginRole(6);await openShared();await tab('공동 물품관리');await workspace.getByText('등록된 물품이 없습니다.',{exact:true}).waitFor();check(await workspace.getByRole('article',{name:'물품 Windows 합성 거즈',exact:true}).count()===0,'School A inventory retained in B');result.inventory.schoolSwitchCleared=true;await loginRole(3);await openShared();await tab('공동 물품관리');pgControl('Offline');await workspace.getByRole('button',{name:'새로고침',exact:true}).click();await workspace.getByRole('alert').first().waitFor();check(await workspace.getByRole('status').filter({hasText:'서버 저장'}).count()===0,'Offline stock success leaked');result.inventory.offlineFailureShown=true;await closeWorkspace(page);const offlinePersonal=await page.evaluate(async()=>{const memo=await window.electronWork.memo.write({version:1,text:'DB 중단 중 개인 메모 보존'});const task=await window.electronWork.tasks.load(),events=await window.electronWork.events.load();return {memo:memo.ok,tasks:task.ok&&task.data.document.tasks.some(t=>t.title==='SCHOOL05 개인 업무 보존'),events:events.ok&&events.data.document.events.some(t=>t.title==='SCHOOL05 개인 일정 보존')};});check(offlinePersonal.memo&&offlinePersonal.tasks&&offlinePersonal.events,'Workspace DB failure broke personal Desk');pgControl('Online');
 result.activeWorkspace={verdict:'PASS',classification:'Actual Windows Electron + native PostgreSQL + synthetic Auth; not Hosted',teacherTaskCreate:true,assistantProgressComplete:true,calendarCreate:true,handoverAck:true,pendingDenied:true,adminMembers:true,logoutClears:true,offlinePersonal};await stop('synthetic');
 result.phases=phases;result.verdict='PASS';result.hosted='NOT RUN';
 })(),new Promise((_,reject)=>{scenarioTimer=setTimeout(()=>reject(Error('Windows GUI budget exceeded at '+result.currentCheck)),420000);})]);
}catch(error){result.error=String(error).split('\n')[0].slice(0,500);result.verdict='FAIL';if(browser)for(const p of browser.contexts().flatMap(c=>c.pages())){await p.screenshot({path:join(screenshots,'failure.png')}).catch(()=>{});await writeFile(join(evidenceRoot,'failure-ui.txt'),await p.locator('body').innerText().catch(()=>''));}}
finally{clearTimeout(scenarioTimer);if(mainWs){try{mainWs.close();}catch{}}try{if(child)await cleanupOwned();}catch(error){result.cleanupError=String(error);result.verdict='FAIL';}if(browser)await browser.close().catch(()=>{});result.phases=phases;await writeFile(join(evidenceRoot,'school05-windows-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
if(result.verdict==='FAIL')process.exitCode=1;
