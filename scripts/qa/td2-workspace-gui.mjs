// Focused UI evidence using the existing isolated Electron profile and real Preload.
// No Portable build, service calls, credentials, synthetic IPC replacement or user data.
import {_electron as electron,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out=resolve(process.env.TD2_UI_EVIDENCE??'artifacts/td2-workspace-ui');
const runId=randomUUID(),qaRoot=resolve(process.env.TD2_UI_PROFILE_ROOT??join(out,'..','td2-ui-profiles',runId));
await mkdir(qaRoot,{recursive:true});await mkdir(join(out,'screenshots'),{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={sourceSha:sha,dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),platform:process.platform,runId,realElectron:true,chromiumSandbox:true,records:[],errors:[],notRun:['Windows GUI / OS DPI / native file dialogs / physical print','External services / paid AI / operational SCHOOL WORKSPACE','Windows Finance SQLCipher/DPAPI editor when unavailable'],cleanup:null};
let app,page;
const wait=()=>new Promise(r=>setTimeout(r,200));
async function launch(syntheticSchool=false){
 app=await electron.launch({chromiumSandbox:true,timeout:30000,executablePath:process.env.ELECTRON_P0_EXECUTABLE,args:[resolve('build/electron-p0-app'),...(process.platform==='linux'?['--disable-setuid-sandbox']:[])],env:{...process.env,ELECTRON_P0_TEST_RUN:runId,ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:qaRoot,RUNNER_TEMP:process.env.RUNNER_TEMP??resolve(qaRoot,'..'),ELECTRON_P0_DEV_URL:'',SCHOOL_WORKSPACE_MODE:syntheticSchool?'synthetic':'',NODE_ENV:syntheticSchool?'development':'production'}});
 page=await app.firstWindow();page.setDefaultTimeout(5000);
 page.on('pageerror',e=>report.errors.push({type:'pageerror',message:e.message}));
 page.on('dialog',d=>d.dismiss()); // preserve drafts on every destructive confirmation
 await page.getByRole('navigation',{name:'주요 기능'}).waitFor();
 if(await page.getByRole('button',{name:'나중에 설정',exact:true}).count())await page.getByRole('button',{name:'나중에 설정',exact:true}).click();
 const info=await page.evaluate(()=>window.electronP0.info());
 if(!info.userData.includes(runId))throw Error('Profile isolation mismatch');
 if(info.sourceSha!==sha)throw Error('Build source SHA does not match the reviewed checkout');
 report.profile=info.userData;report.electron=info.electron;
}
const dock=key=>page.getByRole('navigation',{name:'주요 기능'}).locator(`button[data-dock-item="${key}"]`);
const click=async name=>{await page.getByRole('button',{name,exact:true}).first().click();};
const tool=async name=>{await dock('toolbox').click();await click(name);};
async function capture(id,size){
 await app.evaluate(({BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();if(size==='maximized')w.maximize();else w.setContentSize(size[0],size[1]);},size);
 await wait();
 const geometry=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {outer:w.getBounds(),content:w.getContentBounds(),maximized:w.isMaximized()};});
 const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),headings:[...document.querySelectorAll('h1,h2')].filter(e=>e.getClientRects().length).map(e=>e.textContent.trim()),dialogs:[...document.querySelectorAll('[role=dialog]')].filter(e=>e.getClientRects().length).map(e=>({name:e.getAttribute('aria-label')??e.querySelector('h1,h2')?.textContent,modal:e.getAttribute('aria-modal')}))}));
 const file=`${id}-${Array.isArray(size)?size.join('x'):size}.png`;
 await page.screenshot({path:join(out,'screenshots',file)});
 const hash=createHash('sha256').update(await readFile(join(out,'screenshots',file))).digest('hex');
 const scrollState=await page.evaluate(()=>{const nodes=[document.scrollingElement,...document.querySelectorAll('.rose-dialog-content,.purchase-helper-panel,.record-helper-panel__body,.workspace-dashboard')].filter(e=>e&&e.getClientRects().length);const before=nodes.map(e=>({top:e.scrollTop,left:e.scrollLeft}));nodes.forEach(e=>e.scrollTop=e.scrollHeight);return before;});
 await wait();const bottomFile=file.replace('.png','-bottom.png');await page.screenshot({path:join(out,'screenshots',bottomFile)});
 const bottomHash=createHash('sha256').update(await readFile(join(out,'screenshots',bottomFile))).digest('hex');
 await page.evaluate(before=>{const nodes=[document.scrollingElement,...document.querySelectorAll('.rose-dialog-content,.purchase-helper-panel,.record-helper-panel__body,.workspace-dashboard')].filter(e=>e&&e.getClientRects().length);nodes.forEach((e,i)=>{if(before[i]){e.scrollTop=before[i].top;e.scrollLeft=before[i].left;}});},scrollState);
 const result={file:'screenshots/'+file,sha256:hash,bottomFile:'screenshots/'+bottomFile,bottomSha256:bottomHash,...geometry,renderer:metrics};
 if(Array.isArray(size)&&(metrics.width!==size[0]||metrics.height!==size[1]))result.sizeError='Renderer size differs from request';
 if(size==='maximized'&&!geometry.maximized)result.maximized='NOT RUN — no window manager maximization';
 return result;
}
const selected=process.env.TD2_UI_MENUS?new Set(process.env.TD2_UI_MENUS.split(',')):null;
async function visit(id,open,close,exercise){
 if(selected&&!selected.has(id))return;
 const row={id,captures:[],checks:[],status:'NOT RUN'};report.records.push(row);
 try{if(open)await open();await wait();if(exercise)await exercise(row);for(const size of [[1280,800],[900,680],'maximized'])row.captures.push(await capture(id,size));row.status=(row.captures.some(c=>c.renderer.overflow>0||c.sizeError)||row.checks.some(c=>typeof c==='object'&&Object.values(c).includes(false)))?'FAIL':'PASS';if(close)await close();}
 catch(e){row.status='FAIL';row.error=e.message.split('\n')[0];try{await page.screenshot({path:join(out,'screenshots',id+'-failure.png')});await writeFile(join(out,id+'-failure.txt'),await page.locator('body').innerText());}catch{}await app.close().catch(()=>{});await launch();}
 await writeFile(join(out,'review.json'),JSON.stringify(report,null,2));
}
try{
 await launch();
 await visit('home',null,null);
 await visit('tools',()=>dock('toolbox').click(),()=>click('업무 도구 닫기'));
 await visit('tasks',()=>tool('일정·업무 — 로컬 저장'),()=>click('일정·업무 — 로컬 저장 닫기'),async row=>{
  await page.getByLabel('로컬 업무 제목',{exact:true}).fill('합성 UI 검토 — 긴 한글 업무 제목과 저장 상태 확인');await click('업무 저장');await page.getByText('업무를 저장했습니다. Dashboard에도 반영됐습니다.',{exact:true}).waitFor();row.checks.push('UI → existing Main local task save');
 });
 await visit('calendar',()=>tool('독립 로컬 일정'),()=>click('독립 로컬 일정 닫기'));
 await visit('quick-add',()=>page.getByRole('button',{name:'빠른 추가',exact:true}).click(),()=>click('빠른 추가 — 로컬 업무 닫기'));
 await visit('calculator',()=>tool('업무 계산기'),()=>click('업무 계산기 닫기'));
 await visit('palette',()=>tool('명령 팔레트'),()=>click('명령 팔레트 닫기'));
 await visit('folders',()=>tool('업무 폴더 · 즐겨찾기'),()=>click('업무 폴더 닫기'));
 await visit('official',()=>tool('공문작업실 · 로컬 초안'),()=>click('보건 업무로'));
 await visit('purchase',()=>tool('품의 도우미 · 세션 전용'),()=>click('품의 도우미 닫기'));
 await visit('record',()=>tool('생기부 도우미 · 세션 전용'),()=>click('생기부 도우미 닫기'));
 await visit('finder',()=>tool('교육영상 Finder'),()=>click('보건 업무로'));
 await visit('inventory',()=>tool('물품관리 — 로컬 저장'),()=>click('대시보드로'));
 await visit('inventory-preview',()=>tool('물품관리 — 미리보기'),()=>click('물품관리 미리보기 닫기'));
 await visit('finance',()=>tool('MY FINANCE · 암호화 로컬'),()=>click('보건 업무로'),async row=>{row.availability=await page.evaluate(()=>window.electronWork.finance.status());if(process.env.TD2_UI_REQUIRE_FINANCE==='1'){if(!row.availability.ok||!row.availability.data.available)throw Error('Original Finance native runtime unavailable; editor NOT RUN');await expect(page.getByRole('button',{name:'수입 등록',exact:true})).toBeEnabled({timeout:15000});row.checks.push('Original SQLCipher/DPAPI editor ready through real Main service');}});
 await visit('settings',()=>dock('settings').click(),()=>click('설정 닫기'),async row=>{
  const first=page.getByRole('button',{name:'설정 닫기'});await first.focus();await page.keyboard.press('Shift+Tab');row.checks.push({shiftTabInside:await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]'))});await page.keyboard.press('Tab');row.checks.push({tabInside:await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]'))});
 });
 for(const [id,name] of [['widgets','위젯'],['dock-settings','Dock'],['about','앱 정보'],['school-profile','학교 프로필'],['ai','AI 연결']])await visit(id,async()=>{await dock('settings').click();await page.getByRole('navigation',{name:'설정 카테고리'}).getByRole('button',{name,exact:true}).click();},()=>click('설정 닫기'));
 await visit('newsletter',async()=>{await dock('settings').click();await page.getByRole('button',{name:'앱 정보',exact:true}).click();await click('보건소식지 제작소');},()=>click('보건 업무로'));
 await visit('newsletter-editor',async()=>{await dock('settings').click();await page.getByRole('button',{name:'앱 정보',exact:true}).click();await click('보건소식지 제작소');await click('새 소식지 작성');await page.getByLabel('작성 월',{exact:true}).fill('2026-11');await click('새 소식지 만들기');await page.getByRole('heading',{name:'보건소식지 디자인 편집기',exact:true}).waitFor();},()=>click('보건 업무로'));
 await visit('school-admin',()=>tool('학교 행정 업무 도우미'),()=>click('보건 업무로'));
 await visit('school-workspace',()=>tool('우리 보건실 · 학교 공유'),async()=>{await click('개인 업무 · 이 PC로 돌아가기');await click('업무 도구 닫기');},async row=>{row.gate=await page.evaluate(()=>window.electronWorkspace.status());if(row.gate.connected)throw Error('Unexpected operational workspace activation');row.checks.push('Existing disconnected gate preserved');});
 await visit('memo-protected',()=>dock('quick-memo').click(),()=>click('빠른 메모 닫기'));
 if(process.env.TD2_UI_SYNTHETIC_SCHOOL==='1'){
  await app.close();await launch(true);
  await dock('toolbox').click();await click('우리 보건실 · 학교 공유');
  const workspace=page.getByRole('region',{name:'우리 보건실 제품 화면'});
  const gate=await page.evaluate(()=>window.electronWorkspace.status());if(gate.mode!=='qa'||!gate.connected)throw Error('Existing isolated SCHOOL provider unavailable');
  report.syntheticSchool={mode:gate.mode,hosted:false,realPurposeIpc:true,backend:'Existing isolated SCHOOL08 Windows PostgreSQL fixture'};
  await workspace.getByLabel('검증 계정').selectOption('3');await workspace.getByRole('button',{name:'로그인',exact:true}).click();
  await workspace.getByLabel('학교명',{exact:true}).fill('늘봄');await workspace.getByLabel('시도교육청').selectOption('B10');
  await workspace.getByRole('button',{name:'학교 검색',exact:true}).click();await workspace.getByRole('button',{name:'이 학교 선택',exact:true}).click();
  await workspace.getByRole('button',{name:'학교 공동 공간 열기',exact:true}).click();
  for(const [id,name]of [['shared-home','한눈에 보기'],['shared-tasks','공동 업무'],['shared-events','공동 일정'],['shared-notes','인수인계'],['shared-inventory','공동 물품관리'],['instructor','보건지원강사 근무관리']]){
   await visit(id,()=>workspace.getByRole('navigation',{name:'우리 보건실 메뉴'}).getByRole('button',{name,exact:true}).click(),null);
  }
 }

}catch(e){report.errors.push({type:'fatal',message:e.message});}
finally{if(app){
 const pids=await app.evaluate(({app})=>app.getAppMetrics().map(m=>m.pid)).catch(()=>[]);if(app.process()?.pid)pids.push(app.process().pid);
 await app.close().then(()=>report.cleanup='Playwright Electron application closed normally').catch(e=>report.cleanup=e.message);
 await new Promise(r=>setTimeout(r,500));const remaining=[];
 for(const pid of [...new Set(pids)]){try{process.kill(pid,0);if(process.platform==='linux'){const stat=await readFile(`/proc/${pid}/stat`,'utf8');if(stat.split(') ')[1]?.startsWith('Z'))continue;}remaining.push(pid);}catch{}}
 report.processCleanup={tracked:[...new Set(pids)],remaining,zeroResidual:remaining.length===0,scope:'Only PIDs reported by this isolated Electron instance; no termination of other processes'};
 }await writeFile(join(out,'review.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({output:out,pass:report.records.filter(r=>r.status==='PASS').length,fail:report.records.filter(r=>r.status==='FAIL').map(r=>({id:r.id,error:r.error,captures:r.captures.filter(c=>c.renderer.overflow||c.sizeError)})),errors:report.errors,cleanup:report.cleanup},null,2));
process.exitCode=report.errors.length||report.records.some(r=>r.status==='FAIL')||report.processCleanup?.remaining.length?1:0;
