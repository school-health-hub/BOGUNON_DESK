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
await writeFile(join(seedRoot,'poc-settings','desktop.json'),JSON.stringify({version:1,closeBehavior:'quit',maximized:false}));
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
try{
 await waitForCdp();browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);browserSession=await browser.newBrowserCDPSession();const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('file:'));
 await page.waitForLoadState('domcontentloaded');const dock=page.getByRole('navigation',{name:'주요 기능'});await dock.waitFor();
 const info=await page.evaluate(()=>window.electronP0.info());if(info.sourceSha!==expectedSha||resolve(info.userData).toLowerCase()!==resolve(seedRoot).toLowerCase()||!info.qaProfile||!info.qaProfile.stores.every(p=>resolve(p).toLowerCase().startsWith(resolve(seedRoot).toLowerCase()+'\\')))throw Error('Source/isolated storage invariant failed');
 result.actualUserData=info.userData;result.profileIsolation={verdict:'PASS',...info.qaProfile};result.environment=native('Probe');result.devicePixelRatio=await page.evaluate(()=>devicePixelRatio);result.fixes=[];
 const eventBytes=await readFile(join(seedRoot,'work-data/local-events/events.json'),'utf8');
 for(const [width,height] of [[980,700],[900,680]]){
  native('Resize',['-Width',String(width),'-Height',String(height)]);await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await delay(250);
  const check=await page.evaluate(()=>{
   const rect=e=>e.getBoundingClientRect(),root=document.querySelector('.workspace-dashboard'),grid=document.querySelector('.desktop-widget-grid');
   const scrollingCells=[],dateIntrusions=[],eventIntrusions=[],dateEventOverlaps=[];let eventCount=0;const titles=[];
   for(const c of document.querySelectorAll('[data-widget-type="monthly-calendar"] .calendar-cell')){
    const cr=rect(c),d=c.querySelector('.calendar-date'),e=c.querySelector('.calendar-event');if(c.scrollHeight>c.clientHeight+1)scrollingCells.push({height:c.clientHeight,scrollHeight:c.scrollHeight});
    if(d){const dr=rect(d);if(dr.left<cr.left-1||dr.right>cr.right+1||dr.top<cr.top-1||dr.bottom>cr.bottom+1)dateIntrusions.push({cell:cr.toJSON(),date:dr.toJSON()});}
    if(e){eventCount++;const er=rect(e);titles.push({fullTitle:e.title,shownWidth:e.clientWidth,textWidth:e.scrollWidth,ellipsis:getComputedStyle(e).textOverflow});if(er.left<cr.left-1||er.right>cr.right+1||er.top<cr.top-1||er.bottom>cr.bottom+1)eventIntrusions.push({cell:cr.toJSON(),event:er.toJSON()});if(d&&rect(d).right>er.left+1)dateEventOverlaps.push({date:rect(d).toJSON(),event:er.toJSON()});}
   }
   const card=document.querySelector('[data-widget-type="clock"] .date-card'),body=card.querySelector('.date-card__body'),brand=card.querySelector('.date-card__eyebrow'),time=card.querySelector('.date-card__time'),date=card.querySelector('.date-card__date');const range=document.createRange();range.selectNodeContents(time);const tr=range.getBoundingClientRect(),br=rect(body),brr=rect(brand),dr=rect(date),car=rect(card);
   const clock={text:time.textContent.trim(),font:getComputedStyle(time).fontSize,time:tr.toJSON(),brand:brr.toJSON(),date:dr.toJSON(),card:car.toJSON(),body:br.toJSON(),fits:tr.left>=br.left-1&&tr.right<=br.right+1&&tr.bottom<=car.bottom-1&&brr.bottom<=tr.top+1&&tr.bottom<=dr.top+1&&dr.bottom<=car.bottom-1&&time.scrollWidth<=time.clientWidth+1};
   const horizontal={mainClient:root.clientWidth,mainScroll:root.scrollWidth,gridClient:grid.clientWidth,gridScroll:grid.scrollWidth,overflow:Math.max(0,root.scrollWidth-root.clientWidth),gridOverflow:Math.max(0,grid.scrollWidth-grid.clientWidth)};
   const calendar={eventCount,titles,scrollingCells,dateIntrusions,eventIntrusions,dateEventOverlaps,passed:eventCount>0&&!scrollingCells.length&&!dateIntrusions.length&&!eventIntrusions.length&&!dateEventOverlaps.length&&titles.every(t=>t.fullTitle.length>20&&t.ellipsis==='ellipsis')};
   return {viewport:{outerWidth,outerHeight,innerWidth,innerHeight},horizontal,calendar,clock};
  });
  await page.screenshot({path:join(screenshots,`fixed-dashboard-${width}x${height}.png`)});
  const dockRect=await dock.boundingBox();const quick=page.getByRole('button',{name:'빠른 추가',exact:true});await quick.click();await page.getByLabel('업무 제목',{exact:true}).waitFor();await page.keyboard.press('Escape');
  await dock.getByRole('button',{name:'업무 도구',exact:true}).click();await page.getByRole('dialog',{name:'업무 도구',exact:true}).waitFor();await page.getByRole('button',{name:'교육영상 Finder · 합성 Mock',exact:true}).click();await page.getByRole('heading',{name:/AI 교육영상 Finder/}).waitFor();await page.getByRole('button',{name:'보건 업무로',exact:true}).click();await dock.waitFor();
  const todayButton=page.locator('[data-widget-type="monthly-calendar"] .calendar-cell.is-today .calendar-date-action');await todayButton.click();const calendarDialog=page.getByRole('dialog',{name:'독립 로컬 일정',exact:true});await calendarDialog.waitFor();await calendarDialog.getByRole('button',{name:/합성 QA 긴 일정 제목/}).first().waitFor();await page.screenshot({path:join(screenshots,`event-link-${width}.png`)});await page.keyboard.press('Escape');
  const portal=page.getByRole('button',{name:'업무포털',exact:true});await portal.scrollIntoViewIfNeeded();await portal.click({trial:true});await page.screenshot({path:join(screenshots,`fixed-dashboard-${width}-bottom.png`)});
  const dockPass=!!dockRect&&dockRect.x>=0&&dockRect.y>=0&&dockRect.x+dockRect.width<=check.viewport.innerWidth+1&&dockRect.y+dockRect.height<=check.viewport.innerHeight+1;
  result.fixes.push({requested:{width,height},...check,regression:{quickAdd:'PASS (entry only)',tools:'PASS (entry only)',finder:'PASS (entry only)',calendarEventLink:'PASS (existing synthetic event shown)',portal:'PASS (visible/actionable only; not opened)',dock:dockPass?'PASS':'FAIL'},verdict:check.horizontal.overflow===0&&check.horizontal.gridOverflow===0&&check.calendar.passed&&check.clock.fits&&dockPass?'PASS':'FAIL'});
  await page.reload();await dock.waitFor();await writeFile(join(evidenceRoot,'gui-fix-checkpoint.json'),JSON.stringify(result,null,2));
 }
 if(await readFile(join(seedRoot,'work-data/local-events/events.json'),'utf8')!==eventBytes)throw Error('Display/link checks modified event fixture');result.eventFixtureUnchanged=true;
 await closeBrowser();await waitForWrapperExit();result.shutdown.wrapperExited=true;result.verdict=result.fixes.every(r=>r.verdict==='PASS')?'PASS':'FAIL';
 result.remaining=['Actual tray icon 3 cycles NOT RUN (manual QA)','OS DPI125/150 NOT RUN','900x680 native confirmation NOT RUN','Real school login/AI/Tauri migration NOT RUN'];
}catch(error){result.error=String(error).split('\n')[0].slice(0,500);result.verdict='FAIL';}
finally{try{await cleanupOwned();}catch(error){result.cleanupError=String(error);result.verdict='FAIL';}if(browser){try{await browser.close();}catch{}}await writeFile(join(evidenceRoot,'gui-fix-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
if(result.verdict==='FAIL')process.exitCode=1;
