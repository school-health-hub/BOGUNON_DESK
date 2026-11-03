import {test,expect,_electron as electron} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
test('1280x720 observe actual settings IPC and atomic file operations without changing product behavior',async()=>{
 test.setTimeout(180000);const output=resolve('artifacts/design05b-diagnostic');await mkdir(output,{recursive:true});
 const root=resolve('build/electron-p0-app'),meta=JSON.parse(await readFile(join(root,'build-meta.json'),'utf8'));
 expect(meta).toEqual({sourceSha:'036ff1e73a5cfdb6c0b16921aa04ebf804aed79a',dirty:false});
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));pkg.main='settings-observer.cjs';await writeFile(join(root,'package.json'),JSON.stringify(pkg));await copyFile('electron-p0/e2e/settings-observer.cjs',join(root,'settings-observer.cjs'));
 const log=join(output,'fs-ipc-sequence.jsonl');await writeFile(log,'');
 const app=await electron.launch({chromiumSandbox:true,timeout:30000,args:[root],env:{...process.env,ELECTRON_P0_TEST_RUN:randomUUID(),ELECTRON_P0_DEV_URL:'',SETTINGS_QA_LOG:log}});
 const page=await app.firstWindow();const rows:unknown[]=[];const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
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
 }finally{
  await page.screenshot({path:join(output,'last.png')}).catch(()=>{});await app.close();
  const lines=(await readFile(log,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  const failures=lines.filter(line=>line.event==='fs-error'&&line.code!=='ENOENT');
  console.log('::notice title=SETTINGS_DIAG_SUMMARY::'+JSON.stringify({iterations:rows.length,failures,rendererErrors:errors}));
  await writeFile(join(output,'summary.json'),JSON.stringify({sourceSha:meta.sourceSha,qaSha:process.env.DESIGN_QA_SHA,diagnosticBootstrap:true,rows,errors,failures},null,2));
 }
});
