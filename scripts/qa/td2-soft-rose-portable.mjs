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
await mkdir(join(seedRoot,'work-data/education-video'),{recursive:true});
await writeFile(join(seedRoot,'work-data/education-video/library.json'),await readFile(join(productRoot,'electron-p0/tests/fixtures/finder-v2/electron-v1.json')));
await writeFile(join(seedRoot,'work-data/education-video/library-v2.json'),await readFile(join(productRoot,'electron-p0/tests/fixtures/finder-v2/tauri-v2.json')));
const day=new Date(Date.now()+9*3600000).toISOString().slice(0,10),stamp=new Date().toISOString();
await writeFile(join(seedRoot,'work-data/local-events/events.json'),JSON.stringify({version:1,revision:1,timeZone:'Asia/Seoul',events:[{id:randomUUID(),title:'합성 QA 긴 일정 제목 · 작은 창 표시와 스크롤 확인',startDate:day,endDate:day,startTime:null,endTime:null,allDay:true,description:'합성 화면 검증 자료',location:'합성 장소',category:'행사',createdAt:stamp,updatedAt:stamp}]}));

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
const bounded=async(name,fn)=>{try{result.gui[name]=await fn();}catch(error){result.gui[name]={verdict:'FAIL',error:String(error).split('\n')[0].slice(0,240)};}await writeFile(join(evidenceRoot,'gui-final-checkpoint.json'),JSON.stringify(result,null,2));};
let mainCall;
try{
 await waitForCdp();browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);browserSession=await browser.newBrowserCDPSession();
 const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('file:'));await page.waitForLoadState('domcontentloaded');
 const dock=page.getByRole('navigation',{name:'주요 기능'});await dock.waitFor();
 const info=await page.evaluate(()=>window.electronP0.info());
 if(info.sourceSha!==expectedSha||resolve(info.userData).toLowerCase()!==resolve(seedRoot).toLowerCase())throw Error('Immutable source/QA userData mismatch');
 if(!info.qaProfile||!info.qaProfile.stores.every(p=>resolve(p).toLowerCase().startsWith(resolve(seedRoot).toLowerCase()+'\\'))||resolve(info.qaProfile.appData).toLowerCase()!==resolve(qaRoot,'app-data').toLowerCase()||resolve(info.qaProfile.sessionData).toLowerCase()!==resolve(seedRoot,'chromium').toLowerCase())throw Error('Sensitive storage escaped QA root');
 result.actualUserData=info.userData;result.profileIsolation={verdict:'PASS',...info.qaProfile};result.devicePixelRatio=await page.evaluate(()=>devicePixelRatio);result.gui={};result.environment=native('Probe');
 // Read/invoke only the existing app menu and window state; no consent/clipboard/network mocking.
 const endpoints=await (await fetch('http://127.0.0.1:19228/json/list')).json();mainWs=new WebSocket(endpoints[0].webSocketDebuggerUrl);await new Promise((ok,bad)=>{mainWs.addEventListener('open',ok,{once:true});mainWs.addEventListener('error',bad,{once:true});});
 let seq=0;const replies=new Map();mainWs.addEventListener('message',event=>{const m=JSON.parse(event.data);replies.get(m.id)?.(m);replies.delete(m.id);});
 mainCall=async fn=>{const id=++seq;const response=await new Promise((ok,bad)=>{const timer=setTimeout(()=>{replies.delete(id);bad(Error('QA Main observation timeout'));},15000);replies.set(id,m=>{clearTimeout(timer);ok(m);});mainWs.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:'('+fn.toString()+')()',awaitPromise:true,returnByValue:true}}));});if(response.error||response.result?.exceptionDetails)throw Error('QA Main observation failed');return response.result.result.value;};
 await mainCall(async function(){const e=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');globalThis.__guiFinal={e,w:e.BrowserWindow.getAllWindows().find(w=>w.isVisible())};return true;});
 const state=()=>mainCall(async function(){const q=globalThis.__guiFinal;return {id:q.w.id,visible:q.w.isVisible(),destroyed:q.w.isDestroyed(),wc:q.w.webContents.id,rendererPid:q.w.webContents.getOSProcessId()};});
 const reset=async()=>{await page.reload();await dock.waitFor();};
 const tool=async name=>{await reset();await dock.getByRole('button',{name:'업무 도구',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();if(name.includes('Finder'))await page.getByRole('heading',{name:/AI 교육영상 Finder/}).waitFor();};
 const school=async()=>{await reset();await dock.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('navigation',{name:'설정 카테고리'}).getByRole('button',{name:'학교 프로필',exact:true}).click();await page.getByRole('region',{name:'학교 업무 주소 확인·적용'}).getByText('초기값:',{exact:false}).first().waitFor();};
 const inspect=async(label,footer)=>{
  const before=await page.evaluate(()=>{
   const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
   const modal=[...document.querySelectorAll('[role="dialog"]')].filter(visible).at(-1),scope=modal??document.querySelector('.workspace-dashboard')??document.body;
   const owners=[scope,...scope.querySelectorAll('*')].filter(e=>visible(e)&&e.clientHeight>0&&e.scrollHeight>e.clientHeight+2&&/auto|scroll/.test(getComputedStyle(e).overflowY)).map(e=>{const old=e.scrollTop;e.scrollTop=e.scrollHeight;const reached=e.scrollTop+e.clientHeight>=e.scrollHeight-2;e.scrollTop=old;return {tag:e.tagName,class:e.className,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,reached};});
   const horizontal=scope.scrollWidth>scope.clientWidth+2||document.documentElement.scrollWidth>innerWidth+2;
   const controls=[...scope.querySelectorAll('button,input,select,textarea,[role="tab"]')].filter(visible).map(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;const hit=x>0&&x<innerWidth&&y>0&&y<innerHeight?document.elementFromPoint(x,y):null;return {e,r,hit:hit&&(e===hit||e.contains(hit))};}).filter(v=>v.hit);
   const overlaps=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j];if(a.e.contains(b.e)||b.e.contains(a.e))continue;const w=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left),h=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);if(w>4&&h>4)overlaps.push({a:a.e.tagName,b:b.e.tagName,width:w,height:h});}
   return {scope:{tag:scope.tagName,class:scope.className,clientWidth:scope.clientWidth,scrollWidth:scope.scrollWidth,rect:scope.getBoundingClientRect().toJSON(),overflowX:getComputedStyle(scope).overflowX,docWidth:document.documentElement.scrollWidth},horizontalOffenders:[...scope.querySelectorAll('*')].filter(e=>visible(e)&&e.clientWidth>0&&e.scrollWidth>e.clientWidth+2).slice(0,25).map(e=>({tag:e.tagName,class:e.className,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,overflowX:getComputedStyle(e).overflowX})),viewport:{innerWidth,innerHeight,outerWidth,outerHeight},horizontalOverflow:horizontal,scrollOwners:owners,overlaps,visibleControlCount:controls.length};
  });
  await page.screenshot({path:join(screenshots,label+'-top.png')});let footerResult=null;
  if(footer){await footer.scrollIntoViewIfNeeded();await footer.click({trial:true,timeout:5000});footerResult=await footer.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {top:r.top,bottom:r.bottom,viewportHeight:innerHeight,reachable:r.top>=0&&r.bottom<=innerHeight&&(hit===e||e.contains(hit))};});await page.screenshot({path:join(screenshots,label+'-bottom.png')});}
  return {verdict:!before.horizontalOverflow&&!before.overlaps.length&&before.scrollOwners.every(s=>s.reached)&&(!footerResult||footerResult.reachable)?'PASS':'FAIL',...before,footer:footerResult,criterion:'Vertical scrolling is allowed when controls and bottom remain reachable; no horizontal clipping/control overlap'};
 };
 for(const [width,height] of [[980,700],[900,680]]){
  const size=native('Resize',['-Width',String(width),'-Height',String(height)]);await delay(200);result.gui['bounds-'+width]={verdict:size.width===width&&size.height===height?'PASS':'FAIL',...size};
  await bounded(width+'-dashboard',async()=>{await reset();return inspect(width+'-dashboard');});
  await bounded(width+'-finder',async()=>{await tool('교육영상 Finder · 합성 Mock');return inspect(width+'-finder',page.getByRole('button',{name:'내보내기',exact:true}).first());});
  await bounded(width+'-calendar',async()=>{await tool('독립 로컬 일정');await page.getByRole('button',{name:'일정 추가',exact:true}).click();return inspect(width+'-calendar',page.getByRole('button',{name:'일정 편집 취소',exact:true}));});
  await bounded(width+'-quick-add',async()=>{await tool('빠른 추가 · 로컬 업무');await page.getByPlaceholder('추가할 업무를 입력하세요').fill('합성 QA 긴 업무 제목 · 작은 창의 입력과 저장 버튼 접근 확인');return inspect(width+'-quick-add',page.locator('.quick-add-panel button[type="submit"]'));});
  await bounded(width+'-school',async()=>{await school();return inspect(width+'-school',page.getByRole('button',{name:'선택한 초기 주소 확인 후 적용',exact:true}));});
 }
 result.gui.resizeRestore={...native('Resize',['-Width','980','-Height','700']),verdict:'PASS'};await reset();result.gui.resizeRestore.layout=await inspect('980-restored');
 // Actual Windows Explorer notification icon, never BrowserWindow.show as evidence.
 await bounded('nativeTray',async()=>{
  if(!result.environment.shellTrayVisible)return {verdict:'NOT RUN',reason:'Explorer shell tray absent from runner desktop',environment:result.environment};
  await tool('교육영상 Finder · 합성 Mock');await page.getByLabel('사용자 메모',{exact:true}).fill('SYNTHETIC_NATIVE_TRAY_MEMO');const initial=await state(),cycles=[];
  for(let i=0;i<3;i++){native('Close');await delay(300);const hidden=await state();if(hidden.visible||hidden.destroyed)throw Error('Native close did not hide live window');const gesture=native('TrayReturn',['-Screenshot',join(screenshots,`actual-tray-${i}.png`)]);if(gesture.verdict==='NOT RUN'){await mainCall(async function(){globalThis.__guiFinal.w.show();return true;});return {verdict:'NOT RUN',reason:gesture.reason,detail:gesture,uncreditedRecovery:'Main.show used only to recover automation; not a tray PASS'};}await delay(500);const restored=await state();if(!restored.visible||restored.id!==initial.id||restored.wc!==initial.wc||await page.locator('.ev-layout label').filter({hasText:'사용자 메모'}).locator('textarea').inputValue()!=='SYNTHETIC_NATIVE_TRAY_MEMO')throw Error('Actual icon failed to restore same Finder state');cycles.push({hidden,gesture,restored});await page.screenshot({path:join(screenshots,`actual-tray-return-${i}.png`)});}
  return {verdict:'PASS',cycles,basis:'Win32 close + actual Explorer icon mouse double-click; no show fallback in passing path'};
 });
 const trayState=await state();if(!trayState.visible&&!trayState.destroyed){await mainCall(async function(){globalThis.__guiFinal.w.show();return true;});result.gui.nativeTray.recovery='Main.show only after native tray failure, not credited';}
 const waitDialog=async(name)=>{for(let i=0;i<8;i++){const r=native('DialogProbe',['-Screenshot',join(screenshots,name+'.png')]);if(r.found)return r;await delay(200);}return {found:false};};
 const beginNative=async()=>{const l=await page.evaluate(()=>window.electronWork.admin.schoolAddresses());if(!l.ok)throw Error('Address preview failed');const p=l.data;await page.evaluate(p=>{window.__nativeApply=window.electronWork.admin.applySchoolAddresses({officeCode:p.school.officeCode,schoolCode:p.school.schoolCode,expectedRevision:p.revision,environment:p.environment,systems:['portal']});return true;},p);};
 let nativeAvailable=false;
 await bounded('nativeConfirm',async()=>{
  await school();await page.getByPlaceholder('예: 학교명').fill('합성 입력 유지').catch(()=>{});
  const before=await page.evaluate(()=>window.electronWork.admin.load());await beginNative();const probe=await waitDialog('native-cancel');
  if(!probe.found){await page.evaluate(()=>window.electronWork.admin.cancel());return {verdict:'NOT RUN',reason:'No accessible owned native dialog',probe};}
  nativeAvailable=true;const cancel=native('DialogCancel');if(!cancel.clicked)throw Error('Native cancel button inaccessible');const canceled=await page.evaluate(()=>window.__nativeApply);const after=await page.evaluate(()=>window.electronWork.admin.load());if(!canceled.ok||canceled.data!==null||JSON.stringify(before)!==JSON.stringify(after))throw Error('Native cancel changed settings');
  await beginNative();if(!(await waitDialog('native-approve')).found)throw Error('Approval dialog absent');const approve=native('DialogApprove');if(!approve.clicked)throw Error('Native approval button inaccessible');const saved=await page.evaluate(()=>window.__nativeApply);if(!saved.ok||!saved.data?.document.systems.portal)throw Error('Native approval did not save');
  const baseline=await page.evaluate(()=>window.electronWork.admin.load());await beginNative();if(!(await waitDialog('native-late-approve')).found)throw Error('Late approval dialog absent');await page.evaluate(()=>window.electronWork.admin.cancel());const late=native('DialogApprove');if(!late.clicked)throw Error('Late native click inaccessible');const lateResult=await page.evaluate(()=>window.__nativeApply);const final=await page.evaluate(()=>window.electronWork.admin.load());if(lateResult.ok&&lateResult.data!==null||JSON.stringify(baseline)!==JSON.stringify(final))throw Error('Late native approval changed settings');
  return {verdict:'PASS',cancel,approve,late,unchangedAfterCancel:true,lateApprovalInvalidated:true,basis:'actual owned #32770 Windows dialogs and Button BM_CLICK; no Main/renderer consent override'};
 });
 result.dpi={actual100:result.devicePixelRatio===1?'OBSERVED (see OS registry evidence)':'NOT VERIFIED',dpi125:'NOT RUN: hosted session has no approved interactive display-scale/sign-out change',dpi150:'NOT RUN: hosted session has no approved interactive display-scale/sign-out change',browserEmulationUsed:false};
 // Normal product quit while a real native consent is pending, if that dialog is available.
 if(nativeAvailable){await beginNative();result.pendingQuitDialog=await waitDialog('native-pending-quit');if(!result.pendingQuitDialog.found)throw Error('Pending native dialog absent; quit scenario not executed');}
 await mainCall(async function(){const q=globalThis.__guiFinal;const quit=q.e.Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.label==='완전 종료');if(!quit)throw Error('Product quit menu absent');quit.click();return true;}).catch(error=>{result.quitRequestError=String(error);});
 mainWs.close();mainWs=undefined;await waitForWrapperExit();result.shutdown.wrapperExited=true;
 result.gui.pendingNativeQuit=nativeAvailable?{verdict:'PASS',normalProductQuit:true,dialogWasVisible:!!result.pendingQuitDialog?.found}: {verdict:'NOT RUN',reason:'Native dialog unavailable'};
 result.verdict=Object.values(result.gui).some(v=>v?.verdict==='FAIL')?'FAIL':Object.values(result.gui).some(v=>v?.verdict==='NOT RUN')?'PARTIAL':'PASS';
}catch(error){result.error=String(error).split('\n')[0].slice(0,400);result.verdict='FAIL';}
finally{
 if(mainWs){try{mainWs.close();}catch{}}
 try{await cleanupOwned();}catch(error){result.cleanupError=String(error);result.verdict='FAIL';}
 if(browser){try{await browser.close();}catch{}}
 await writeFile(join(evidenceRoot,'gui-final-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
if(result.verdict==='FAIL')process.exitCode=1;
