import {test,expect,_electron as electron} from '@playwright/test';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
test('INT-EL-05E actual Portable launcher: identify extracted app and close gracefully',async()=>{
 test.setTimeout(90000);const out=resolve('artifacts/int-el05e');await mkdir(out,{recursive:true});
 const report:Record<string,unknown>={sourceSha:'c06ce6a910002cc7658a5545e23e0d3ed914d377',qaSha:process.env.GITHUB_SHA,actualPortable:'NOT RUN',gracefulClose:'NOT RUN'};
 const manifest=JSON.parse(await readFile('release-electron-p0/INT-EL-05E-MANIFEST.json','utf8'));
 const portable=resolve('release-electron-p0',manifest.portable.file),profile=randomUUID();
 expect(process.platform).toBe('win32');expect(process.env.ELECTRON_P0_EXECUTABLE).toBe(portable);
 let app:Awaited<ReturnType<typeof electron.launch>>|undefined;
 try{
  // Never substitute win-unpacked or a browser if the Portable launcher cannot attach.
  app=await electron.launch({executablePath:portable,args:[],chromiumSandbox:true,timeout:30000,env:{...process.env,ELECTRON_P0_TEST_RUN:profile,ELECTRON_P0_DEV_URL:'',INVENTORY_LOCAL_QA:''}});
  report.launcherPid=app.process().pid;const page=await app.firstWindow();await expect(page.getByRole('navigation',{name:'주요 기능'})).toBeVisible();
  await expect(page.locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');
  const info=await page.evaluate(()=>window.electronP0.info());expect(info.sourceSha).toBe(report.sourceSha);expect(info.userData).toContain(profile);
  const runtime=await app.evaluate(({app,BrowserWindow})=>({pid:process.pid,exe:app.getPath('exe'),appPath:app.getAppPath(),packaged:app.isPackaged,bounds:BrowserWindow.getAllWindows()[0].getBounds(),contentBounds:BrowserWindow.getAllWindows()[0].getContentBounds()}));
  report.runtime=runtime;expect(runtime.packaged).toBe(true);expect(resolve(runtime.exe)).not.toBe(portable);
  const hash=async(file:string)=>createHash('sha256').update(await readFile(file)).digest('hex');
  expect(await hash(runtime.exe)).toBe(manifest.packagedApplication.sha256);expect(await hash(runtime.appPath)).toBe(manifest.asar.sha256);
  const images:unknown[]=[];report.images=images;
  for(const [width,height] of [[980,700],[1440,900]]){
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(size.width,size.height),{width,height});await page.waitForTimeout(350);
   for(const name of ['surface','tools','settings']){
    const label=name==='tools'?'업무 도구':'설정';if(name!=='surface')await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:label,exact:true}).click();
    if(name!=='surface')await expect(page.getByRole('dialog',{name:label,exact:true})).toBeVisible();
    const file=`portable-${width}x${height}-${name}.png`;await page.screenshot({path:join(out,file)});
    images.push({file,sha256:await hash(join(out,file)),requestedOuter:{width,height},actualWindow:await app.evaluate(({BrowserWindow})=>({bounds:BrowserWindow.getAllWindows()[0].getBounds(),content:BrowserWindow.getAllWindows()[0].getContentBounds()})),renderer:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))});
    if(name!=='surface')await page.keyboard.press('Escape');
   }
  }
  report.actualPortable='PASS';
  const closed=app.waitForEvent('close',{timeout:15000});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;report.gracefulClose='PASS';app=undefined;
 }catch(error){report.failure=error instanceof Error?error.message:String(error);report.actualPortable=app?'FAIL':'BLOCKED';throw error;}
 finally{if(app){report.fallbackClose=true;await app.close().catch(()=>{});}await writeFile(join(out,'portable-runtime.json'),JSON.stringify(report,null,2));}
});
