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
  for(const [width,height] of [[1440,900],[1280,800],[980,700]]){
    const nativeBounds=setWindowBounds(width,height);
    await page.waitForFunction(([targetWidth,targetHeight])=>Math.abs(outerWidth-targetWidth)<=2&&Math.abs(outerHeight-targetHeight)<=2,[width,height]);
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
  const WebSocket=requireFromProduct('ws');
  const nodeInfo=await (await fetch('http://127.0.0.1:19228/json/list')).json();
  mainWs=new WebSocket(nodeInfo[0].webSocketDebuggerUrl);
  await new Promise((ok,bad)=>{mainWs.once('open',ok);mainWs.once('error',bad);});
  let seq=0;const replies=new Map();
  mainWs.on('message',bytes=>{const message=JSON.parse(bytes.toString());if(replies.has(message.id)){replies.get(message.id)(message);replies.delete(message.id);}});
  const mainEval=async expression=>{
    const id=++seq;const response=await new Promise((ok,bad)=>{const timer=setTimeout(()=>{replies.delete(id);bad(Error('Bounded QA Main probe timeout'));},45000);replies.set(id,m=>{clearTimeout(timer);ok(m);});mainWs.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});
    if(response.error||response.result?.exceptionDetails)throw Error('QA Main probe failed (content omitted)');return response.result?.result?.value;
  };
  const mainCall=(fn,args)=>mainEval('('+fn.toString()+')('+JSON.stringify(args)+')');
  await mainCall(async function(){
    const e=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');
    const q=globalThis.__parityQa={e,picks:[],externalCalls:0};q.wc=e.BrowserWindow.getAllWindows().find(w=>w.isVisible()).webContents;
    q.originalPicker=e.dialog.showOpenDialog;e.dialog.showOpenDialog=async()=>({canceled:!q.picks.length,filePaths:q.picks.shift()??[]});
    q.originalStatus=e.ipcMain._invokeHandlers.get('p2:chatgpt:status');
    e.ipcMain._invokeHandlers.set('p2:chatgpt:status',async()=>({ok:true,data:{supported:true,phase:'ready',busy:false,accountId:'1'.repeat(64),identity:'synthetic QA',planUsageEnabled:true,models:[{id:'gpt-synthetic',label:'Synthetic QA only'}],model:'gpt-synthetic',textCallVerified:false,showPlanNotice:false,notice:'Synthetic UI state; no external calls'}}));
    q.denied=new Map();for(const [name,fn] of e.ipcMain._invokeHandlers)if(/p2:(record:generateReviewed|chatgpt:(signIn|refreshModels|generate)|ai:(connectFromClipboard|restore|generate))$/.test(name)){q.denied.set(name,fn);e.ipcMain._invokeHandlers.set(name,async()=>{q.externalCalls++;return {ok:false,error:{code:'FORBIDDEN',message:'External request disabled in synthetic QA',retryable:false}};});}
    return true;
  });
  const choose=paths=>mainCall(async function(paths){globalThis.__parityQa.picks.push(paths);return true;},paths);
  const fixture=resolve(productRoot,'build/record-helper-fixtures');
  const paths=Object.fromEntries(['synthetic.pdf','synthetic.hwp','compressed.hwp','synthetic.hwpx','synthetic.docx','protected.hwp'].map(n=>[n,join(fixture,n)]));
  const resetParity=async()=>{await page.reload();await dock.waitFor({state:'visible'});const setup=page.getByRole('dialog',{name:'학교 초기 설정'});await setup.waitFor({state:'visible'});await setup.getByRole('button',{name:'나중에 설정'}).click();};
  result.parity={basis:'actual Portable; QA-only Main picker substitution + real renderer IPC; no real accounts',explorerDrop:'NOT RUN: controller cannot produce trusted Windows Explorer drag gesture'};
  await resetParity();await dock.getByRole('button',{name:'업무 도구',exact:true}).click();await page.getByRole('button',{name:/생기부 도우미/}).click();
  await choose(Object.values(paths));await page.getByRole('button',{name:'활동보고서 파일 추가',exact:true}).click();
  await page.getByText('5개 보고서',{exact:true}).waitFor({state:'visible',timeout:45000});
  await page.getByRole('alert',{name:'가져오지 못한 파일'}).waitFor({state:'visible'});
  await page.locator('.record-helper-workspace__list').getByText('synthetic.pdf',{exact:true}).click();await page.getByLabel('학생 구분',{exact:true}).fill('합성A');await page.getByLabel('교사 메모/관찰 내용',{exact:true}).fill('RECORD_QA_TRANSIENT_A');
  await page.locator('.record-helper-workspace__list').getByText('synthetic.docx',{exact:true}).click();await page.getByLabel('학생 구분',{exact:true}).fill('합성B');await page.getByLabel('교사 메모/관찰 내용',{exact:true}).fill('RECORD_QA_TRANSIENT_B');
  await page.locator('.record-helper-workspace__list').getByText('synthetic.pdf',{exact:true}).click();if(await page.getByLabel('교사 메모/관찰 내용',{exact:true}).inputValue()!=='RECORD_QA_TRANSIENT_A')throw Error('Student workspace isolation failed');
  await page.getByRole('button',{name:'ChatGPT 요금제로 초안 작성',exact:true}).click();const approval=page.getByRole('dialog',{name:'AI 전송 내용 확인'});await approval.waitFor({state:'visible'});
  if(!(await approval.getByLabel('비식별 활동보고서').isVisible())||!(await approval.getByRole('button',{name:'확인 후 전송'}).isVisible()))throw Error('AI review gate missing');
  await approval.getByRole('button',{name:'취소',exact:true}).first().click();
  await page.getByRole('button',{name:'선택 보고서 제거',exact:true}).click();await page.getByRole('dialog',{name:'보고서 제거',exact:true}).getByRole('button',{name:'취소',exact:true}).click();await page.getByText('5개 보고서',{exact:true}).waitFor();
  await page.getByRole('button',{name:'전체 비우기',exact:true}).click();await page.getByRole('dialog',{name:'작업실 전체 비우기',exact:true}).getByRole('button',{name:'취소',exact:true}).click();
  await page.getByRole('button',{name:'생기부 도우미 닫기',exact:true}).click();const closePrompt=page.getByRole('dialog',{name:'생기부 도우미 닫기',exact:true});await closePrompt.getByRole('button',{name:'취소',exact:true}).click();await page.getByText('5개 보고서',{exact:true}).waitFor();
  await page.getByRole('button',{name:'생기부 도우미 닫기',exact:true}).click();await page.getByRole('dialog',{name:'생기부 도우미 닫기',exact:true}).getByRole('button',{name:'닫고 비우기',exact:true}).click();
  result.parity.recordUi={verdict:'PASS',nativeBatch:'5 valid + 1 protected failure',studentIsolation:true,reviewAndApprovalScreen:'PASS with synthetic connection state only',cancelRemoveClearClosePreserve:true,confirmedCloseClearsSession:true};
  await resetParity();
  const prepared=await page.evaluate(async()=>{const w=window.electronWork,s=await w.purchase.settings.load();if(!s.ok)throw Error('Settings load failed');const d={...s.data.document,draftTemplates:[{id:'qa-template',name:'QA template',titlePattern:'{{title}}',introPattern:'{{purpose}}',detailFieldOrder:['summary','amount','vendor','budgetItem'],attachmentPhrase:'QA attachment',includeAttachment:true}],importTemplates:[{id:'qa-mapping',name:'QA CSV',headerSignature:['name','quantity','price'],mapping:{name:0,quantity:1,unitPrice:2}}],outputColumns:['name','note','amount']};const r=await w.purchase.settings.save(d,d.revision);if(!r.ok)throw Error('Settings save failed');return {revision:r.data.document.revision};});
  const favorites=join(qaRoot,'synthetic-favorite');await mkdir(favorites,{recursive:true});await choose([favorites]);
  await page.evaluate(async()=>{const api=window.electronWork.workFolders,l=await api.load();if(!l.ok)throw Error('Folder load failed');const r=await api.pick({expectedRevision:l.data.revision});if(!r.ok||!r.data||r.data.favorites.length!==1)throw Error('Folder save failed');});
  const v1=JSON.parse(await readFile(join(productRoot,'electron-p0/tests/fixtures/finder-v2/electron-v1.json'),'utf8'));const v2=JSON.parse(await readFile(join(productRoot,'electron-p0/tests/fixtures/finder-v2/tauri-v2.json'),'utf8'));
  for(const [name,value] of [['v1',v1],['v2',v2]]){const file=join(qaRoot,'finder-'+name+'.json');await writeFile(file,JSON.stringify(value));await choose([file]);await page.evaluate(async()=>{const api=window.electronWork.educationVideo.compat,p=await api.prepareImport();if(!p.ok||!p.data)throw Error('Reviewed import prepare failed');const r=await api.applyImport({token:p.data.token,selectedIds:p.data.rows.filter(r=>!r.conflict).map(r=>r.videoId)});if(!r.ok||r.data.added<1)throw Error('Reviewed Finder import failed');});}
  const stage=files=>mainCall(async function(files){const q=globalThis.__parityQa;const event={sender:q.wc,senderFrame:q.wc.mainFrame};const r=await q.e.ipcMain._invokeHandlers.get('p2:drop:stage')(event,files);if(!r.ok)throw Error('Synthetic stage rejected');return r.data;},files);
  const clearDropUi=async()=>{const d=page.getByRole('dialog',{name:'드롭 파일 확인',exact:true});if(await d.isVisible())await d.getByRole('button',{name:'취소',exact:true}).click();};
  const csv=join(qaRoot,'synthetic.csv');await writeFile(csv,'name,quantity,price\nQA item,2,100\n');
  const dropCases=[['purchase CSV',csv,'purchase-helper','purchase'],['purchase PNG',join(productRoot,'electron-p0/tests/fixtures/purchase-image/synthetic-cart.png'),'purchase-helper','images'],['official PDF',paths['synthetic.pdf'],'official-document','official'],['official HWPX',paths['synthetic.hwpx'],'official-document','official'],['record PDF',paths['synthetic.pdf'],'record-helper','record'],['record DOCX',paths['synthetic.docx'],'record-helper','record']];
  result.parity.syntheticDrop={basis:'Main handler stage injection; renderer IPC approve/consume; NOT Explorer',cases:{}};
  for(const [label,file,target,method] of dropCases){const offer=await stage([file]);const pendingDenied=await page.evaluate(async({token,method,id})=>{const api=window.electronWork.fileDrop;const r=await api[method]({token,...(method==='purchase'?{sourceId:id}:{})});return !r.ok;},{token:offer.token,method,id:offer.files[0].id});if(!pendingDenied)throw Error('Unapproved drop consumed');
    const success=await page.evaluate(async({token,target,method,id})=>{const api=window.electronWork.fileDrop;const a=await api.approve({token,target,approved:true});if(!a.ok)return false;const r=await api[method]({token,...(method==='purchase'?{sourceId:id}:{})});if(method==='images')await window.electronWork.purchase.images.cancel();return r.ok&&!!r.data;},{token:offer.token,target,method,id:offer.files[0].id});if(!success)throw Error('Approved synthetic drop import failed');await clearDropUi();result.parity.syntheticDrop.cases[label]='PASS (synthetic Main stage + real importer/native process)';}
  const offer=await stage([paths['synthetic.pdf']]);if(offer.candidates.filter(c=>c.enabled).length<2)throw Error('Multiple target choices missing');await page.getByRole('dialog',{name:'드롭 파일 확인',exact:true}).getByRole('button',{name:/생기부/}).click();await clearDropUi();
  const changed=join(qaRoot,'changed.csv');await writeFile(changed,'name,quantity,price\nQA item,1,10\n');const stale=await stage([changed]);await writeFile(changed,'name,quantity,price\nChanged QA item,22,100\n');const denied=await page.evaluate(async token=>!(await window.electronWork.fileDrop.approve({token,target:'purchase-helper',approved:true})).ok,stale.token);if(!denied)throw Error('Changed dropped file accepted');await clearDropUi();
  result.parity.syntheticDrop.changedSourceDenied=true;result.parity.syntheticDrop.multipleChoicesAndCancel=true;
  const scan=await mainCall(async function(){const q=globalThis.__parityQa,fs=process.getBuiltinModule('fs/promises'),path=process.getBuiltinModule('path');const dir=path.join(q.e.app.getPath('userData'),'work-data/drop-import-tmp');let left=[];for(let i=0;i<20;i++){left=await fs.readdir(dir).catch(()=>[]);if(!left.length)break;await new Promise(r=>setTimeout(r,100));}q.e.dialog.showOpenDialog=q.originalPicker;q.e.ipcMain._invokeHandlers.set('p2:chatgpt:status',q.originalStatus);if(q.externalCalls)throw Error('Unexpected AI request attempted');return {temporaryCopies:left.length,externalCalls:q.externalCalls};});
  if(scan.temporaryCopies!==0||scan.externalCalls!==0)throw Error('Temporary drop copy or external request invariant failed');result.parity.cleanup=scan;

  const synthetic=await page.evaluate(async()=>{
    const w=window.electronWork;const current=await w.inventory.load();if(!current.ok||current.data.document!==null)throw Error('Expected empty isolated inventory');
    const doc={version:1,items:[{itemId:'qa-item',name:'합성 QA 물품',baseUnit:'개',recommendedStock:2}],lots:[],movements:[],updatedAt:new Date().toISOString()};
    const save=await w.inventory.save(doc,null);if(!save.ok)throw Error('Synthetic inventory save failed');return save.data.document.updatedAt;
  });
  result.inventoryPersistence='saved; restart pending';
  if(mainWs){mainWs.close();mainWs=undefined;await delay(200);}
  await closeBrowser();await waitForWrapperExit();await browser.close();browser=undefined;browserSession=undefined;
  result.shutdown.browserCloseSent=false;child=launch();ownedPids.add(child.pid);child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});
  await waitForCdp();browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);browserSession=await browser.newBrowserCDPSession();
  const restoredPage=browser.contexts()[0].pages().find(p=>p.url().startsWith('file:'));
  await restoredPage.waitForLoadState('domcontentloaded');
  await restoredPage.waitForFunction(()=>!!window.electronWork);
  const restored=await restoredPage.evaluate(async()=>{const info=await window.electronP0.info();const r=await window.electronWork.inventory.load();return {userData:info.userData,ok:r.ok&&r.data.document?.items.some(i=>i.itemId==='qa-item')};});
  if(!restored.ok||restored.userData!==result.actualUserData)throw Error('Isolated inventory restart failed');
  result.inventoryPersistence='PASS: synthetic item saved and restored across actual Portable restart';
  const roundTrip=await restoredPage.evaluate(async()=>{const w=window.electronWork;const p=await w.purchase.settings.load(),f=await w.workFolders.load(),v1=await w.educationVideo.load(),v2=await w.educationVideo.compat.loadV2();return {purchase:p.ok&&p.data.document.draftTemplates.some(t=>t.id==='qa-template')&&p.data.document.importTemplates.some(t=>t.id==='qa-mapping')&&p.data.document.outputColumns.join(',')==='name,note,amount',folders:f.ok&&f.data.favorites.length===1&&f.data.favorites[0].available,v1:v1.ok&&v1.data.library.items.length>0,v2:v2.ok&&v2.data.library.entries.length>0};});
  if(!Object.values(roundTrip).every(Boolean))throw Error('Packaged persistence round-trip failed');result.parity.persistence={...roundTrip,basis:'saved through packaged renderer/Main IPC; restored after Portable process restart'};


  await closeBrowser();
  await waitForWrapperExit();
  result.shutdown.wrapperExited=true;
  result.verdict=result.violations.length?'PARTIAL':'PASS';
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
