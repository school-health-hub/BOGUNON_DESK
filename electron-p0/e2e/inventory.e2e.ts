import {test,expect,_electron as electron,type ElectronApplication} from '@playwright/test';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';

test('opens Inventory and restores an isolated synthetic movement',async()=>{
 test.setTimeout(180000);
 const profileId=randomUUID(),executablePath=process.env.ELECTRON_P0_EXECUTABLE;
 const qaRoot=process.env.ELECTRON_P0_QA_ROOT;
 if(qaRoot){
  const settings=join(qaRoot,'test-runs',profileId,'user-data','poc-settings');
  await mkdir(settings,{recursive:true});
  await writeFile(join(settings,'desktop-surface.json'),JSON.stringify({version:2,mode:'window',profiles:{},dockProfileKey:null}),{flag:'wx'});
 }
 const launch=()=>electron.launch({chromiumSandbox:true,timeout:90000,
  ...(executablePath?{executablePath}:{}),args:executablePath?[]:[join(process.cwd(),'build/electron-p0-app')],
  env:{...process.env,ELECTRON_P0_TEST_RUN:profileId,ELECTRON_P0_DEV_URL:''}});
 const openInventory=async(app:ElectronApplication)=>{
  await expect.poll(()=>app.windows().some(page=>page.url().endsWith('/renderer/index.html')),{timeout:30000}).toBe(true);
  const palette=app.windows().find(page=>page.url().includes('/renderer/palette/'));
  if(palette){await palette.waitForFunction(()=>typeof window.electronPalette?.openWorkspace==='function');await palette.evaluate(()=>window.electronPalette.openWorkspace());}
  const page=app.windows().find(page=>page.url().endsWith('/renderer/index.html'));
  if(!page)throw Error('The owned Inventory Workspace window is missing');
  page.on('dialog',async dialog=>{if(dialog.type()==='confirm'&&/물품|입고/.test(dialog.message()))await dialog.accept();else await dialog.dismiss();});
  const onboarding=page.getByRole('button',{name:'나중에 설정',exact:true});
  await page.addLocatorHandler(onboarding,()=>onboarding.click());
  await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:'업무 도구',exact:true}).click();
  await page.getByRole('button',{name:'물품관리',exact:true}).click();
  await expect(page.getByRole('heading',{name:'재고 관리',exact:true})).toBeVisible();
  return page;
 };
 let app=await launch();
 try{
  const page=await openInventory(app);
  await expect(page.locator('.inventory-status')).toContainText('등록된 물품이 없습니다.');
  await page.getByRole('button',{name:'물품 등록',exact:true}).click();
  await page.getByLabel('물품명',{exact:true}).fill('합성 니트릴 장갑');
  await page.getByLabel('기본 단위',{exact:true}).fill('개');
  await page.getByLabel('권장 재고',{exact:true}).fill('4');
  await page.getByRole('button',{name:'물품 저장',exact:true}).click();
  await page.getByRole('button',{name:'합성 니트릴 장갑 선택',exact:true}).click();
  await page.getByRole('button',{name:'입고 기록',exact:true}).click();
  await page.getByLabel('수량',{exact:true}).fill('2');
  await page.getByLabel('사유',{exact:true}).fill('합성 재실행 확인');
  await page.getByLabel('유효기간',{exact:true}).fill(`${new Date().getFullYear()+2}-12-31`);
  await page.getByRole('button',{name:'기록 저장',exact:true}).click();
  await expect(page.locator('.inventory-status')).toContainText('입고 기록을 저장했습니다.');
  await expect(page.getByRole('button',{name:'합성 니트릴 장갑 선택',exact:true}).locator('.inventory-stock strong')).toHaveText('2');
  await app.close();app=await launch();
  const restored=await openInventory(app);
  await expect(restored.getByRole('button',{name:'합성 니트릴 장갑 선택',exact:true}).locator('.inventory-stock strong')).toHaveText('2');
  await expect(restored.locator('.inventory-history')).toContainText('합성 재실행 확인');
  await restored.screenshot({path:'artifacts/electron-p0-e2e/inventory-workspace.png'});
 }finally{await app.close();}
});

// Prepared for the next explicitly authorized GUI run; not executed in Cloud Preview work.
test('Preview stays synthetic and leaves the isolated local JSON absent at narrow width',async()=>{
 const id=randomUUID(),app=await electron.launch({chromiumSandbox:true,args:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,ELECTRON_P0_TEST_RUN:id,ELECTRON_P0_DEV_URL:''}});
 try{const page=await app.firstWindow();await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:'업무 도구',exact:true}).click();await page.getByRole('button',{name:'물품관리 — 미리보기',exact:true}).click();await expect(page.getByRole('table')).toBeVisible();await expect(page.getByText(/preview_only · persisted:false/)).toBeVisible();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(640,720));const panel=page.getByRole('dialog',{name:'물품관리 — 미리보기',exact:true});await expect(panel).toBeVisible();expect(await panel.evaluate(e=>e.getBoundingClientRect().right<=innerWidth&&e.getBoundingClientRect().left>=0)).toBe(true);await page.getByRole('button',{name:'입고 등록',exact:true}).click();await expect(page.getByRole('dialog',{name:'입고 등록',exact:true})).toBeVisible();
 const info=await page.evaluate(()=>window.electronP0.info());expect(info.userData).toContain(id);const fs=await import('node:fs');expect(fs.existsSync(join(info.userData,'work-data','inventory','inventory.json'))).toBe(false);await page.screenshot({path:'artifacts/electron-p0-e2e/inventory-preview-narrow.png'});
 }finally{await app.close();}
});
