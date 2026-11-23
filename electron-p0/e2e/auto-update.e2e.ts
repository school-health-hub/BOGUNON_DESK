import {expect,test,_electron as electron} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,readdir} from 'node:fs/promises';
import {join} from 'node:path';

test('installed-app update entry remains safe in a new isolated profile',async()=>{
  const base=process.env.UPDATE_QA_TEMP;if(!base)throw Error('Set UPDATE_QA_TEMP');
  await mkdir(base,{recursive:true});const root=await mkdtemp(join(base,'gui-profile-'));
  const app=await electron.launch({chromiumSandbox:true,args:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,RUNNER_TEMP:base,ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:root,ELECTRON_P0_TEST_RUN:randomUUID(),ELECTRON_P0_DEV_URL:''}});
  try{
    const page=await app.firstWindow();
    const guide=page.getByRole('dialog',{name:'BOGUNON DESK 시작 안내'});
    await expect(guide).toBeVisible({timeout:20000});
    await guide.getByRole('button',{name:'다음'}).click();
    await guide.getByRole('button',{name:/^Workspace/}).click();
    await guide.getByRole('button',{name:'다음'}).click();
    await guide.getByRole('button',{name:'다음'}).click();
    await guide.getByRole('button',{name:'BOGUNON DESK 시작하기'}).click();
    await expect(guide).toHaveCount(0);
    await page.getByRole('button',{name:'설정',exact:true}).click();
    const settings=page.getByRole('dialog',{name:'설정',exact:true});
    await settings.getByRole('button',{name:'앱 정보'}).click();
    await expect(settings.getByRole('region',{name:'앱 업데이트'})).toBeVisible();
    await expect(settings.getByText(/이 실행본에서는 앱 내 업데이트를 사용할 수 없습니다/)).toBeVisible();
    await expect(settings.getByRole('button',{name:'업데이트 받기'})).toHaveCount(0);
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(win=>!win.webContents.getURL().includes('/palette/'))?.setContentSize(980,700));
    await page.screenshot({path:join(base,'update-about-980x700.png')});
    expect(await readdir(root)).not.toContain('update-downloads');
  }finally{await app.close();}
});
