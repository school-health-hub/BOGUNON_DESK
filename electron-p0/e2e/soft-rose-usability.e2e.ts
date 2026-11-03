import {test, expect, _electron as electron} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';

test('OPTION C: compact Surface, reachable Dock and modal at desktop sizes and zoom', async () => {
  // A unique test profile; never launch a Portable or reuse a user profile.
  const app = await electron.launch({chromiumSandbox:true, args:[join(process.cwd(),'build/electron-p0-app')],
    env:{...process.env,ELECTRON_P0_TEST_RUN:randomUUID(),ELECTRON_P0_DEV_URL:''}});
  try {
    const page = await app.firstWindow();
    const dock = page.getByRole('navigation',{name:'주요 기능'});
    await expect(dock).toBeVisible();
    const initialSetup=page.getByRole('dialog',{name:'학교 초기 설정'});
    await expect(initialSetup).toBeVisible();
    await initialSetup.getByRole('button',{name:'나중에 설정'}).click();
    if (!process.env.OPTION_C_BASELINE) {
      const saved=await page.evaluate(async()=>{
        const loaded=await window.electronWork.tasks.load();
        if(!loaded.ok)return false;
        const date=new Date(),today=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
        const result=await window.electronWork.tasks.save({...loaded.data.document,tasks:[{
          id:crypto.randomUUID(),title:'합성 QA · 학생 건강검진 결과 안내문 및 보호자 동의서 확인과 학년별 보건교육 일정 조정',
          scheduledDate:today,dueDate:today,completed:false,priority:'high',category:'검진',dday:true,
        }]},loaded.data.document.revision);
        return result.ok;
      });
      expect(saved).toBe(true);
      await page.reload();
      await expect(dock).toBeVisible();
      await page.getByRole('dialog',{name:'학교 초기 설정'}).getByRole('button',{name:'나중에 설정'}).click();
      await expect(page.locator('.task-title').first()).toContainText('합성 QA');
    }
    for (const [width,height,zoom] of [[1440,900,1],[980,700,1],[1440,900,1.25],[1440,900,1.5],[980,700,1.5]]) {
      await app.evaluate(({BrowserWindow},size) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.setContentSize(size.width,size.height);
        window.webContents.setZoomFactor(size.zoom);
      },{width:width!,height:height!,zoom:zoom!});
      await page.waitForFunction(() => document.querySelector('.workspace-dashboard')!.clientHeight > 0);
      const main = page.locator('.workspace-dashboard');
      if (!process.env.OPTION_C_BASELINE) await expect.poll(() => main.evaluate(el=>el.scrollWidth<=el.clientWidth+2)).toBe(true);
      await main.evaluate(el => {el.scrollTop=0;});
      await page.screenshot({path:`artifacts/option-c/${process.env.OPTION_C_BASELINE?'before':'after'}-${width}x${height}-${zoom}.png`});
      if (process.env.OPTION_C_BASELINE) continue;
      expect(await page.locator('.upcoming-list').evaluateAll(els=>els.every(el=>el.scrollWidth<=el.clientWidth+2))).toBe(true);
      expect(await page.locator('.summary-card').evaluate(el=>el.querySelector('.summary-card__heading')!.getBoundingClientRect().bottom<=el.querySelector('.summary-stats')!.getBoundingClientRect().top)).toBe(true);
      await expect.poll(() => page.evaluate(() => {
        const main=document.querySelector('.workspace-dashboard')!.getBoundingClientRect();
        const dock=document.querySelector('.dock-zone')!.getBoundingClientRect();
        return main.bottom<=dock.top+1 && dock.bottom<=innerHeight+1 && document.documentElement.scrollWidth<=innerWidth+1;
      })).toBe(true);
      await main.evaluate(el => {el.scrollTop=el.scrollHeight;});
      await expect.poll(() => main.evaluate(el => el.scrollTop+el.clientHeight>=el.scrollHeight-2)).toBe(true);
      const settings=dock.getByRole('button',{name:'설정',exact:true});
      await settings.click();
      const dialog=page.getByRole('dialog',{name:'설정',exact:true});
      const close=dialog.getByRole('button',{name:'설정 닫기'});
      await expect(close).toBeFocused();
      await expect(close).toBeInViewport();
      expect(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;})).toBe(true);
      await dialog.getByRole('button',{name:'Dock',exact:true}).click();
      await page.keyboard.press('Shift+Tab');
      expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
      await page.screenshot({path:`artifacts/option-c/settings-${width}x${height}-${zoom}.png`});
      await page.keyboard.press('Escape');
      await expect(settings).toBeFocused();
    }
  } finally {await app.close();}
});
