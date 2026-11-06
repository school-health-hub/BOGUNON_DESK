import {execFileSync} from 'node:child_process';
export async function checkDockMemo({app,page,dock,snapshot,report}){
 report.memoZoom=[];
 for(const factor of [1.25,1.5]){
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.webContents.setZoomFactor(1);w.setContentSize(1280,800);});
  await dock.getByRole('button',{name:'빠른 메모',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'빠른 메모',exact:true});
  await dialog.waitFor();
  await dialog.getByRole('textbox').fill('합성 QA 메모 · 콘텐츠 확대에서 메모 입력·닫기 확인');
  await dialog.getByRole('button',{name:'메모 저장',exact:true}).click();
  await app.evaluate(({BrowserWindow},v)=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(v),factor);
  await page.waitForTimeout(250);
  const state=await page.evaluate(()=>{
   const h=document.querySelector('[data-dock-item="home"]'),d=document.querySelector('.dock-zone'),p=[...document.querySelectorAll('[role="dialog"]')].find(e=>e.textContent.includes('빠른 메모'));
   const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
   const r=h.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   return{home:rect(h),dock:rect(d),popup:rect(p),homeHit:hit?.className,homeHitTarget:h.contains(hit),homeInert:!!h.closest('[inert]'),viewport:{width:innerWidth,height:innerHeight}};
  });
  await snapshot('memo-zoom'+factor*100+'-open');
  let homeClicked=false,error=null;
  try{await dock.getByRole('button',{name:'홈',exact:true}).click({timeout:1800});homeClicked=true;}catch(e){error=String(e).split('\n').slice(0,10).join('\n');}
  const remained=await dialog.isVisible();
  if(remained)await dialog.getByRole('button',{name:'빠른 메모 닫기',exact:true}).click();
  await page.getByRole('dialog',{name:'빠른 메모',exact:true}).waitFor({state:'hidden'});
  await dock.getByRole('button',{name:'빠른 메모',exact:true}).click();
  await page.keyboard.press('Escape');
  const escapeClosed=await page.getByRole('dialog',{name:'빠른 메모',exact:true}).count()===0;
  const result={factor,kind:'Electron content zoom; not OS DPI',...state,homeClicked,homeClickError:error,closeButtonWorked:remained,escapeClosed,verdict:homeClicked?'PASS':'FAIL',escapeIsWorkaroundOnly:!homeClicked};
  report.memoZoom.push(result);await snapshot('memo-zoom'+factor*100+'-closed');
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1));
 const home=dock.getByRole('button',{name:'홈',exact:true});await home.focus();await page.keyboard.press('Tab');
 report.checks.push({dockKeyboard:{tabFocusInsideDock:await dock.evaluate(e=>e.contains(document.activeElement)),focusedLabel:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))}});
 await snapshot('dock-keyboard-focus');
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
  capture(root){const rows=ps(`$all=@(Get-CimInstance Win32_Process);$owned=@(${Number(root)});do{$new=@($all|Where-Object{$_.ParentProcessId -in $owned -and $_.ProcessId -notin $owned}|ForEach-Object ProcessId);$owned+=$new}while($new.Count);@($all|Where-Object{$_.ProcessId -in $owned}|Select-Object ProcessId,CreationDate)|ConvertTo-Json -Compress`);for(const r of Array.isArray(rows)?rows:[rows])identities.set(r.ProcessId,r.CreationDate);},
  async verify(){let remaining=[];for(let i=0;i<5;i++){const rows=ps(`@(Get-CimInstance Win32_Process|Where-Object{$_.ProcessId -in @(${[...identities.keys()].join(',')||0})}|Select-Object ProcessId,CreationDate)|ConvertTo-Json -Compress`);remaining=(Array.isArray(rows)?rows:[rows]).filter(r=>identities.get(r.ProcessId)===r.CreationDate);if(!remaining.length)break;await new Promise(r=>setTimeout(r,500));}return{tracked:identities.size,remaining,zeroResidual:remaining.length===0,scope:'Only captured PID and creation-time identities of this QA Electron tree; no unrelated process termination'};}
 };
}
