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

try{
  await waitForCdp();
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  browserSession=await browser.newBrowserCDPSession();
  const context=browser.contexts()[0];
  if(!context)throw new Error('Portable Electron exposed no browser context');
  const page=context.pages().find(candidate=>candidate.url().startsWith('file:'))??context.pages()[0];
  if(!page)throw new Error('Portable Electron exposed no renderer page');
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('navigation',{name:'주요 기능'}).waitFor({state:'visible'});
  const initialSetup=page.getByRole('dialog',{name:'학교 초기 설정'});
  if(await initialSetup.isVisible())await initialSetup.getByRole('button',{name:'나중에 설정'}).click();

  const info=await page.evaluate(()=>window.electronP0.info());
  if(info.sourceSha!==expectedSha)throw new Error(`Source SHA mismatch: ${info.sourceSha}`);
  const expectedUserData=join(qaRoot,'test-runs',qaRun,'user-data').toLowerCase();
  if(info.userData.toLowerCase()!==expectedUserData)throw new Error(`Unexpected userData: ${info.userData}`);
  result.actualUserData=info.userData;
  if(!info.qaProfile||resolve(info.qaProfile.root).toLowerCase()!==resolve(qaRoot).toLowerCase()||resolve(info.qaProfile.appData).toLowerCase()!==resolve(qaRoot,'app-data').toLowerCase()||resolve(info.qaProfile.sessionData).toLowerCase()!==resolve(info.userData,'chromium').toLowerCase()||!info.qaProfile.stores.every(p=>resolve(p).toLowerCase().startsWith(resolve(info.userData).toLowerCase()+'\\')))throw Error('Sensitive QA storage paths escaped isolated profile');
  result.profileIsolation={verdict:'PASS',...info.qaProfile,userData:info.userData};
  if(process.env.TD2_FORCE_EXCEPTION==='1')throw Error('injected QA exception after profile proof');
  result.devicePixelRatio=await page.evaluate(()=>devicePixelRatio);

  browserSession=await browser.newBrowserCDPSession();
  for(const [width,height] of [[980,700],[900,680]]){
    const nativeBounds=setWindowBounds(width,height);
    if(nativeBounds.width!==width||nativeBounds.height!==height)result.violations.push(`Requested ${width}x${height} clamped to ${nativeBounds.width}x${nativeBounds.height}`);
    await page.waitForTimeout(300); // Actual bounds recorded; product minimum size may clamp request.
    await page.waitForTimeout(300);
    const layout=await page.evaluate(()=>{
      const dashboard=document.querySelector('.workspace-dashboard');
      const dock=document.querySelector('.dock-zone');
      const calendar=document.querySelector('[data-widget-type="monthly-calendar"]');
      if(!(dashboard instanceof HTMLElement)||!(dock instanceof HTMLElement))throw new Error('Dashboard or Dock missing');
      const mainRect=dashboard.getBoundingClientRect();
      const dockRect=dock.getBoundingClientRect();
      dashboard.scrollTop=dashboard.scrollHeight;
      return {
        innerWidth,innerHeight,outerWidth,outerHeight,
        documentOverflow:document.documentElement.scrollWidth>innerWidth+1,
        dashboardOverflow:dashboard.scrollWidth>dashboard.clientWidth+2,
        workspaceVerticalOverflow:dashboard.scrollHeight>dashboard.clientHeight+2,
        calendarNestedScroll:calendar instanceof HTMLElement&&[calendar,...calendar.querySelectorAll('*')].some(element=>{
          if(!(element instanceof HTMLElement))return false;
          const overflowY=getComputedStyle(element).overflowY;
          return (overflowY==='auto'||overflowY==='scroll')&&element.scrollHeight>element.clientHeight+2;
        }),
        scrollBottomReachable:dashboard.scrollTop+dashboard.clientHeight>=dashboard.scrollHeight-2,
        dockVisible:dockRect.width>0&&dockRect.height>0&&dockRect.top<innerHeight&&dockRect.bottom<=innerHeight+1,
        overlap:mainRect.bottom>dockRect.top+1,
      };
    });
    await page.locator('.workspace-dashboard').evaluate(element=>{element.scrollTop=0;});
    const screenshot=await page.screenshot({path:join(screenshots,`td2-${width}x${height}.png`)});
    result.captures.push({requested:{width,height},nativeBounds,png:pngSize(screenshot),layout});
    if(layout.documentOverflow||layout.dashboardOverflow||layout.workspaceVerticalOverflow||layout.calendarNestedScroll||!layout.scrollBottomReachable||!layout.dockVisible||layout.overlap){
      result.violations.push(`Layout contract failed at ${width}x${height}: ${JSON.stringify(layout)}`);
    }
  }

  const dock=page.getByRole('navigation',{name:'주요 기능'});
  const quickMemo=dock.getByRole('button',{name:'빠른 메모',exact:true});
  await quickMemo.click();
  await page.getByRole('dialog',{name:'빠른 메모',exact:true}).waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  await quickMemo.waitFor({state:'visible'});
  result.actionability.quickMemo=true;

  const tools=dock.getByRole('button',{name:'업무 도구',exact:true});
  await tools.click();
  await page.getByRole('dialog',{name:'업무 도구',exact:true}).waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  await tools.waitFor({state:'visible'});
  result.actionability.tools=true;

  // Read-only packaged IPC checks: never sign in or make provider requests.
  result.packagedIpc=await page.evaluate(async()=>{
    const w=window.electronWork;
    const calls={chatgpt:()=>w.chatgpt.status(),finance:()=>w.finance.status(),finder:()=>w.educationVideo.searchProvider.status(),ai:()=>w.ai.status(),inventory:()=>w.inventory.load(),school:()=>w.school.load(),admin:()=>w.admin.load(),purchaseAi:()=>w.purchase.images.ai.connections()};
    const out={};
    for(const [name,call] of Object.entries(calls)){const r=await call();if(!r.ok)throw Error('Packaged IPC failed: '+name);out[name]='PASS (status/load only; no service calls)';}
    return out;
  });
  result.moduleButtons=await dock.getByRole('button').allTextContents();
  result.moduleGui={};
  const reset=async()=>{await page.reload();await dock.waitFor({state:'visible'});const setup=page.getByRole('dialog',{name:'학교 초기 설정'});await setup.waitFor({state:'visible',timeout:10000});await setup.getByRole('button',{name:'나중에 설정'}).click();};
  const modules=[['school-admin','학교 행정 업무 도우미'],['finance','MY FINANCE · 암호화 로컬'],['purchase','품의 도우미 · 세션 전용'],['finder','교육영상 Finder · 합성 Mock'],['official','공문작업실 · 로컬 초안'],['inventory','물품관리 — 로컬 저장']];
  for(const [name,label] of modules){
    try{await reset();await dock.getByRole('button',{name:'업무 도구',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click({timeout:10000});await page.waitForTimeout(1000);await page.screenshot({path:join(screenshots,`module-${name}.png`)});result.moduleGui[name]='PASS: opened and captured only; remaining functional flows NOT RUN';}
    catch{result.moduleGui[name]='FAIL: could not open/capture';}
  }
  if(Object.values(result.moduleGui).some(v=>v.startsWith('FAIL')))throw Error('Module GUI open failed; see moduleGui evidence');
  await reset();
  // QA-only loopback Main inspector. Picker substitution is synthetic, never Explorer drag-and-drop.
  const nodeInfo=await (await fetch('http://127.0.0.1:19228/json/list')).json();
  mainWs=new WebSocket(nodeInfo[0].webSocketDebuggerUrl);
  await new Promise((ok,bad)=>{mainWs.addEventListener('open',ok,{once:true});mainWs.addEventListener('error',bad,{once:true});});
  let seq=0;const replies=new Map();
  mainWs.addEventListener('message',event=>{const message=JSON.parse(event.data);if(replies.has(message.id)){replies.get(message.id)(message);replies.delete(message.id);}});
  const mainEval=async expression=>{
    const id=++seq;const response=await new Promise((ok,bad)=>{const timer=setTimeout(()=>{replies.delete(id);bad(Error('Bounded QA Main probe timeout'));},45000);replies.set(id,m=>{clearTimeout(timer);ok(m);});mainWs.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});
    if(response.error||response.result?.exceptionDetails)throw Error('QA Main probe failed: '+String(response.result?.exceptionDetails?.exception?.description??response.error?.message??'unknown').split('\n')[0].slice(0,200));return response.result?.result?.value;
  };
  const mainCall=(fn,args)=>mainEval('('+fn.toString()+')('+JSON.stringify(args)+')');
  await mainCall(async function(){
    const e=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');
    const q=globalThis.__parityQa={e,picks:[],externalCalls:0};q.wc=e.BrowserWindow.getAllWindows().find(w=>w.isVisible()).webContents;
    q.originalDialog=e.dialog.showMessageBox;q.dialogMode='cancel';q.confirmations=[];
    e.dialog.showMessageBox=async(...args)=>{q.confirmations.push({mode:q.dialogMode});if(q.dialogMode==='defer')return new Promise(resolve=>{q.late=resolve;});return {response:q.dialogMode==='approve'?1:0,checkboxChecked:false};};
    q.external=[];q.originalOpen=e.shell.openExternal;e.shell.openExternal=async()=>{q.external.push('blocked dispatch');};
    return true;
  });
  result.stability={basis:'actual Windows Portable + renderer/Main IPC; synthetic files; Main consent injected where stated',trayIconClick:'NOT RUN: native tray icon gesture unavailable',nativeConsent:'NOT RUN: actual OS confirmation interaction; Main response is QA-controlled',externalSystems:'NOT RUN'};
  const checks=async(name,fn)=>{try{await fn();result.stability[name]={...(result.stability[name]??{}),verdict:'PASS'};}catch(e){result.stability[name]={...(result.stability[name]??{}),verdict:'FAIL',error:String(e).split('\n')[0].slice(0,220)};}finally{await writeFile(join(evidenceRoot,'stability-checkpoint.json'),JSON.stringify(result,null,2));}};
  const reload=async()=>{await page.reload();await dock.waitFor();const d=page.getByRole('dialog',{name:'학교 초기 설정'});if(await d.isVisible())await d.getByRole('button',{name:'나중에 설정'}).click();};
  const tool=async(label)=>{await reload();await dock.getByRole('button',{name:'업무 도구',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();};
  await page.addInitScript(()=>{window.confirm=()=>true;});await page.evaluate(()=>{window.confirm=()=>true;});
  result.stability.rendererConfirm='QA explicit synthetic acceptance; actual OS confirmation NOT RUN';
  page.on('dialog',dialog=>{void dialog.accept().catch(error=>{result.dialogHandlingErrors??=[];result.dialogHandlingErrors.push(String(error).split('\n')[0].slice(0,160));});});
  const userRoot=result.actualUserData;
  const {createHash}=await import('node:crypto');
  const digest=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
  const v1Path=join(userRoot,'work-data/education-video/library.json'),v2Path=join(userRoot,'work-data/education-video/library-v2.json');
  await mkdir(dirname(v1Path),{recursive:true});
  await writeFile(v1Path,await readFile(join(productRoot,'electron-p0/tests/fixtures/finder-v2/electron-v1.json')));
  await writeFile(v2Path,await readFile(join(productRoot,'electron-p0/tests/fixtures/finder-v2/tauri-v2.json')));
  const libraryBefore=[await digest(v1Path),await digest(v2Path)];
  await checks('finder',async()=>{
    await mainCall(async function(){const q=globalThis.__parityQa;q.originalClipRead=q.e.clipboard.readText;q.originalClipClear=q.e.clipboard.clear;q.e.clipboard.readText=()=>('AIza'+'0'.repeat(35));q.e.clipboard.clear=()=>{};q.dialogMode='defer';return true;});
    await page.evaluate(()=>{window.__qaConnect=window.electronWork.educationVideo.searchProvider.connectFromClipboard({remember:false});return true;});
    for(let i=0;i<20;i++){if(await mainCall(async function(){return !!globalThis.__parityQa.late;}))break;await delay(100);}
    await page.evaluate(()=>window.electronWork.educationVideo.searchProvider.cancel());await mainCall(async function(){const q=globalThis.__parityQa;if(!q.late)throw Error('Approval wait not reached');q.late({response:1,checkboxChecked:false});q.late=null;q.dialogMode='approve';return true;});
    const canceled=await page.evaluate(async()=>{const r=await window.__qaConnect,s=await window.electronWork.educationVideo.searchProvider.status();return !r.ok&&!s.data.configured&&!s.data.saved;});if(!canceled)throw Error('Late Finder approval activated key');
    const connected=await page.evaluate(()=>window.electronWork.educationVideo.searchProvider.connectFromClipboard({remember:false}));if(!connected.ok||!connected.data.configured)throw Error('Synthetic memory-only Finder configuration failed');result.stability.finder={lateApprovalDenied:true,memoryOnlyConfiguration:true};
    await tool('교육영상 Finder · 합성 Mock');
    await page.locator('.ev-search select').selectOption('mock');await page.getByLabel('교육 주제',{exact:true}).fill('합성 QA 보건교육');await page.getByLabel('검색 대상',{exact:true}).fill('합성 대상');await page.getByRole('button',{name:'Mock 영상 검색',exact:true}).click();
    await page.locator('.ev-results').getByRole('button',{name:/선택/}).first().click();

    const notes=page.getByLabel('사용자 메모',{exact:true});await notes.fill('SYNTHETIC_TRAY_MEMO');
    const proof=await mainCall(async function(){const q=globalThis.__parityQa;const win=q.e.BrowserWindow.fromWebContents(q.wc);const item=q.e.Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.type==='checkbox');if(!item?.enabled)throw Error('Tray unavailable');if(!item.checked)await item.click(item);const fs=process.getBuiltinModule('fs'),path=process.getBuiltinModule('path');let settings;for(let n=0;n<40;n++){try{settings=JSON.parse(fs.readFileSync(path.join(q.e.app.getPath('userData'),'poc-settings','desktop.json'),'utf8'));if(settings.closeBehavior==='tray')break;}catch{}await new Promise(r=>setTimeout(r,50));}if(settings?.closeBehavior!=='tray')throw Error('QA tray setting did not persist');q.windowId=win.id;q.handlers=q.e.ipcMain._invokeHandlers.size;return {id:win.id,wc:q.wc.id,pid:q.wc.getOSProcessId()};});
    const cycles=[];
    for(let i=0;i<3;i++){const hidden=await mainCall(async function(){const q=globalThis.__parityQa,w=q.e.BrowserWindow.fromWebContents(q.wc);w.close();await new Promise(r=>setTimeout(r,150));return {destroyed:w.isDestroyed(),visible:w.isVisible()};});if(hidden.destroyed||hidden.visible)throw Error('Close did not hide live window');
      const restored=await mainCall(async function(){const q=globalThis.__parityQa,w=q.e.BrowserWindow.fromWebContents(q.wc);w.show();w.focus();return {id:w.id,wc:q.wc.id,pid:q.wc.getOSProcessId(),handlers:q.e.ipcMain._invokeHandlers.size};});
      if(restored.id!==proof.id||restored.wc!==proof.wc||restored.pid!==proof.pid||await page.locator('.ev-layout label').filter({hasText:'사용자 메모'}).locator('textarea').inputValue()!=='SYNTHETIC_TRAY_MEMO')throw Error('Finder state lost across native hide/show');const status=await page.evaluate(()=>window.electronWork.educationVideo.searchProvider.status());if(!status.ok||!status.data.configured)throw Error('Finder permanently disposed across hide');cycles.push({hidden,restored,configured:true});}
    if(await digest(v1Path)!==libraryBefore[0]||await digest(v2Path)!==libraryBefore[1])throw Error('Finder files changed on hide');
    await page.screenshot({path:join(screenshots,'stability-finder-return.png')});result.stability.finder={cycles,libraryBytesPreserved:true,returnMethod:'actual close->hide; Main BrowserWindow.show (not tray-icon click)',unsavedMemoPreserved:true,lateApprovalDenied:true,sameMemoryOnlyConfiguration:true};
    await reload();await tool('교육영상 Finder · 합성 Mock');const status=await page.evaluate(()=>window.electronWork.educationVideo.searchProvider.status());if(!status.ok)throw Error('Finder reentry service failed');
  });
  const taskSeed=await page.evaluate(async()=>{const w=window.electronWork.tasks,l=await w.load();const d={...l.data.document,tasks:[{id:crypto.randomUUID(),title:'QA 기존 Task D-Day',scheduledDate:new Date().toISOString().slice(0,10),dueDate:new Date().toISOString().slice(0,10),completed:false,priority:'normal',category:'행사',dday:true}]};const r=await w.save(d,d.revision);if(!r.ok)throw Error('QA task seed failed');return r.data.document;});
  const taskFile=join(userRoot,'work-data/local-tasks/tasks.json'),taskHash=await digest(taskFile);
  const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  await checks('calendar',async()=>{
    await tool('독립 로컬 일정');const dialog=page.getByRole('dialog',{name:'독립 로컬 일정',exact:true});
    await dialog.getByRole('button',{name:'일정 추가',exact:true}).click();await dialog.getByLabel('일정 제목',{exact:true}).fill('QA 종일 일정');await dialog.getByRole('button',{name:'일정 저장',exact:true}).click();await dialog.getByText('독립 로컬 일정을 저장했습니다.',{exact:false}).waitFor();
    await dialog.getByRole('button',{name:'일정 추가',exact:true}).click();await dialog.getByLabel('일정 제목',{exact:true}).fill('QA 시간 일정');await dialog.getByLabel('종일 일정',{exact:true}).uncheck();await dialog.getByRole('button',{name:'일정 저장',exact:true}).click();await dialog.getByRole('button',{name:'일정 수정',exact:true}).waitFor();await dialog.getByRole('button',{name:'일정 수정',exact:true}).click();await dialog.getByLabel('일정 제목',{exact:true}).fill('QA 시간 수정');await dialog.getByRole('button',{name:'일정 저장',exact:true}).click();
    await dialog.getByRole('button',{name:'일정 추가',exact:true}).click();await dialog.getByLabel('일정 제목',{exact:true}).fill('QA 겹침 취소');await dialog.getByLabel('종일 일정',{exact:true}).uncheck();await dialog.getByText(/시간이 겹치는 일정/).first().waitFor();await dialog.getByRole('button',{name:'일정 편집 취소',exact:true}).click();
    const r=await page.evaluate(()=>window.electronWork.events.load());if(!r.ok||r.data.document.events.length!==2)throw Error('Event GUI CRUD failed');
    const stale=await page.evaluate(async()=>{const w=window.electronWork.events,l=await w.load();const row=l.data.document.events[0];const {createdAt,updatedAt,...event}=row;return w.save({event,expectedRevision:0,expectedUpdatedAt:updatedAt});});if(stale.ok)throw Error('Stale revision accepted');
    await page.screenshot({path:join(screenshots,'stability-calendar.png')});result.stability.calendar={revision:r.data.document.revision,count:2,overlapNotice:true,staleRevisionDenied:true,todayDate:today};
  });
  const schoolPath=join(userRoot,'work-data/school-profile/school.json');await mkdir(dirname(schoolPath),{recursive:true});
  const schoolDoc={version:1,revision:1,school:{officeCode:'K10',officeName:'강원특별자치도교육청',schoolCode:'1234567',schoolName:'합성 QA 학교 긴 이름 화면 검증 전용'}};await writeFile(schoolPath,JSON.stringify(schoolDoc));
  await checks('school',async()=>{
    await reload();await dock.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('navigation',{name:'설정 카테고리'}).getByRole('button',{name:'학교 프로필',exact:true}).click();const section=page.getByRole('region',{name:'학교 업무 주소 확인·적용'});
    await section.getByText('초기값:',{exact:false}).first().waitFor();await mainCall(async function(){globalThis.__parityQa.dialogMode='cancel';return true;});
    const before=await page.evaluate(()=>window.electronWork.admin.load());await section.getByRole('button',{name:'선택한 초기 주소 확인 후 적용',exact:true}).click();await section.getByText('주소 적용을 취소했습니다.',{exact:false}).waitFor();
    const after=await page.evaluate(()=>window.electronWork.admin.load());if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Cancelled address apply changed settings');
    await mainCall(async function(){globalThis.__parityQa.dialogMode='approve';return true;});await section.getByRole('button',{name:'선택한 초기 주소 확인 후 적용',exact:true}).click();await section.getByText('선택한 주소 저장을 완료했습니다.',{exact:false}).waitFor();
    const saved=await page.evaluate(()=>window.electronWork.admin.load());if(!saved.ok||!saved.data.document.systems.portal)throw Error('Address apply not saved');
    await page.screenshot({path:join(screenshots,'stability-school-address.png')});
    const school2={...schoolDoc,revision:2,school:{officeCode:'B10',officeName:'서울특별시교육청',schoolCode:'7654321',schoolName:'합성 QA 변경 학교'}};await writeFile(schoolPath,JSON.stringify(school2));await reload();
    const changed=await page.evaluate(async()=>({load:await window.electronWork.admin.load(),preview:await window.electronWork.admin.schoolAddresses()}));if(JSON.stringify(changed.load)!==JSON.stringify(saved))throw Error('School change overwrote URLs');if(changed.preview.data.entries.find(e=>e.system==='edufine')?.proposed)throw Error('Unregistered office has invented edufine');
    result.stability.school={cancelPreserved:true,applied:true,schoolChangePreserved:true,consent:'QA Main response injection, not native OS dialog',urlFreshness:'NOT VERIFIED'};
  });
  await checks('quickAddCalendar',async()=>{await tool('빠른 추가 · 로컬 업무');await page.getByRole('tab',{name:'일정',exact:true}).click();await page.getByRole('dialog',{name:'독립 로컬 일정',exact:true}).waitFor();});
  await checks('commandPaletteCalendar',async()=>{await tool('명령 팔레트');await page.getByLabel('명령 검색',{exact:true}).fill('독립 로컬 일정');await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'독립 로컬 일정',exact:true}).waitFor();});result.stability.lateNativeApproval='Main response injection tested; actual OS native dialog NOT RUN';result.stability.realExplorerDrop='NOT RUN (previous synthetic IPC evidence only)';
  // End instrumentation before a real Portable shutdown/relaunch.
  await mainCall(async function(){const q=globalThis.__parityQa;q.e.dialog.showMessageBox=q.originalDialog;q.e.shell.openExternal=q.originalOpen;if(q.originalClipRead){q.e.clipboard.readText=q.originalClipRead;q.e.clipboard.clear=q.originalClipClear;}return true;});
  if(mainWs){mainWs.close();mainWs=undefined;await delay(200);}
  await closeBrowser();await waitForWrapperExit();await browser.close();browser=undefined;browserSession=undefined;
  result.shutdown.browserCloseSent=false;child=launch();ownedPids.add(child.pid);child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});
  await waitForCdp();browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);browserSession=await browser.newBrowserCDPSession();
  const restoredPage=browser.contexts()[0].pages().find(p=>p.url().startsWith('file:'));await restoredPage.waitForLoadState('domcontentloaded');await restoredPage.waitForFunction(()=>!!window.electronWork);
  const restored=await restoredPage.evaluate(async()=>({info:await window.electronP0.info(),events:await window.electronWork.events.load(),tasks:await window.electronWork.tasks.load(),admin:await window.electronWork.admin.load()}));
  result.stability.restart={verdict:restored.info.userData===result.actualUserData&&restored.events.ok&&restored.events.data.document.events.length===2?'PASS':'FAIL',eventCount:restored.events.ok?restored.events.data.document.events.length:null,sameProfile:restored.info.userData===result.actualUserData};
  if(restored.events.ok&&restored.events.data.document.events.length){const deleted=await restoredPage.evaluate(async()=>{const api=window.electronWork.events,l=await api.load(),row=l.data.document.events[0];return api.remove({id:row.id,expectedRevision:l.data.document.revision,expectedUpdatedAt:row.updatedAt,confirmed:true});});result.stability.deleteAfterRestart=deleted.ok?'PASS':'FAIL';}
  result.stability.taskPreservation={verdict:await digest(taskFile)===taskHash?'PASS':'FAIL',ddayAndTaskBytesUnchanged:true};
  const eventsPath=join(userRoot,'work-data/local-events/events.json');const eventsBytes=await readFile(eventsPath);const backupPath=join(userRoot,'work-data/local-events/events.backup.json');await readFile(backupPath);
  await writeFile(eventsPath,'{invalid synthetic QA');const corrupted=await restoredPage.evaluate(async()=>{const api=window.electronWork.events,l=await api.load();if(!l.ok)return {readError:true};const row=l.data.document.events[0];if(!row)return {recovered:l.data.recovered};const {createdAt,updatedAt,...event}=row;const saved=await api.save({event,expectedRevision:l.data.document.revision,expectedUpdatedAt:updatedAt});return {recovered:l.data.recovered,writeDenied:!saved.ok};});await writeFile(eventsPath,eventsBytes);result.stability.corruption={...corrupted,basis:'only owned synthetic primary modified; original QA bytes restored'};
  if(Object.values(result.stability).some(v=>v&&typeof v==='object'&&v.verdict==='FAIL'))result.violations.push('One or more STABILITY focused checks failed; inspect stability evidence');


  await closeBrowser();
  await waitForWrapperExit();
  result.shutdown.wrapperExited=true;
  result.verdict=Object.values(result.stability??{}).some(v=>v&&typeof v==='object'&&v.verdict==='FAIL')?'FAIL':result.violations.length?'PARTIAL':'PASS';
  result.remaining=['Existing small-card/Quick Memo/Launcher PARTIAL requires manual review','OS DPI 125/150 NOT RUN','Actual credentials, paid AI, YouTube requests and school login NOT RUN'];
}catch(error){
  result.error=error instanceof Error?error.stack??error.message:String(error);
  result.verdict=process.env.TD2_FORCE_EXCEPTION==='1'&&String(error).includes('injected QA exception')?'EXPECTED_EXCEPTION':'FAIL';
}finally{
  if(mainWs){try{mainWs.close();mainWs=undefined;}catch{}}
  try{await cleanupOwned();if(result.verdict==='EXPECTED_EXCEPTION')result.verdict='PASS_EXCEPTION_CLEANUP';}
  catch(error){result.cleanupError=String(error);result.verdict='FAIL';}
  if(mainWs){try{mainWs.close();}catch{}}
  if(browser){try{await browser.close();}catch{}}
  await writeFile(join(evidenceRoot,process.env.TD2_FORCE_EXCEPTION==='1'?'exception-cleanup-result.json':'portable-gui-result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}
if(result.verdict==='FAIL')throw Error('Portable QA failed; see bounded evidence result');
