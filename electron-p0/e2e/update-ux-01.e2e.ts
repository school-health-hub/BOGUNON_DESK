import {test,expect,_electron as electron} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('isolated Windows update window opens once from the application menu',async()=>{
  const root=join(tmpdir(),'bogunon-update-ux-01-gui');await mkdir(root,{recursive:true});
  const app=await electron.launch({chromiumSandbox:true,args:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,ELECTRON_P0_TEST_RUN:randomUUID(),ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:root,ELECTRON_P0_DEV_URL:''}});
  try{
    await app.firstWindow();
    const open=async()=>app.evaluate(({Menu})=>{const item=Menu.getApplicationMenu()?.items[0]?.submenu?.items.find(item=>item.label==='업데이트 확인');if(!item?.click)throw Error('Update menu missing');item.click();});
    const next=app.waitForEvent('window');await open();const page=await next;
    await expect(page.getByRole('heading',{name:'BOGUNON DESK 업데이트'})).toBeVisible();
    await expect(page.getByRole('button',{name:'나중에 하기'})).toBeVisible();
    await open();
    expect((await app.windows()).filter(window=>window.url().includes('/update/index.html'))).toHaveLength(1);
    const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.getTitle()==='BOGUNON DESK 업데이트')?.getBounds());
    expect(bounds?.width).toBeLessThanOrEqual(540);
    await page.screenshot({path:join(root,'update-window.png')});
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.getTitle()==='BOGUNON DESK 업데이트')?.setContentSize(360,330));
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole('button',{name:'나중에 하기'})).toBeInViewport();
    await page.screenshot({path:join(root,'update-window-narrow.png')});
    const closed=page.waitForEvent('close');await page.getByRole('button',{name:'나중에 하기'}).click();await closed;
  }finally{await app.close();}
});

test('Windows accepts a synthetic native update toast without a release download',async()=>{
  const root=join(tmpdir(),'bogunon-update-ux-01-toast');await mkdir(root,{recursive:true});
  const app=await electron.launch({chromiumSandbox:true,args:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,ELECTRON_P0_TEST_RUN:randomUUID(),ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:root,ELECTRON_P0_DEV_URL:''}});
  try{
    await app.firstWindow();
    const result=await app.evaluate(async({Notification})=>{
      if(!Notification.isSupported())return 'unsupported';
      const toast=new Notification({title:'BOGUNON DESK 업데이트 · 합성 QA',body:'실제 릴리스 다운로드나 설치는 시작하지 않습니다.'});
      return await new Promise<string>(resolve=>{const timer=setTimeout(()=>resolve('timeout'),4000);toast.once('show',()=>{clearTimeout(timer);resolve('shown');});toast.once('failed',()=>{clearTimeout(timer);resolve('failed');});toast.show();});
    });
    expect(result).toBe('shown');
  }finally{await app.close();}
});
