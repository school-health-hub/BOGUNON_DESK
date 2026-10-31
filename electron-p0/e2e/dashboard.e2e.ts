import { test,expect,_electron as electron, type ElectronApplication } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
const appRoot=join(process.cwd(),'build/electron-p0-app');
const launch=(id:string)=>electron.launch({chromiumSandbox:true,...(process.env.ELECTRON_P0_EXECUTABLE?{executablePath:process.env.ELECTRON_P0_EXECUTABLE}:{}),args:process.env.ELECTRON_P0_EXECUTABLE?[]:[appRoot],env:{...process.env,ELECTRON_P0_TEST_RUN:id,ELECTRON_P0_DEV_URL:''}});
test('real Electron: secure bridge, original dashboard/dock, navigation, edit and restart',async()=>{
 const id=randomUUID();let app:ElectronApplication=await launch(id);
 try{
  let page=await app.firstWindow();
  await expect(page.getByRole('navigation',{name:'주요 기능'})).toBeVisible();
  await expect(page.locator('[data-widget-type="clock"]')).toBeVisible();
  await expect(page.locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');
  expect(await page.evaluate(()=>({keys:Object.keys(window.electronP0),node:typeof (window as unknown as {require:unknown}).require}))).toEqual({keys:['info','readSettings','writeSettings'],node:'undefined'});
  const info=await page.evaluate(()=>window.electronP0.info());expect(info.appId).toBe('kr.sungandi.schoolhealthdesk.electronp0');expect(info.userData).toContain(id);
  await page.getByRole('button',{name:'설정',exact:true}).click();await expect(page.getByRole('heading',{name:'PoC 설정'})).toBeVisible();
  await page.getByRole('button',{name:'홈으로'}).click();await page.getByRole('button',{name:'빠른 메모',exact:true}).click();await expect(page.getByRole('dialog',{name:'빠른 메모'})).toBeVisible();await page.getByRole('button',{name:'홈으로'}).click();
  await page.getByRole('button',{name:'BOGUNON',exact:true}).click();await expect(page.getByText('이 기능은 ELECTRON-P0 범위에 포함되지 않습니다.',{exact:false})).toBeVisible();await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'화면 꾸미기',exact:true}).click();
  const before=await page.evaluate(()=>window.electronP0.readSettings());
  const drag=page.getByRole('button',{name:'날짜·시계 이동',exact:true});const box=await drag.boundingBox();if(!box)throw Error('No drag handle');
  await page.mouse.move(box.x+8,box.y+8);await page.mouse.down();await page.mouse.move(box.x+140,box.y+85,{steps:20});await page.mouse.up();
  await expect.poll(async()=>JSON.stringify((await page.evaluate(()=>window.electronP0.readSettings()))?.dashboard)).not.toBe(JSON.stringify(before?.dashboard));
  const resize=page.locator('[data-widget-type="clock"] .react-resizable-handle');const r=await resize.boundingBox();if(!r)throw Error('No resize handle');await page.mouse.move(r.x+4,r.y+4);await page.mouse.down();await page.mouse.move(r.x+95,r.y+60,{steps:15});await page.mouse.up();
  await page.getByRole('button',{name:'날짜·시계 숨기기',exact:true}).click();await expect(page.locator('[data-widget-type="clock"]')).toHaveCount(0);
  await page.getByRole('button',{name:'스타일',exact:true}).click();await page.getByRole('button',{name:'민트',exact:true}).click();
  await page.getByRole('button',{name:'완료',exact:true}).click();await expect(page.locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');
  const saved=await page.evaluate(()=>window.electronP0.readSettings());
  const rejected=await page.evaluate(async()=>{try{await window.electronP0.writeSettings({version:1,dashboard:null,dock:null});return false}catch{return true}});expect(rejected).toBe(true);expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(saved);
  await app.close();app=await launch(id);page=await app.firstWindow();await expect(page.locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');
  expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(saved);await expect(page.locator('[data-widget-type="clock"]')).toHaveCount(0);await expect(page.locator('.workspace-shell')).toHaveClass(/bg-mint/);
  await page.screenshot({path:'artifacts/electron-p0-e2e/dashboard-restarted.png',fullPage:true});
  await page.evaluate(()=>window.open('https://example.invalid'));expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(1);
 }finally{await app.close();}
});
