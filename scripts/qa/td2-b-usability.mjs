import {ownedProcessIdentities} from './process-ownership.mjs';
import {execFileSync} from 'node:child_process';
export async function checkDockMemo({app,page,dock,snapshot,report,cases}){
 report.memoZoom??=[];
 const scenarios=cases??['normal','small','maximized'].flatMap(size=>[1,1.25,1.5].map(factor=>({size,factor})));
 for(const {size,factor} of scenarios){
  await app.evaluate(({BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.webContents.setZoomFactor(1);if(size==='maximized')w.maximize();else w.setContentSize(size==='small'?900:1280,size==='small'?680:800);},size);
  await dock.getByRole('button',{name:'빠른 메모',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'빠른 메모',exact:true});await dialog.waitFor();
  await dialog.getByRole('textbox').fill('합성 QA 메모 · 콘텐츠 확대에서 메모 입력·닫기 확인');
  await dialog.getByRole('textbox').focus();await page.keyboard.type(' · 키보드 입력');
  await dialog.getByRole('button',{name:'메모 저장',exact:true}).click();
  await app.evaluate(({BrowserWindow},v)=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(v),factor);
  await page.waitForTimeout(250);
  const last=dialog.getByRole('button',{name:'업무로 보내기',exact:true});await last.scrollIntoViewIfNeeded();
  const state=await page.evaluate(()=>{
   const h=document.querySelector('[data-dock-item="home"]'),d=document.querySelector('.dock-zone'),p=document.querySelector('.quick-memo-surface .rose-dialog'),body=p.querySelector('.rose-dialog-content');
   const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
   const r=h.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),last=[...p.querySelectorAll('button')].find(e=>e.textContent.includes('업무로 보내기')),end=last.getBoundingClientRect(),target=document.elementFromPoint(end.x+end.width/2,end.y+end.height/2);
   return{home:rect(h),dock:rect(d),popup:rect(p),homeHitTarget:h.contains(hit),homeInert:!!h.closest('[inert]'),lastActionAccessible:last.contains(target)&&end.bottom<=p.getBoundingClientRect().bottom+1,body:{clientHeight:body.clientHeight,scrollHeight:body.scrollHeight,overflowY:getComputedStyle(body).overflowY},viewport:{width:innerWidth,height:innerHeight}};
  });
  const name='memo-'+size+'-zoom'+factor*100;await snapshot(name+'-open');
  let homeClicked=false,error=null;
  try{await dock.getByRole('button',{name:'홈',exact:true}).click({timeout:2500});homeClicked=true;}catch(e){error=String(e).split('\n').slice(0,10).join('\n');}
  if(!await dialog.isVisible())await dock.getByRole('button',{name:'빠른 메모',exact:true}).click();
  await page.getByRole('button',{name:'빠른 메모 닫기',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await dock.getByRole('button',{name:'빠른 메모',exact:true}).click();await dialog.getByRole('textbox').focus();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  const passed=homeClicked&&state.homeHitTarget&&!state.homeInert&&state.popup.bottom<=state.dock.y&&state.lastActionAccessible;
  report.memoZoom.push({size,factor,kind:'Electron content zoom; not OS DPI',...state,homeClicked,homeClickError:error,closeButtonWorked:true,escapeClosed:true,verdict:passed?'PASS':'FAIL',escapeIsWorkaroundOnly:!homeClicked});await snapshot(name+'-closed');
 }
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.webContents.setZoomFactor(1);w.setContentSize(1280,800);});
 const home=dock.getByRole('button',{name:'홈',exact:true});await home.focus();await page.keyboard.press('Tab');
 report.checks.push({dockKeyboard:{tabFocusInsideDock:await dock.evaluate(e=>e.contains(document.activeElement)),focusedLabel:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))}});
 await snapshot(cases?'custom-dock-keyboard-focus':'dock-keyboard-focus');
}
export async function checkLastItems({page,snapshot,report}){
 const candidates=page.locator('.desktop-widget-grid [data-widget-type]');const rows=[];
 for(let i=0;i<await candidates.count();i++){
  const widget=candidates.nth(i),type=await widget.getAttribute('data-widget-type');
  const scrolls=await widget.locator('*').evaluateAll(xs=>xs.map((e,i)=>({i,yes:e.clientHeight>0&&e.scrollHeight>e.clientHeight+2&&['auto','scroll'].includes(getComputedStyle(e).overflowY)})).filter(x=>x.yes).map(x=>x.i));
  for(const index of scrolls){const container=widget.locator('*').nth(index);await container.scrollIntoViewIfNeeded();await container.hover();await page.mouse.wheel(0,3000);await page.waitForTimeout(80);rows.push(await container.evaluate(e=>{const last=e.lastElementChild,r=e.getBoundingClientRect(),b=last?.getBoundingClientRect();return{class:e.className,atBottom:e.scrollTop+e.clientHeight>=e.scrollHeight-2,lastChildWithinViewport:!!b&&b.bottom<=r.bottom+2};}).then(x=>({type,...x})));}
 }
 report.checks.push({smallWidgetScrollLastItems:rows,scope:'Rendered scroll containers only; disconnected meal ready data NOT RUN'});await snapshot('small-widgets-last-items');
}
export function processTracker(){
 const identities=new Map();
 const ps=code=>JSON.parse(execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8',timeout:20000}).trim()||'[]');
 return{
  capture(root){const rows=ps(`@(Get-CimInstance Win32_Process|Select-Object ProcessId,ParentProcessId,CreationDate)|ConvertTo-Json -Compress`);for(const r of ownedProcessIdentities(Array.isArray(rows)?rows:[rows],root))identities.set(r.ProcessId,r.CreationDate);},
  async verify(){let remaining=[];for(let i=0;i<5;i++){const rows=ps(`@(Get-CimInstance Win32_Process|Where-Object{$_.ProcessId -in @(${[...identities.keys()].join(',')||0})}|Select-Object ProcessId,CreationDate)|ConvertTo-Json -Compress`);remaining=(Array.isArray(rows)?rows:[rows]).filter(r=>identities.get(r.ProcessId)===r.CreationDate);if(!remaining.length)break;await new Promise(r=>setTimeout(r,500));}return{tracked:identities.size,remaining,zeroResidual:remaining.length===0,scope:'Only captured PID + creation time; descendant birth must be >= live parent birth to reject PID reuse; no unrelated process termination'};}
 };
}
