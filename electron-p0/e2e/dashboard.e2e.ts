import {observeStartup} from './startup-diagnostics';
import { test,expect,_electron as electron, type ElectronApplication } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
const appRoot=join(process.cwd(),'build/electron-p0-app');
const launch=(id:string)=>electron.launch({chromiumSandbox:true,timeout:20000,...(process.env.ELECTRON_P0_EXECUTABLE?{executablePath:process.env.ELECTRON_P0_EXECUTABLE}:{}),args:process.env.ELECTRON_P0_EXECUTABLE?[]:[appRoot],env:{...process.env,ELECTRON_P0_TEST_RUN:id,ELECTRON_P0_DEV_URL:''}});
test('real Electron: secure bridge, original dashboard/dock, navigation, edit and restart',async()=>{
 let closed=false;const id=randomUUID();let app:ElectronApplication=await launch(id);
 try{
  console.log('P0: Electron connected');
  let page=await app.firstWindow({timeout:10000});const diagnose=observeStartup(page); console.log('P0: renderer window found');
  try{await expect(page.getByRole('navigation',{name:'주요 기능'})).toBeVisible();}catch(error){
   console.log('P1B_DIAGNOSTIC '+JSON.stringify(await diagnose(app)));throw error;
  }
  await expect(page.locator('[data-widget-type="clock"]')).toBeVisible();
  await expect(page.locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');console.log('P0: dashboard and settings ready');await page.screenshot({path:'artifacts/electron-p0-e2e/dashboard-initial.png'});
  expect(await page.evaluate(()=>({keys:Object.keys(window.electronP0),node:typeof (window as unknown as {require:unknown}).require}))).toEqual({keys:['info','readSettings','writeSettings'],node:'undefined'});
  const info=await page.evaluate(()=>window.electronP0.info());expect(info.appId).toBe('kr.sungandi.schoolhealthdesk.electronp0');expect(info.userData).toContain(id);
  await page.getByRole('button',{name:'설정',exact:true}).click();await expect(page.getByRole('heading',{name:'PoC 설정'})).toBeVisible();
  const beforeSample=await page.evaluate(()=>window.electronP0.readSettings());
  expect(await page.evaluate(()=>({keys:Object.keys(window.electronWork),sample:Object.keys(window.electronWork.sample)}))).toEqual({keys:['officialDocument','inventory','educationVideo','purchase','sample','newsletter','memo'],sample:['summarize']});
  await page.getByRole('button',{name:'합성 IPC 확인',exact:true}).click();
  await expect(page.getByText('합성 항목 3개 중 1개 완료',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.electronWork.sample.summarize({fixture:'synthetic-only',completed:['prepare','prepare']} as never))).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
  expect(await page.evaluate(()=>window.electronWork.sample.summarize({fixture:'synthetic-only',completed:[],path:'C:/synthetic'} as never))).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
  expect(await page.evaluate(()=>window.electronWork.sample.summarize({fixture:'synthetic-only',completed:Array(1)}))).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
  expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(beforeSample);

  await page.getByRole('button',{name:'홈으로'}).click();await page.getByRole('button',{name:'빠른 메모',exact:true}).click();await expect(page.getByRole('dialog',{name:'빠른 메모'})).toBeVisible();
  const memoPanel=page.getByRole('dialog',{name:'빠른 메모'});
  await memoPanel.getByLabel('빠른 메모 입력',{exact:true}).fill('합성 메모 생성');
  await memoPanel.getByRole('button',{name:'메모 저장',exact:true}).click();
  await expect(memoPanel.locator('[data-memo-status]')).toHaveText('메모 저장됨');
  await memoPanel.getByLabel('빠른 메모 입력',{exact:true}).fill('합성 메모 수정 — 재실행 확인');
  await memoPanel.getByRole('button',{name:'메모 저장',exact:true}).click();
  await expect(memoPanel.locator('[data-memo-status]')).toHaveText('메모 저장됨');
  expect(await page.evaluate(()=>window.electronWork.memo.write({version:1,text:'x'.repeat(8001)}))).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
  expect(await page.evaluate(()=>window.electronWork.memo.read())).toEqual({ok:true,data:{version:1,text:'합성 메모 수정 — 재실행 확인'}});
await page.getByRole('button',{name:'홈으로'}).click();
  await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:'BOGUNON',exact:true}).click();await expect(page.getByText('이 기능은 ELECTRON-P0 범위에 포함되지 않습니다.',{exact:false})).toBeVisible();await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'화면 꾸미기',exact:true}).click();
  await page.screenshot({path:'artifacts/electron-p0-e2e/dashboard-edit.png'});
  const before=await page.evaluate(()=>window.electronP0.readSettings());
  const drag=page.getByRole('button',{name:'날짜·시계 이동',exact:true});const box=await drag.boundingBox();if(!box)throw Error('No drag handle');
  await page.mouse.move(box.x+8,box.y+8);await page.mouse.down();await page.mouse.move(box.x+140,box.y+85,{steps:20});await page.mouse.up();
  await expect.poll(async()=>JSON.stringify((await page.evaluate(()=>window.electronP0.readSettings()))?.dashboard)).not.toBe(JSON.stringify(before?.dashboard));
  const beforeResize=await page.evaluate(async()=>{const d=(await window.electronP0.readSettings())!.dashboard as {widgets:{id:string;w:number;h:number}[]};const w=d.widgets.find(w=>w.id==='widget-clock')!;return {w:w.w,h:w.h}});
  const resize=page.locator('[data-widget-type="clock"] .react-resizable-handle');await resize.hover();const r=await resize.boundingBox();if(!r)throw Error('No resize handle');const rx=r.x+r.width/2,ry=r.y+r.height/2;await page.mouse.move(rx,ry);await page.mouse.down();await page.mouse.move(rx+140,ry+85,{steps:20});await page.mouse.up();
  await expect.poll(()=>page.evaluate(async()=>{const d=(await window.electronP0.readSettings())!.dashboard as {widgets:{id:string;w:number;h:number}[]};const w=d.widgets.find(w=>w.id==='widget-clock')!;return {w:w.w,h:w.h}})).not.toEqual(beforeResize);
  await page.getByRole('button',{name:'날짜·시계 숨기기',exact:true}).click();await expect(page.locator('[data-widget-type="clock"]')).toHaveCount(0);
  await page.getByRole('button',{name:'스타일',exact:true}).click();await page.getByRole('button',{name:'민트',exact:true}).click();
  await page.getByRole('button',{name:'Dock',exact:true}).click();
  await page.getByRole('complementary',{name:'Dock 편집'}).locator('article').filter({hasText:'온라인 보건실'}).getByRole('checkbox').uncheck();
  await page.getByRole('button',{name:'완료',exact:true}).click();await expect(page.locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');
  const saved=await page.evaluate(()=>window.electronP0.readSettings());
  const rejected=await page.evaluate(async()=>{try{await window.electronP0.writeSettings({version:1,dashboard:null,dock:null});return false}catch{return true}});expect(rejected).toBe(true);expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(saved);expect(await page.evaluate(()=>window.electronWork.memo.read())).toEqual({ok:true,data:{version:1,text:'합성 메모 수정 — 재실행 확인'}});
  await app.close();app=await launch(id);page=await app.firstWindow();await expect(page.locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');
  expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(saved);expect(await page.evaluate(()=>window.electronWork.memo.read())).toEqual({ok:true,data:{version:1,text:'합성 메모 수정 — 재실행 확인'}});await expect(page.locator('[data-widget-type="clock"]')).toHaveCount(0);await expect(page.locator('.workspace-shell')).toHaveClass(/bg-mint/);await expect(page.locator('[data-dock-item="online-health-room"]')).toHaveCount(0);
  await page.getByRole('button',{name:'빠른 메모',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'빠른 메모'}).getByLabel('빠른 메모 입력',{exact:true})).toHaveValue('합성 메모 수정 — 재실행 확인');
  await page.getByRole('button',{name:'홈으로'}).click();
  await page.screenshot({path:'artifacts/electron-p0-e2e/dashboard-restarted.png',fullPage:true});
  await page.evaluate(()=>window.open('https://example.invalid'));expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(1);

  await app.evaluate(({BrowserWindow,screen})=>{const a=screen.getPrimaryDisplay().workArea;BrowserWindow.getAllWindows()[0].setBounds({x:a.x+20,y:a.y+20,width:Math.min(1100,a.width-40),height:Math.min(760,a.height-40)});});
  if(process.platform==='win32'){
   await app.evaluate(({Menu,BrowserWindow})=>{const item=Menu.getApplicationMenu()!.items[0].submenu!.items[1];item.click(item,BrowserWindow.getAllWindows()[0],{} as never);});
   await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized())).toBe(true);
   await app.evaluate(({Menu,BrowserWindow})=>{const item=Menu.getApplicationMenu()!.items[0].submenu!.items[0];item.click(item,BrowserWindow.getAllWindows()[0],{} as never);});
   await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized())).toBe(false);
  }
  const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getNormalBounds());
  // Drive native menu callbacks through Electron's main-process test connection, not renderer IPC.
  await app.evaluate(({Menu,BrowserWindow})=>{const item=Menu.getApplicationMenu()!.items[0].submenu!.items[2];item.click(item,BrowserWindow.getAllWindows()[0],{} as never);});
  await expect.poll(()=>app.evaluate(({Menu})=>Menu.getApplicationMenu()!.items[0].submenu!.items[2].checked)).toBe(true);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
  await app.evaluate(({Menu,BrowserWindow})=>{const item=Menu.getApplicationMenu()!.items[0].submenu!.items[0];item.click(item,BrowserWindow.getAllWindows()[0],{} as never);});
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(true);
  await app.close();app=await launch(id);await app.firstWindow();await expect((await app.firstWindow()).locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');
  expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getNormalBounds())).toEqual(bounds);
  expect(await app.evaluate(({Menu})=>Menu.getApplicationMenu()!.items[0].submenu!.items[2].checked)).toBe(true);
  await app.evaluate(({Menu,BrowserWindow})=>{const item=Menu.getApplicationMenu()!.items[0].submenu!.items[2];item.click(item,BrowserWindow.getAllWindows()[0],{} as never);});
  await expect.poll(()=>app.evaluate(({Menu})=>Menu.getApplicationMenu()!.items[0].submenu!.items[2].checked)).toBe(false);
  const child=app.process();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  await expect.poll(()=>child.exitCode).toBe(0);closed=true;
 }finally{if(!closed)await app.close();}
});

test('CLOUD-G0: one isolated Electron instance opens every integrated entry',async()=>{
 const id=randomUUID(),app=await launch(id),checked:string[]=[],errors:string[]=[];
 try{
  const page=await app.firstWindow({timeout:10000});page.on('pageerror',error=>errors.push(error.name));
  const dock=page.getByRole('navigation',{name:'주요 기능'});
  const home=page.getByRole('main',{name:'보건실 업무 위젯 작업 공간'});
  await expect(home).toBeVisible();checked.push('Dashboard');await expect(dock).toBeVisible();checked.push('Dock');
  expect((await page.evaluate(()=>window.electronP0.info())).userData).toContain(id);
  expect(await app.evaluate(({app})=>app.commandLine.hasSwitch('no-sandbox'))).toBe(false);
  expect(await page.evaluate(()=>typeof (window as unknown as {require:unknown}).require)).toBe('undefined');
  expect(await page.evaluate(()=>Object.keys(window.electronWork).sort())).toEqual(['educationVideo','inventory','memo','newsletter','officialDocument','purchase','sample']);
  await dock.getByRole('button',{name:'빠른 메모',exact:true}).click();await expect(page.getByRole('dialog',{name:'빠른 메모'})).toBeVisible();checked.push('Quick Memo');await page.getByRole('button',{name:'홈으로'}).click();
  const tools=async()=>{await dock.getByRole('button',{name:'업무 도구',exact:true}).click();};
  await tools();await page.getByRole('button',{name:'품의 도우미 · 세션 전용'}).click();await expect(page.getByRole('heading',{name:'품의 도우미',exact:true})).toBeVisible();checked.push('Purchase');
  await app.evaluate(({dialog},file)=>{const original=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=original;return {canceled:false,filePaths:[file]};};},join(process.cwd(),'tools/purchase-excel-cli/target/qa-fixtures/win-qa04.pdf'));
  await page.getByLabel('가져오기 형식',{exact:true}).selectOption('pdf');await page.getByRole('button',{name:'PDF 가져오기',exact:true}).click();
  await page.getByRole('button',{name:'PDF 품목 적용',exact:true}).click();await expect(page.getByText('4개 선택 · 23,500원',{exact:true})).toBeVisible();await expect(page.getByLabel('5행 품명',{exact:true})).toHaveCount(0);
  console.log('CLOUD_G1_PURCHASE_PDF '+JSON.stringify({synthetic:true,items:4,total:23500,nativeDialog:'test double',parser:'existing 03e31e2'}));
  await page.getByRole('button',{name:'품의 도우미 닫기'}).click();
  await tools();await page.getByRole('button',{name:'교육영상 Finder · 합성 Mock'}).click();await expect(page.getByRole('heading',{name:/AI 교육영상 Finder/})).toBeVisible();checked.push('Finder');await page.getByRole('button',{name:'보건 업무로',exact:true}).click();
  await tools();await page.getByRole('button',{name:'공문작업실 · 로컬 초안'}).click();await expect(page.getByRole('heading',{name:'공문작업실',exact:true})).toBeVisible();checked.push('공문작업실');await page.getByRole('button',{name:'보건 업무로',exact:true}).click();
  await tools();await page.getByRole('button',{name:'물품관리 — 로컬 저장'}).click();await expect(page.getByRole('heading',{name:'재고 관리',exact:true})).toBeVisible();checked.push('Inventory');await page.getByRole('button',{name:'대시보드로',exact:true}).click();
  await dock.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('button',{name:'보건소식지 제작소',exact:true}).click();await expect(page.getByRole('heading',{name:'보건소식지 제작소',exact:true})).toBeVisible();checked.push('Newsletter');await page.getByRole('button',{name:'보건 업무로',exact:true}).click();
  await expect(home).toBeVisible();await expect(dock).toBeVisible();expect(errors).toEqual([]);expect(checked).toHaveLength(8);
  await page.getByRole('button',{name:'화면 꾸미기',exact:true}).click();await page.getByRole('button',{name:'Dock',exact:true}).click();
  await page.getByLabel('Dock 편집',{exact:true}).locator('article').filter({hasText:'공문 작업실'}).getByRole('checkbox').check();
  await page.getByRole('button',{name:'Dock 편집 닫기',exact:true}).click();
  await dock.getByRole('button',{name:'공문 작업실',exact:true}).click();await expect(page.getByRole('heading',{name:'공문작업실',exact:true})).toBeVisible();
  await expect(page.getByText('이 기능은 ELECTRON-P0 범위에 포함되지 않습니다.',{exact:false})).toHaveCount(0);
  await page.getByRole('button',{name:'보건 업무로',exact:true}).click();await expect(home).toBeVisible();
  console.log('CLOUD_G0_ENTRIES '+JSON.stringify({checked,profile:'UUID-isolated',security:'sandboxed',officialDocumentFileQa:'REUSED: Windows PC PASS per user; not repeated'}));
  await page.screenshot({path:'artifacts/electron-p0-e2e/cloud-g0-entries.png'});
 }finally{await app.close();}
});

test('INT-EL-04F: 980x700 dashboard and settings keyboard contract',async()=>{
 const id=randomUUID(),app=await launch(id);
 try{
  const page=await app.firstWindow({timeout:10000});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({x:40,y:40,width:980,height:700}));
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>{const {width,height}=BrowserWindow.getAllWindows()[0].getBounds();return {width,height};})).toEqual({width:980,height:700});
  const dashboard=page.getByRole('main',{name:'보건실 업무 위젯 작업 공간'}),dock=page.locator('.dock-zone');
  await expect(dashboard).toBeVisible();await expect(dock).toBeVisible();
  const compact=await page.evaluate(()=>{
   const dashboard=document.querySelector<HTMLElement>('.workspace-dashboard')!,dock=document.querySelector<HTMLElement>('.dock-zone')!;
   const label=document.querySelector<HTMLElement>('.quick-launcher__actions > button > span:nth-child(2)');
   const dashboardRect=dashboard.getBoundingClientRect(),dockRect=dock.getBoundingClientRect();
   return {dockPosition:getComputedStyle(dock).position,dashboardOverflow:getComputedStyle(dashboard).overflowY,dashboardBottom:dashboardRect.bottom,dockTop:dockRect.top,scrollHeight:dashboard.scrollHeight,clientHeight:dashboard.clientHeight,labelWhiteSpace:label?getComputedStyle(label).whiteSpace:null,labelWordBreak:label?getComputedStyle(label).wordBreak:null};
  });
  expect(compact.dockPosition).toBe('static');expect(compact.dashboardOverflow).toBe('auto');
  expect(compact.dashboardBottom).toBeLessThanOrEqual(compact.dockTop);expect(compact.scrollHeight).toBeGreaterThan(compact.clientHeight);
  if(compact.labelWhiteSpace!==null){expect(compact.labelWhiteSpace).toBe('normal');expect(compact.labelWordBreak).toBe('keep-all');}
  const clockGeometry=await page.locator('[data-widget-type="clock"] .date-card').evaluate(element=>{const time=element.querySelector<HTMLElement>('.date-card__time')!,icon=time.querySelector<SVGElement>('svg');return {overflowX:getComputedStyle(element).overflowX,fontSize:getComputedStyle(time).fontSize,iconDisplay:icon?getComputedStyle(icon).display:null,timeClientWidth:time.clientWidth,timeScrollWidth:time.scrollWidth,text:time.textContent?.trim()};});console.log('INT_EL_04F_CLOCK '+JSON.stringify(clockGeometry));
  expect(clockGeometry.overflowX).toBe('hidden');expect(clockGeometry.timeScrollWidth).toBeLessThanOrEqual(clockGeometry.timeClientWidth);expect(clockGeometry.text).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  await page.screenshot({path:'artifacts/electron-p0-e2e/int-el-04f-980x700.png'});
  const reachedBottom=await dashboard.evaluate(element=>{element.scrollTop=element.scrollHeight;return element.scrollTop+element.clientHeight>=element.scrollHeight-1;});expect(reachedBottom).toBe(true);
  const memoGeometry=await page.locator('[data-widget-type="quick-memo"] .panel').evaluate(element=>{const textarea=element.querySelector<HTMLTextAreaElement>('textarea')!,fieldset=element.querySelector<HTMLFieldSetElement>('fieldset')!;return {surfaceClientWidth:element.clientWidth,surfaceScrollWidth:element.scrollWidth,fieldsetClientWidth:fieldset.clientWidth,fieldsetScrollWidth:fieldset.scrollWidth,fieldsetOverflowX:getComputedStyle(fieldset).overflowX,fieldsetParent:fieldset.parentElement?.className,fieldsetMatches:fieldset.matches('.workspace-shell.is-view-mode [data-widget-type="quick-memo"] fieldset'),compactMedia:matchMedia('(max-height: 720px) and (min-width: 821px)').matches,textareaClientWidth:textarea.clientWidth,textareaScrollWidth:textarea.scrollWidth,textareaOverflowX:getComputedStyle(textarea).overflowX};});
  const memoOverflow=await page.locator('[data-widget-type="quick-memo"]').evaluate(root=>Array.from(root.querySelectorAll<HTMLElement>('*')).map(element=>({tag:element.tagName,className:element.className,clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,overflowX:getComputedStyle(element).overflowX})).filter(item=>item.scrollWidth>item.clientWidth||item.overflowX==='auto'||item.overflowX==='scroll'));
  console.log('INT_EL_04F_MEMO '+JSON.stringify({memoGeometry,memoOverflow}));
  expect(memoGeometry.fieldsetOverflowX).toBe('hidden');expect(memoGeometry.fieldsetScrollWidth).toBeLessThanOrEqual(memoGeometry.fieldsetClientWidth);expect(memoGeometry.textareaOverflowX).toBe('hidden');expect(memoGeometry.textareaScrollWidth).toBeLessThanOrEqual(memoGeometry.textareaClientWidth);expect(memoGeometry.surfaceScrollWidth).toBeLessThanOrEqual(memoGeometry.surfaceClientWidth);
  const quickLaunch=page.locator('[data-widget-type="quick-launcher"]'),onlineHealth=quickLaunch.getByRole('button',{name:'온라인 보건실',exact:true});await onlineHealth.scrollIntoViewIfNeeded();await expect(onlineHealth).toBeVisible();
  const labelGeometry=await onlineHealth.locator('span').nth(1).evaluate(element=>({clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,textOverflow:getComputedStyle(element).textOverflow}));
  expect(labelGeometry.scrollWidth).toBeLessThanOrEqual(labelGeometry.clientWidth);expect(labelGeometry.textOverflow).toBe('clip');
  await onlineHealth.click();await expect(page.getByText('이 기능은 ELECTRON-P0 범위에 포함되지 않습니다.',{exact:false})).toBeVisible();await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.screenshot({path:'artifacts/electron-p0-e2e/int-el-04f-980x700-lower-controls.png'});

  const settingsLauncher=page.getByRole('button',{name:'설정',exact:true});await settingsLauncher.focus();await settingsLauncher.click();
  const dialog=page.getByRole('dialog',{name:'PoC 설정'});await expect(dialog).toBeVisible();
  await expect(page.locator('.p0-dashboard-background')).toHaveAttribute('inert','');await expect(page.locator('.p0-dashboard-background')).toHaveAttribute('aria-hidden','true');
  await expect(dialog.getByRole('button',{name:'홈으로'})).toBeFocused();
  await page.locator('[data-dock-item="settings"]').evaluate(element=>(element as HTMLButtonElement).focus());await expect(dialog.getByRole('button',{name:'홈으로'})).toBeFocused();
  await page.screenshot({path:'artifacts/electron-p0-e2e/int-el-04f-settings-focus.png'});
  await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'합성 IPC 확인'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'홈으로'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(settingsLauncher).toBeFocused();

  await settingsLauncher.click();await page.getByRole('dialog',{name:'PoC 설정'}).getByRole('button',{name:'보건소식지 제작소'}).click();
  await expect(page.getByRole('heading',{name:'보건소식지 제작소'})).toBeVisible();expect(await page.evaluate(()=>document.activeElement?.getAttribute('data-dock-item'))).not.toBe('settings');
  await page.getByRole('button',{name:'보건 업무로'}).click();
  for(const [dockName,dialogName] of [['빠른 메모','빠른 메모'],['업무 도구','업무 도구']] as const){
   await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:dockName,exact:true}).click();
   const legacyDialog=page.getByRole('dialog',{name:dialogName});await expect(legacyDialog).not.toHaveAttribute('aria-modal','true');await expect(page.locator('.p0-dashboard-background')).not.toHaveAttribute('inert','');
   await page.locator('[data-dock-item="home"]').evaluate(element=>(element as HTMLButtonElement).focus());await expect(page.locator('[data-dock-item="home"]')).toBeFocused();await legacyDialog.getByRole('button',{name:'홈으로'}).click();
  }

  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({x:40,y:40,width:1440,height:900}));
  await expect.poll(()=>app.evaluate(({BrowserWindow})=>{const {width,height}=BrowserWindow.getAllWindows()[0].getBounds();return {width,height};})).toEqual({width:1440,height:900});
  expect(await page.evaluate(()=>getComputedStyle(document.querySelector<HTMLElement>('.dock-zone')!).position)).toBe('fixed');
  const wideClock=await page.locator('[data-widget-type="clock"] .date-card').evaluate(element=>{const time=element.querySelector<HTMLElement>('.date-card__time')!,date=element.querySelector<HTMLElement>('.date-card__date')!;return {overflowX:getComputedStyle(element).overflowX,timeClientWidth:time.clientWidth,timeScrollWidth:time.scrollWidth,timeText:time.textContent?.trim(),dateClientWidth:date.clientWidth,dateScrollWidth:date.scrollWidth};});
  expect(wideClock.overflowX).toBe('hidden');expect(wideClock.timeScrollWidth).toBeLessThanOrEqual(wideClock.timeClientWidth);expect(wideClock.timeText).toMatch(/^\d{2}:\d{2}:\d{2}$/);expect(wideClock.dateScrollWidth).toBeLessThanOrEqual(wideClock.dateClientWidth);
  await page.screenshot({path:'artifacts/electron-p0-e2e/int-el-04f-1440x900.png'});
 }finally{await app.close();}
});
