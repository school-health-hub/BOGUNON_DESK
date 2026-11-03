import {test,expect,_electron as electron} from '@playwright/test';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const source='036ff1e73a5cfdb6c0b16921aa04ebf804aed79a';
const output='artifacts/design05';
for(const [width,height] of [[1440,900],[1366,768],[1280,720],[980,700]]){
 test(`Soft Rose actual Windows Electron ${width}x${height}`,async()=>{
  test.setTimeout(150000);await mkdir(output,{recursive:true});
  const profile=randomUUID();
  const evidence:{[key:string]:unknown}={sourceSha:source,qaSha:process.env.DESIGN_QA_SHA,requestedOuter:{width,height},profile,images:[],nativeDialogs:'NOT RUN',physicalDpi:'NOT RUN',visualApproval:'REVIEW REQUIRED'};
  let app:Awaited<ReturnType<typeof electron.launch>>|undefined;
  let page:Awaited<ReturnType<NonNullable<typeof app>['firstWindow']>>|undefined;
  const images:unknown[]=[];
  const capture=async(name:string)=>{if(!page)return;const file=`${width}x${height}-${name}.png`,path=join(output,file);await page.screenshot({path});images.push({file,sha256:createHash('sha256').update(await readFile(path)).digest('hex'),renderer:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),captureType:'actual Electron renderer, not native titlebar'});};
  try{
   expect(process.platform).toBe('win32');
   expect(JSON.parse(await readFile('build/electron-p0-app/build-meta.json','utf8'))).toEqual({sourceSha:source,dirty:false});
   app=await electron.launch({chromiumSandbox:true,timeout:30000,args:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,ELECTRON_P0_TEST_RUN:profile,ELECTRON_P0_DEV_URL:'',INVENTORY_LOCAL_QA:''}});
   page=await app.firstWindow();
   page.on('pageerror',error=>{const errors=evidence.pageErrors as string[]|undefined;evidence.pageErrors=[...(errors??[]),error.message]});
   await expect(page.getByRole('navigation',{name:'주요 기능'})).toBeVisible();
   const info=await page.evaluate(()=>window.electronP0.info());expect(info.sourceSha).toBe(source);expect(info.userData).toContain(profile);
   evidence.window=await app.evaluate(({BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setSize(size.width,size.height);return {minimum:w.getMinimumSize(),bounds:w.getBounds(),contentBounds:w.getContentBounds()};},{width,height});
   await page.waitForTimeout(350);
   const actual=await app.evaluate(({BrowserWindow})=>({bounds:BrowserWindow.getAllWindows()[0].getBounds(),contentBounds:BrowserWindow.getAllWindows()[0].getContentBounds()}));evidence.actualWindow=actual;
   await capture('surface');
   expect.soft(actual.bounds.width).toBe(width);expect.soft(actual.bounds.height).toBe(height);
   await expect(page.locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');
   const before=await page.evaluate(()=>window.electronP0.readSettings());
   const layout=before?.dashboard as {widgets:{id:string;visible:boolean}[]};expect(layout.widgets).toHaveLength(13);evidence.widgetVisibility=layout.widgets.map(w=>({id:w.id,visible:w.visible}));
   evidence.surface=await page.evaluate(()=>({horizontalOverflow:document.documentElement.scrollWidth>innerWidth,background:getComputedStyle(document.querySelector('.workspace-shell')!).backgroundColor,frameBackground:getComputedStyle(document.querySelector('.widget-frame')!).backgroundColor,dockVisible:!!document.querySelector('.dock')}));
   expect.soft((evidence.surface as {horizontalOverflow:boolean}).horizontalOverflow).toBe(false);
   expect.soft((evidence.surface as {background:string}).background).toBe('rgb(255, 248, 250)');
   evidence.paintAndOverflow=await page.evaluate(()=>{
    const shell=document.querySelector('.workspace-shell')!,clock=document.querySelector('.date-card__time')!,summary=document.querySelector('.summary-card')!;
    const measure=(el:Element)=>({scroll:el.scrollWidth,client:el.clientWidth,rect:el.getBoundingClientRect().toJSON()});
    const range=document.createRange();range.selectNodeContents(clock);const glyphs=range.getBoundingClientRect(),box=clock.getBoundingClientRect();
    return {material:getComputedStyle(shell,'::before').backgroundColor,materialImage:getComputedStyle(shell,'::before').backgroundImage,clock:measure(clock),clockGlyphsFit:glyphs.right<=box.right+1&&glyphs.left>=box.left-1,summary:measure(summary)};
   });
   const painted=evidence.paintAndOverflow as {material:string;materialImage:string;clock:{scroll:number;client:number};clockGlyphsFit:boolean;summary:{scroll:number;client:number}};
   expect.soft(painted.material).toBe('rgb(255, 248, 250)');expect.soft(painted.materialImage).toBe('none');
   expect.soft(painted.clock.scroll).toBeLessThanOrEqual(painted.clock.client+1);expect.soft(painted.clockGlyphsFit).toBe(true);expect.soft(painted.summary.scroll).toBeLessThanOrEqual(painted.summary.client+1);
   const dock=page.getByRole('navigation',{name:'주요 기능'});
   const tools=dock.getByRole('button',{name:'업무 도구',exact:true});await tools.click();
   const dialog=page.getByRole('dialog',{name:'업무 도구',exact:true});await expect(dialog).toBeVisible();await capture('tools');
   for(const name of ['품의 도우미 · 세션 전용','공문작업실 · 로컬 초안','교육영상 Finder · 합성 Mock','물품관리 — 로컬 저장','물품관리 — 미리보기'])await expect(dialog.getByRole('button',{name,exact:true})).toBeVisible();
   expect.soft(await dialog.getByRole('button',{name:'물품관리 — 로컬 QA',exact:true}).count()).toBe(0);
   const close=dialog.getByRole('button',{name:'업무 도구 닫기'});await expect(close).toBeFocused();
   await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'물품관리 — 미리보기',exact:true})).toBeFocused();
   await page.keyboard.press('Tab');await expect(close).toBeFocused();
   evidence.toolsBounds=await dialog.boundingBox();
   await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(tools).toBeFocused();
   const settings=dock.getByRole('button',{name:'설정',exact:true});await settings.click();const settingsDialog=page.getByRole('dialog',{name:'설정',exact:true});await expect(settingsDialog).toBeVisible();
   evidence.inspector=await settingsDialog.evaluate(el=>{
    const panel=el.querySelector('.workspace-editor-panel')!;return {opacity:getComputedStyle(panel).opacity,animation:getComputedStyle(panel).animationName,backdrop:getComputedStyle(panel).backdropFilter,buttons:[...panel.querySelectorAll('button')].filter(b=>b.offsetWidth>0).map(b=>({label:b.textContent,disabled:b.disabled,color:getComputedStyle(b).color,background:getComputedStyle(b).backgroundColor,opacity:getComputedStyle(b).opacity}))};
   });
   const inspector=evidence.inspector as {opacity:string;animation:string;backdrop:string};expect.soft(inspector.opacity).toBe('1');expect.soft(inspector.animation).toBe('none');expect.soft(inspector.backdrop).toBe('none');
   await capture('settings-screen');
   const categories=settingsDialog.getByRole('navigation',{name:'설정 카테고리'});
   for(const name of ['위젯','Dock','앱 정보','화면']){
    await categories.getByRole('button',{name,exact:true}).click();await expect(categories.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
    if(name==='위젯')expect.soft(await settingsDialog.locator('.widget-library__list article').count()).toBe(13);
    if(name==='Dock'||name==='앱 정보')await capture(`settings-${name==='Dock'?'dock':'about'}`);
   }
   const scroll=settingsDialog.locator('.rose-dialog-content');evidence.settingsScroll=await scroll.evaluate(el=>({scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
   expect.soft(await settingsDialog.evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight})).toBe(true);
   await settingsDialog.getByRole('button',{name:'컴팩트',exact:true}).scrollIntoViewIfNeeded();await settingsDialog.getByRole('button',{name:'컴팩트',exact:true}).click();
   await expect.poll(async()=>{const s=await page!.evaluate(()=>window.electronP0.readSettings());return (s?.dashboard as {appearance:{cornerStyle:string}})?.appearance.cornerStyle}).toBe('compact');
   await page.keyboard.press('Escape');await expect(settings).toBeFocused();
   const saved=await page.evaluate(()=>window.electronP0.readSettings());evidence.savedBeforeRestart=saved;
   await app.close();app=undefined;
   app=await electron.launch({chromiumSandbox:true,timeout:30000,args:[join(process.cwd(),'build/electron-p0-app')],env:{...process.env,ELECTRON_P0_TEST_RUN:profile,ELECTRON_P0_DEV_URL:'',INVENTORY_LOCAL_QA:''}});page=await app.firstWindow();
   await expect(page.locator('[data-p0-save]')).toHaveText('PoC 설정 저장됨');expect(await page.evaluate(()=>window.electronP0.readSettings())).toEqual(saved);evidence.restore='PASS';
   evidence.domChecks='COMPLETED';
  }catch(error){evidence.failure=error instanceof Error?error.message:String(error);if(page&&!page.isClosed())await capture('failure').catch(()=>{});throw error;}
  finally{evidence.images=images;evidence.assertionStatus=test.info().errors.length?'FAIL':'PASS';if(app)await app.close().catch(()=>{});await writeFile(join(output,`${width}x${height}-manifest.json`),JSON.stringify(evidence,null,2));}
 });
}
