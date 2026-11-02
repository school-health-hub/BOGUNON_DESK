import {test,expect,_electron as electron} from '@playwright/test';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

test('opens Inventory and restores an isolated synthetic movement',async()=>{
 const profileId=randomUUID(),launch=()=>electron.launch({chromiumSandbox:true,args:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,ELECTRON_P0_TEST_RUN:profileId,ELECTRON_P0_DEV_URL:''}});
 let app=await launch();let page=await app.firstWindow();await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:'업무 도구'}).click();await page.getByRole('button',{name:'재고 관리 · 합성 로컬'}).click();await expect(page.getByRole('heading',{name:'재고 관리'})).toBeVisible();await page.screenshot({path:'artifacts/electron-p0-e2e/inventory-workspace.png'});
 await page.getByRole('button',{name:'합성 니트릴 장갑 선택'}).click();await page.getByRole('button',{name:'입고 기록'}).click();await page.getByLabel('수량').fill('2');await page.getByLabel('사유').fill('합성 재실행 확인');await page.getByRole('button',{name:'기록 저장'}).click();await expect(page.getByRole('status')).toContainText('입고 기록을 저장했습니다.');await app.close();
 app=await launch();page=await app.firstWindow();await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:'업무 도구'}).click();await page.getByRole('button',{name:'재고 관리 · 합성 로컬'}).click();await expect(page.getByRole('button',{name:'합성 니트릴 장갑 선택'}).locator('.inventory-stock strong')).toHaveText('10');await app.close();
});
