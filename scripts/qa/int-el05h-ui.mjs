import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
const require=createRequire(resolve('.qa-runtime/package.json'));
const {chromium}=require('playwright');
const out=process.env.INT_EL05H_OUTPUT;
await mkdir(out,{recursive:true});
const report={sourceSha:'c06ce6a910002cc7658a5545e23e0d3ed914d377',connection:'NOT RUN',checks:[],images:[],errors:[]};
const assert=(value,message)=>{if(!value)throw Error(message)};
let browser,page;
const check=async(name,fn)=>{try{await resetDashboard();await fn();report.checks.push({name,status:'PASS'})}catch(e){report.checks.push({name,status:'FAIL',error:e.message});if(page)await capture('failure-'+name).catch(()=>{});}finally{console.log('::notice title=INT_EL05H_CHECK::'+JSON.stringify(report.checks.at(-1)))}};
async function resetDashboard(){
 const dialog=page.getByRole('dialog');
 if(await dialog.count()){
  const close=dialog.getByRole('button',{name:/^(설정|빠른 메모|업무 도구) 닫기$/});
  if(await close.count())await close.first().click();
 }
 for(const label of ['보건 업무로','품의 도우미 닫기']){
  const back=page.getByRole('button',{name:label,exact:true});
  if(await back.count()&&await back.first().isVisible())await back.first().click();
 }
 await visible(page.getByRole('navigation',{name:'주요 기능'}));
}
async function capture(name){const file=name+'.png',path=join(out,file);await page.screenshot({path});report.images.push({file,sha256:createHash('sha256').update(await readFile(path)).digest('hex'),native:resizeOwnedWindow(),renderer:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))});}
// CDP is used only for renderer interaction. Native HWND/PID identity is checked on every measurement/resize.
function resizeOwnedWindow(width=0,height=0){
 const script=`
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class QaWindow {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
}
'@
[void][QaWindow]::SetThreadDpiAwarenessContext([IntPtr](-4))
$handle=[IntPtr]([long]$env:INT_EL05H_HWND);[uint32]$owner=0
if(-not [QaWindow]::IsWindow($handle)){throw 'Identified Portable HWND no longer exists'}
[void][QaWindow]::GetWindowThreadProcessId($handle,[ref]$owner)
if($owner -ne [uint32]$env:INT_EL05H_PID){throw 'HWND PID mismatch'}
$process=Get-CimInstance Win32_Process -Filter "ProcessId=$owner"
if(-not $process -or $process.ExecutablePath -ne $env:INT_EL05H_APP_PATH){throw 'Owned Portable executable mismatch'}
$width=[int]$env:QA_WIDTH;$height=[int]$env:QA_HEIGHT
if($width -gt 0){
 if(-not [QaWindow]::SetWindowPos($handle,[IntPtr]::Zero,0,0,$width,$height,0x14)){throw 'SetWindowPos failed'}
 Start-Sleep -Milliseconds 350
}
$outer=[QaWindow+RECT]::new();$client=[QaWindow+RECT]::new()
if(-not [QaWindow]::GetWindowRect($handle,[ref]$outer) -or -not [QaWindow]::GetClientRect($handle,[ref]$client)){throw 'Native window measurement failed'}
$result=@{pid=$owner;hwnd=$handle.ToInt64();outer=@{width=$outer.Right-$outer.Left;height=$outer.Bottom-$outer.Top};client=@{width=$client.Right-$client.Left;height=$client.Bottom-$client.Top}}
if($width -gt 0 -and ($result.outer.width -ne $width -or $result.outer.height -ne $height)){throw "Native resize mismatch: $($result | ConvertTo-Json -Compress)"}
$result | ConvertTo-Json -Compress
`;
 const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',timeout:15000,env:{...process.env,QA_WIDTH:String(width),QA_HEIGHT:String(height)}});
 assert(!result.error&&result.status===0,'Native HWND resize/measurement failed: '+(result.error?.message||result.stderr));
 return JSON.parse(result.stdout.trim());
}
async function visible(locator){await locator.waitFor({state:'visible',timeout:10000})}
async function focus(locator){assert(await locator.evaluate(el=>el===document.activeElement),'Expected focus')}
try{
 assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.INT_EL05H_ENDPOINT),'Loopback endpoint required');
 browser=await chromium.connectOverCDP(process.env.INT_EL05H_ENDPOINT,{timeout:15000});
 const pages=browser.contexts().flatMap(c=>c.pages());
 page=pages.find(p=>p.url().includes('/resources/app.asar/renderer/index.html'));
 assert(page,'Exact extracted Portable renderer target required');
 page.setDefaultTimeout(7000);
 page.on('pageerror',e=>report.errors.push(e.message));
 const info=await page.evaluate(()=>window.electronP0.info());
 assert(info.sourceSha===report.sourceSha,'Product SHA mismatch');assert(info.userData.includes(process.env.INT_EL05H_PROFILE),'Isolated profile required');
 report.connection='PASS';report.info=info;
 const dock=page.getByRole('navigation',{name:'주요 기능'});
 await visible(dock);

 const settings=()=>dock.getByRole('button',{name:'설정',exact:true});
 for(const [width,height] of [[980,700],[1440,900]])await check('layout-'+width,async()=>{
  report['native'+width]=resizeOwnedWindow(width,height);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const layout=await page.evaluate(()=>{const m=document.querySelector('.workspace-dashboard'),d=document.querySelector('.dock-zone'),s=document.querySelector('.workspace-shell');return {main:m.getBoundingClientRect().toJSON(),dock:d.getBoundingClientRect().toJSON(),position:getComputedStyle(d).position,scroll:getComputedStyle(m).overflowY,overflow:s.scrollWidth>innerWidth,outer:{width:outerWidth,height:outerHeight},renderer:{width:innerWidth,height:innerHeight}}});
  report['layout'+width]=layout;
  assert(!layout.overflow,'Horizontal Surface overflow');assert(layout.scroll==='auto','Dashboard must scroll');
  if(width===980){assert(layout.position==='static','Dock independent row');assert(layout.main.bottom<=layout.dock.top+1,'Dock overlaps Dashboard');assert(layout.dock.bottom<=layout.renderer.height+1,'Dock outside renderer')}else assert(layout.position==='fixed','Floating Dock regression');
  const main=page.locator('.workspace-dashboard');await main.evaluate(el=>{el.scrollTop=el.scrollHeight});
  assert(await main.evaluate(el=>el.scrollTop+el.clientHeight>=el.scrollHeight-1),'Bottom unreachable');
  report['scroll'+width]=await main.evaluate(el=>({top:el.scrollTop,height:el.scrollHeight,client:el.clientHeight}));
  const memo=page.locator('[data-widget-type="quick-memo"]');await memo.scrollIntoViewIfNeeded();assert(await memo.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Quick Memo overflow');
  const save=memo.getByRole('button',{name:'메모 저장',exact:true});await save.click();
  await main.evaluate(el=>{el.scrollTop=0});
  const texts=await page.locator('[data-widget-type="clock"] .date-card').evaluate(el=>['.date-card__time','.date-card__date'].map(s=>{const t=el.querySelector(s);return {text:t.textContent,width:t.clientWidth,scroll:t.scrollWidth}}));
  assert(/\d{2}:\d{2}/.test(texts[0].text),'Clock HH:MM missing');for(const t of texts)assert(t.scroll<=t.width+1,'Clock/date clipping');
  report['korean'+width]=await page.locator('.workspace-dashboard h1,.workspace-dashboard h2,.workspace-dashboard h3').allTextContents();assert(report['korean'+width].some(t=>/[가-힣]/.test(t)),'Korean headings missing');
  const taskNames=await page.locator('.task-title-action,.priority-task-open').evaluateAll(nodes=>nodes.map(el=>({text:el.textContent,width:el.clientWidth,scroll:el.scrollWidth,whiteSpace:getComputedStyle(el).whiteSpace})));
  report['taskNames'+width]={status:taskNames.length?'OBSERVED':'NOT RUN — isolated default has no task rows',rows:taskNames};
  for(const task of taskNames)assert(task.scroll<=task.width+1,'Korean task horizontal clipping');
  await capture('surface-'+width);
 });
 await check('settings-keyboard',async()=>{
  await settings().click();const modal=page.getByRole('dialog',{name:'설정',exact:true});await visible(modal);assert(await modal.getAttribute('aria-modal')==='true','Settings must be modal');
  const close=modal.getByRole('button',{name:'설정 닫기'});await focus(close);assert(await page.locator('#root').evaluate(el=>el.inert),'Background not inert');
  await page.keyboard.press('Shift+Tab');assert(await modal.evaluate(el=>el.contains(document.activeElement)),'Shift+Tab escaped');await page.keyboard.press('Tab');await focus(close);
  await capture('settings');await page.keyboard.press('Escape');await modal.waitFor({state:'detached'});await focus(settings());assert(!await page.locator('#root').evaluate(el=>el.inert),'Background inert remained');
 });
 await check('newsletter-handoff',async()=>{
  await settings().click();const modal=page.getByRole('dialog',{name:'설정',exact:true});await modal.getByRole('navigation',{name:'설정 카테고리'}).getByRole('button',{name:'앱 정보',exact:true}).click();await modal.getByRole('button',{name:'보건소식지 제작소',exact:true}).click();
  await visible(page.getByRole('region',{name:'보건소식지 제작소',exact:true}));assert(!await page.evaluate(()=>document.activeElement===document.querySelector('[data-dock-item="settings"]')),'Hidden Dock regained focus');await capture('newsletter-handoff');await page.getByRole('button',{name:'보건 업무로',exact:true}).click();
 });
 for(const name of ['빠른 메모','업무 도구'])await check(name==='빠른 메모'?'memo-nonmodal':'tools-nonmodal',async()=>{
  await page.keyboard.press('Escape');await dock.getByRole('button',{name,exact:true}).click();const panel=page.getByRole('dialog',{name,exact:true});await visible(panel);assert(await panel.getAttribute('aria-modal')!=='true','Nonmodal aria-modal regression');assert(!await page.locator('#root').evaluate(el=>el.inert),'Nonmodal background inert');
  if(name==='빠른 메모'){
   const input=panel.getByLabel('빠른 메모 입력',{exact:true});await input.fill('INT-EL-05H 합성 메모');await panel.getByRole('button',{name:'메모 저장',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-memo-status]')?.textContent==='메모 저장됨');
   const data=await page.evaluate(()=>window.electronWork.memo.read());assert(data.ok&&data.data.text==='INT-EL-05H 합성 메모','Memo persisted read mismatch');
  }
  await capture(name==='빠른 메모'?'memo':'tools');
  await dock.getByRole('button',{name:'홈',exact:true}).click();await panel.waitFor({state:'detached'});await focus(dock.getByRole('button',{name:'홈',exact:true}));
  await dock.getByRole('button',{name,exact:true}).click();await page.keyboard.press('Escape');await panel.waitFor({state:'detached'});await focus(dock.getByRole('button',{name,exact:true}));
  if(name==='업무 도구'){await dock.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'품의 도우미 · 세션 전용'}).click();await visible(page.getByRole('heading',{name:'품의 도우미',exact:true}));await page.getByRole('button',{name:'품의 도우미 닫기'}).click();}
 });
}catch(e){report.connection=report.connection==='PASS'?'PASS':'BLOCKED';report.fatal=e.message;}
finally{
 report.verdict=report.fatal?'BLOCKED':report.checks.length===6&&report.checks.every(c=>c.status==='PASS')&&report.errors.length===0?'PASS':'CONDITIONAL';
 await writeFile(join(out,'ui-results.json'),JSON.stringify(report,null,2));
 console.log('::notice title=INT_EL05I_UI::'+JSON.stringify({connection:report.connection,verdict:report.verdict,fatal:report.fatal,checks:report.checks,errors:report.errors}));
 for(const image of report.images)console.log('::notice title=INT_EL05I_IMAGE::'+JSON.stringify(image));
 for(const width of [980,1440])console.log('::notice title=INT_EL05I_LAYOUT::'+JSON.stringify({width,native:report['native'+width],layout:report['layout'+width],scroll:report['scroll'+width],tasks:report['taskNames'+width]}));
 if(browser)await browser.close();
}
if(report.verdict!=='PASS')process.exitCode=1;
