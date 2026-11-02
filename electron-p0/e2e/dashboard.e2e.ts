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
  expect(await page.evaluate(()=>({keys:Object.keys(window.electronWork),sample:Object.keys(window.electronWork.sample)}))).toEqual({keys:['inventory','educationVideo','purchase','sample','newsletter','memo'],sample:['summarize']});
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
