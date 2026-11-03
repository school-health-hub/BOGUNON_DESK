// Synthetic browser QA only. Never starts Electron or connects to a user profile.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const url = new URL(process.env.SOFT_ROSE_PREVIEW_URL ?? 'http://127.0.0.1:5285/');
assert.equal(url.protocol, 'http:');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.username + url.password + url.search + url.hash, '');
const builtHtml = await readFile(new URL('../../build/electron-p0-app/renderer/index.html',import.meta.url),'utf8');
const browser = await chromium.launch({headless:true,
  ...(process.env.SOFT_ROSE_BROWSER_PATH ? {executablePath:process.env.SOFT_ROSE_BROWSER_PATH} : {})});
const results = [];
try {
  for (const [width,height,material] of [[1440,900,'none'],[1366,768,'none'],[900,600,'none'],[1440,900,'acrylic']]) {
    const context = await browser.newContext({viewport:{width,height}});
    try {
      await context.route('**/*',route => new URL(route.request().url()).origin === url.origin
        ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror',error => errors.push(error.name));
      await page.addInitScript(({material}) => {
        window.electronP0 = {
          info:async()=>({appId:'kr.sungandi.schoolhealthdesk.electronp0',productName:'Synthetic QA',
            userData:'synthetic',sourceSha:'synthetic-renderer-only',electron:'browser-fixture',
            windowMaterial:material,desktopAttachment:false}),
          readSettings:async()=>null,writeSettings:async()=>{},
        };
        window.electronWork = {
          tasks:{load:async()=>({ok:true,data:{document:{version:1,revision:0,tasks:[]},recovered:false}})},
          memo:{read:async()=>({ok:true,data:{version:1,text:'합성 QA 메모'}}),write:async data=>({ok:true,data})},
        };
      },{material});
      const response = await page.goto(url.href);
      assert.equal(response?.status(),200);
      assert.equal(await response.text(),builtHtml,'Serve the current production build, not the development server');
      assert.ok(!builtHtml.includes('/@vite/client'));
      await page.locator('.dock-zone').waitFor();
      await page.waitForFunction(()=>document.body.innerText.includes('연결 전 상태입니다.'));
      const blur = await page.locator('.widget-frame').first().evaluate(element=>getComputedStyle(element).backdropFilter);
      assert.match(blur,/blur\(18px\)/,'Production CSS must retain the standard backdrop-filter declaration');
      const dockBlur = await page.locator('.dock').evaluate(element=>getComputedStyle(element).backdropFilter);
      assert.match(dockBlur,/blur\(18px\)/);
      const noticeColor = await page.locator('.workspace-data-notice.is-signedOut').first().evaluate(element=>getComputedStyle(element).color);
      const rgb = noticeColor.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
      assert.ok(rgb);
      const luminance = channels=>channels.map(value=>value/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4)
        .reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
      const ordinaryCanvasContrast = (luminance([255,248,250])+0.05)/(luminance(rgb.slice(1).map(Number))+0.05);
      if(material==='none')assert.ok(ordinaryCanvasContrast>=4.5,'Small notices must contrast with the ordinary rose canvas');
      assert.equal(await page.getByText(/로컬 업무를 불러오지 못했습니다/).count(),0);
      await page.locator('.workspace-dashboard').evaluate(element=>{element.scrollTop=element.scrollHeight;});
      const geometry = await page.evaluate(()=>{
        const main=document.querySelector('.workspace-dashboard').getBoundingClientRect();
        const dock=document.querySelector('.dock-zone').getBoundingClientRect();
        const last=document.querySelector('[data-widget-type="quick-launcher"]').getBoundingClientRect();
        return {mainBottom:main.bottom,dockTop:dock.top,lastBottom:last.bottom,
          noHorizontalOverflow:document.documentElement.scrollWidth===innerWidth};
      });
      assert.ok(geometry.mainBottom<=geometry.dockTop,'Dock must not cover the scroll viewport');
      assert.ok(geometry.lastBottom<=geometry.mainBottom,'Bottom widget must be reachable by scrolling');
      assert.ok(geometry.noHorizontalOverflow);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.widget-frame')).backdropFilter==='none'
        && getComputedStyle(document.querySelector('.workspace-shell')).backgroundColor==='rgb(255, 248, 250)');
      assert.deepEqual(errors,[]);
      results.push({width,height,materialFixture:material,blur,dockBlur,geometry,
        ordinaryCanvasContrast:material==='none'?ordinaryCanvasContrast:null,reducedEffects:'PASS'});
    } finally { await context.close(); }
  }
  console.log(JSON.stringify({kind:'SYNTHETIC_BROWSER_ONLY_NO_NATIVE',results},null,2));
} finally { await browser.close(); }
