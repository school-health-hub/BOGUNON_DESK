import {preview} from 'vite';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await preview({configFile:'electron-p0/vite.config.ts',preview:{host:'127.0.0.1',port:0}});
let context;
try{
 context=await chromium.launchPersistentContext('.omo/p0-notices/browser-profile',{channel:'chrome',headless:true,viewport:{width:980,height:700},env:{...process.env,TEMP:process.env.TEMP,TMP:process.env.TMP}});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.electronP0={info:async()=>({appId:'kr.sungandi.schoolhealthdesk.electronp0',sourceSha:'d779e121b5abeb69887abf399bd9c08ad64d54fa',productName:'P0 focused renderer check'}),readSettings:async()=>null,writeSettings:async()=>{}};
  window.electronWork={tasks:{load:async()=>({ok:true,data:{document:{version:1,revision:0,tasks:[]},recovered:false}})},memo:{read:async()=>({ok:true,data:{version:1,text:''}})}};
 });
 const address=server.httpServer.address();
 assert(address&&typeof address==='object');
 await page.goto(`http://127.0.0.1:${address.port}/`);
 const notice=page.getByText('날씨·급식은 이 Electron 실행본에 연결되어 있지 않습니다.',{exact:true});
 await notice.first().waitFor();assert.equal(await notice.count(),2);
 assert.equal(await page.getByText(/로컬 업무를 불러오지 못했습니다/).count(),0);
 const results=[];
 for(const [width,height] of [[980,700],[1440,900]]){
  await page.setViewportSize({width,height});
  await page.screenshot({path:`.omo/p0-notices/dashboard-${width}.png`,fullPage:true});
  const panels=[];
  for(const name of ['weather','meal']){
   const panel=page.locator(`.${name}-panel`);
   await panel.screenshot({path:`.omo/p0-notices/${name}-${width}.png`});
   panels.push(await panel.evaluate(el=>({className:el.className,text:el.innerText,width:el.clientWidth,scrollWidth:el.scrollWidth})));
  }
  results.push({width,height,panels});
 }
 assert.deepEqual(errors,[]);
 await writeFile('.omo/p0-notices/browser-result.json',JSON.stringify({surface:'production renderer in Chrome, memory-only Electron bridge; not Portable QA',results,errors},null,2));
 console.log(JSON.stringify({pass:true,viewports:results.map(x=>[x.width,x.height]),errors}));
}finally{await context?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
