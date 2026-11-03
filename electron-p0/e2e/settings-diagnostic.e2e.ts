import {test,expect,_electron as electron} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
test('1280x720 observe actual settings IPC and atomic file operations without changing product behavior',async()=>{
 test.setTimeout(180000);const output=resolve('artifacts/design05b-diagnostic');await mkdir(output,{recursive:true});
 const root=resolve('build/electron-p0-app'),meta=JSON.parse(await readFile(join(root,'build-meta.json'),'utf8'));
 expect(meta).toEqual({sourceSha:'e919dc4b552879e6c49dbd3d8887d8d45c3cdd74',dirty:false});
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));pkg.main='settings-observer.cjs';await writeFile(join(root,'package.json'),JSON.stringify(pkg));await copyFile('electron-p0/e2e/settings-observer.cjs',join(root,'settings-observer.cjs'));
 const log=join(output,'fs-ipc-sequence.jsonl');await writeFile(log,'');
 const profile=randomUUID();let app=await electron.launch({chromiumSandbox:true,timeout:30000,args:[root],env:{...process.env,ELECTRON_P0_TEST_RUN:profile,ELECTRON_P0_DEV_URL:'',SETTINGS_QA_LOG:log}});
 let page=await app.firstWindow();const rows:unknown[]=[];const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 app.process().stdout?.on('data',data=>{const s=String(data);if(s.includes('SETTINGS_FS_ERROR'))console.log(s.trim())});
 try{
  await expect(page.getByRole('navigation',{name:'주요 기능'})).toBeVisible();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,720));
  await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:'설정',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'설정',exact:true});await expect(dialog).toBeVisible();
  for(let i=0;i<40;i++){
   const corner=i%2===0?'compact':'soft',label=corner==='compact'?'컴팩트':'부드럽게';
   const before=await page.evaluate(()=>window.electronP0.readSettings());
   const button=dialog.getByRole('button',{name:label,exact:true});await button.scrollIntoViewIfNeeded();const bounds=await button.boundingBox();await button.click();
   try{await expect.poll(async()=>{const value=await page.evaluate(()=>window.electronP0.readSettings());return (value?.dashboard as {appearance:{cornerStyle:string}})?.appearance.cornerStyle}).toBe(corner);rows.push({iteration:i,corner,bounds,status:'PASS'});}
   catch(error){const after=await page.evaluate(()=>window.electronP0.readSettings());rows.push({iteration:i,corner,bounds,status:'FAIL',before,after});await page.screenshot({path:join(output,'failure.png')});throw error;}
  }
  // Require the requested compact value to survive a real app restart.
  await dialog.getByRole('button',{name:'컴팩트',exact:true}).click();
  await expect.poll(async()=>((await page.evaluate(()=>window.electronP0.readSettings()))?.dashboard as {appearance:{cornerStyle:string}})?.appearance.cornerStyle).toBe('compact');
  const valid=await page.evaluate(()=>window.electronP0.readSettings());
  // Explicit QA-only permanent-denial injection; never count these as natural errors.
  await app.evaluate(()=>{(globalThis as unknown as {__settingsQaDenyRename:boolean}).__settingsQaDenyRename=true;});
  await dialog.getByRole('button',{name:'부드럽게',exact:true}).click();
  await expect(dialog.getByRole('status')).toHaveText('저장 실패 — 현재 배치를 유지하고 다시 시도해 주세요');
  expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(valid);
  await app.evaluate(()=>{(globalThis as unknown as {__settingsQaDenyRename:boolean}).__settingsQaDenyRename=false;});
  await app.close();
  app=await electron.launch({chromiumSandbox:true,timeout:30000,args:[root],env:{...process.env,ELECTRON_P0_TEST_RUN:profile,ELECTRON_P0_DEV_URL:'',SETTINGS_QA_LOG:log}});
  page=await app.firstWindow();await expect(page.locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');
  expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(valid);
  console.log('::notice title=SETTINGS_FIXED_CHECKS::40 changes, compact readback, permanent-failure old-settings preservation, real restart PASS');
 }finally{
  await page.screenshot({path:join(output,'last.png')}).catch(()=>{});await app.close();
  const lines=(await readFile(log,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  const failures=lines.filter(line=>line.event==='fs-error'&&line.code!=='ENOENT');
  console.log('::notice title=SETTINGS_DIAG_SUMMARY::'+JSON.stringify({iterations:rows.length,failures,rendererErrors:errors}));
  await writeFile(join(output,'summary.json'),JSON.stringify({sourceSha:meta.sourceSha,qaSha:process.env.DESIGN_QA_SHA,diagnosticBootstrap:true,rows,errors,failures},null,2));
 }
});
