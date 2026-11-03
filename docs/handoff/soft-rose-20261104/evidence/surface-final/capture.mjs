import {preview} from 'vite';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='.omo/surface-final';
const server=await preview({configFile:'electron-p0/vite.config.ts',preview:{host:'127.0.0.1',port:0}});
let browser;
const results=[];
try{
 browser=await chromium.launchPersistentContext(`${out}/browser-profile`,{channel:'chrome',headless:true});
 await browser.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const address=server.httpServer.address();assert(address&&typeof address==='object');
 for(const [width,height,scale] of [[980,700,1],[1440,900,1],[980,700,1.25],[980,700,1.5],[784,560,1.25],[653,467,1.5]]){
  const context=await browser.browser().newContext({viewport:{width,height},deviceScaleFactor:scale});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.addInitScript(()=>{
   const tasks=Array.from({length:8},(_,i)=>({id:`11111111-1111-4111-8111-${String(i+1).padStart(12,'0')}`,title:'긴 한글 합성 업무명 — 건강교육 자료 준비와 일정 확인 '.repeat(3),scheduledDate:'2026-11-04',dueDate:'2026-11-06',completed:false,priority:'high',category:'교육',dday:true}));
   window.electronP0={info:async()=>({appId:'kr.sungandi.schoolhealthdesk.electronp0',sourceSha:'195f3375e91348d2bbc7145b0e3743ca5f54385f',userData:'memory-only',productName:'Focused Surface check'}),readSettings:async()=>null,writeSettings:async s=>{window.qaSettings=s}};
   window.electronWork={tasks:{load:async()=>({ok:true,data:{document:{version:1,revision:1,tasks},recovered:false}})},memo:{read:async()=>({ok:true,data:{version:1,text:'긴 한글 합성 메모와 일정 확인\n'.repeat(24)}}),write:async()=>({ok:true})}};
  });
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.locator('.weather-panel .is-signedOut').waitFor();
  await page.getByRole('button',{name:'화면 꾸미기',exact:true}).waitFor();
  const key=`${width}-${height}-${scale}`;
  const before=await page.evaluate(()=>window.qaSettings.dashboard.widgets);
  assert.equal(before.length,13);
  await page.screenshot({path:`${out}/${key}-view.png`});
  const metrics=await page.evaluate(()=>{
   const dashboard=document.querySelector('.workspace-dashboard'),dock=document.querySelector('.dock-zone'),card=document.querySelector('.widget-frame');
   const a=dashboard.getBoundingClientRect(),b=dock.getBoundingClientRect(),c=card.getBoundingClientRect(),style=getComputedStyle(card);
   return {dashboardBottom:a.bottom,dockTop:b.top,dockBottom:b.bottom,firstCardTop:c.top,bodyWidth:document.documentElement.scrollWidth,viewport:innerWidth,blur:style.backdropFilter,fill:style.backgroundColor};
  });
  assert(metrics.dashboardBottom<=metrics.dockTop+1);assert(metrics.dockBottom<=height);assert(metrics.bodyWidth<=width);assert.match(metrics.blur,/blur/);
  await page.locator('.workspace-dashboard').evaluate(el=>{el.scrollTop=el.scrollHeight});
  await page.screenshot({path:`${out}/${key}-bottom.png`});
  await page.getByRole('button',{name:'설정',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'설정',exact:true});await dialog.waitFor();
  const close=page.getByRole('button',{name:'설정 닫기'});await close.focus();await page.keyboard.press('Shift+Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)));
  const control=page.getByRole('checkbox',{name:/유리 효과 줄이기/});await control.check();
  await page.screenshot({path:`${out}/${key}-settings.png`});
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.widget-frame')).backdropFilter),'none');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'설정');
  await page.screenshot({path:`${out}/${key}-reduced.png`});
  await page.getByRole('button',{name:'설정',exact:true}).click();
  await page.getByRole('checkbox',{name:/유리 효과 줄이기/}).uncheck();await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.widget-frame')).backdropFilter),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.match(await page.evaluate(()=>getComputedStyle(document.querySelector('.widget-frame')).backdropFilter),/blur/);
  await page.getByRole('button',{name:'화면 꾸미기',exact:true}).click();await page.getByRole('button',{name:'완료',exact:true}).waitFor();
  await page.screenshot({path:`${out}/${key}-edit.png`});
  const editSafety=await page.evaluate(()=>({toolbarBottom:document.querySelector('.workspace-toolbar').getBoundingClientRect().bottom,dashboardTop:document.querySelector('.workspace-dashboard').getBoundingClientRect().top}));
  assert(editSafety.toolbarBottom<=editSafety.dashboardTop);
  await page.getByRole('button',{name:'완료',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.qaSettings.dashboard.widgets),before);
  assert.equal(await page.getByText(/로컬 업무를 불러오지 못했습니다/).count(),0);assert.deepEqual(errors,[]);
  results.push({width,height,scale,metrics,editSafety,settingsKeyboard:true,reducedEffects:true,storedGeometryUnchanged:true,errors});
  await context.close();
 }
 await writeFile(`${out}/browser-result.json`,JSON.stringify({surface:'Chrome production renderer; memory-only bridge; Windows OS DPI not changed',results},null,2));
 console.log(JSON.stringify({pass:true,cases:results.length}));
}finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));}










