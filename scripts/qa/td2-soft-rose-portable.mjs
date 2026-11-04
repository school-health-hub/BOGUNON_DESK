import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const expectedSha=process.env.TD2_EXPECTED_SOURCE_SHA;
const executable=process.env.TD2_PORTABLE_EXE;
const evidenceRoot=process.env.TD2_EVIDENCE_ROOT;
const qaRoot=process.env.ELECTRON_P0_QA_ROOT;
const productRoot=process.env.TD2_PRODUCT_ROOT;
if(!expectedSha||!executable||!evidenceRoot||!qaRoot||!productRoot)throw new Error('Missing TD2 QA environment');
const requireFromProduct=createRequire(join(resolve(productRoot),'package.json'));
const {chromium}=requireFromProduct('@playwright/test');

const qaRun=randomUUID();
const port=19227;
const screenshots=join(evidenceRoot,'screenshots');
await mkdir(screenshots,{recursive:true});

const result={
  sourceSha:expectedSha,
  portableExecutable:resolve(executable),
  qaRun,
  qaRoot,
  actualUserData:'',
  devicePixelRatio:0,
  captures:[],
  actionability:{quickMemo:false,tools:false},
  shutdown:{browserCloseSent:false,wrapperExited:false},
  violations:[],
  verdict:'FAIL',
  error:null,
};

const isolatedAppData=join(qaRoot,'appdata'),isolatedLocalAppData=join(qaRoot,'localappdata');
await mkdir(isolatedAppData,{recursive:true});await mkdir(isolatedLocalAppData,{recursive:true});
const launch=()=>spawn(executable,[`--remote-debugging-port=${port}`],{
  cwd:process.cwd(),
  env:{...process.env,APPDATA:isolatedAppData,LOCALAPPDATA:isolatedLocalAppData,ELECTRON_P0_TEST_RUN:qaRun,ELECTRON_P0_QA_ROOT:qaRoot,ELECTRON_P0_DEV_URL:''},
  stdio:['ignore','pipe','pipe'],
  windowsHide:false,
});
const osAppData=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',"[Environment]::GetFolderPath('ApplicationData')"],{env:{...process.env,APPDATA:isolatedAppData},encoding:'utf8'}).trim();
if(resolve(osAppData).toLowerCase()!==resolve(isolatedAppData).toLowerCase())throw Error('BLOCKED before launch: Windows appData does not use the isolated root; no GUI QA permitted');
let child=launch();
child.stdout.on('data',chunk=>process.stdout.write(chunk));
child.stderr.on('data',chunk=>process.stderr.write(chunk));

let browser;
let browserSession;
const delay=ms=>new Promise(resolveDelay=>setTimeout(resolveDelay,ms));
const closeBrowser=async()=>{
  if(!browserSession||result.shutdown.browserCloseSent)return;
  result.shutdown.browserCloseSent=true;
  await Promise.race([
    browserSession.send('Browser.close').catch(()=>undefined),
    delay(3000),
  ]);
};
const waitForCdp=async()=>{
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error(`Portable wrapper exited before CDP: ${child.exitCode}`);
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/version`);
      if(response.ok)return;
    }catch(error){
      if(!(error instanceof TypeError))throw error;
    }
    await delay(250);
  }
  throw new Error('Timed out waiting for Portable Electron CDP');
};
const waitForWrapperExit=async()=>{
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    if(child.exitCode!==null){
      if(child.exitCode!==0)throw new Error(`Portable wrapper exit ${child.exitCode}`);
      return;
    }
    await delay(100);
  }
  throw new Error('Portable wrapper did not exit after Browser.close');
};

const pngSize=buffer=>({
  width:buffer.readUInt32BE(16),
  height:buffer.readUInt32BE(20),
});
const setWindowBounds=(width,height)=>{
  const helper=join(dirname(fileURLToPath(import.meta.url)),'td2-window.ps1');
  const output=execFileSync('pwsh',['-NoProfile','-File',helper,'-ExecutableRoot',process.env.TEMP??'','-Width',String(width),'-Height',String(height)],{encoding:'utf8'});
  return JSON.parse(output);
};

try{
  await waitForCdp();
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  browserSession=await browser.newBrowserCDPSession();
  const context=browser.contexts()[0];
  if(!context)throw new Error('Portable Electron exposed no browser context');
  const page=context.pages().find(candidate=>candidate.url().startsWith('file:'))??context.pages()[0];
  if(!page)throw new Error('Portable Electron exposed no renderer page');
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('navigation',{name:'주요 기능'}).waitFor({state:'visible'});
  const initialSetup=page.getByRole('dialog',{name:'학교 초기 설정'});
  if(await initialSetup.isVisible())await initialSetup.getByRole('button',{name:'나중에 설정'}).click();

  const info=await page.evaluate(()=>window.electronP0.info());
  if(info.sourceSha!==expectedSha)throw new Error(`Source SHA mismatch: ${info.sourceSha}`);
  const expectedUserData=join(isolatedAppData,'BOGUNON-DESK-ELECTRON-P0','test-runs',qaRun).toLowerCase();
  if(info.userData.toLowerCase()!==expectedUserData)throw new Error(`Unexpected userData: ${info.userData}`);
  result.actualUserData=info.userData;
  result.devicePixelRatio=await page.evaluate(()=>devicePixelRatio);

  browserSession=await browser.newBrowserCDPSession();
  for(const [width,height] of [[1440,900],[1280,800],[980,700]]){
    const nativeBounds=setWindowBounds(width,height);
    await page.waitForFunction(([targetWidth,targetHeight])=>Math.abs(outerWidth-targetWidth)<=2&&Math.abs(outerHeight-targetHeight)<=2,[width,height]);
    await page.waitForTimeout(300);
    const layout=await page.evaluate(()=>{
      const dashboard=document.querySelector('.workspace-dashboard');
      const dock=document.querySelector('.dock-zone');
      const calendar=document.querySelector('[data-widget-type="monthly-calendar"]');
      if(!(dashboard instanceof HTMLElement)||!(dock instanceof HTMLElement))throw new Error('Dashboard or Dock missing');
      const mainRect=dashboard.getBoundingClientRect();
      const dockRect=dock.getBoundingClientRect();
      dashboard.scrollTop=dashboard.scrollHeight;
      return {
        innerWidth,innerHeight,outerWidth,outerHeight,
        documentOverflow:document.documentElement.scrollWidth>innerWidth+1,
        dashboardOverflow:dashboard.scrollWidth>dashboard.clientWidth+2,
        workspaceVerticalOverflow:dashboard.scrollHeight>dashboard.clientHeight+2,
        calendarNestedScroll:calendar instanceof HTMLElement&&[calendar,...calendar.querySelectorAll('*')].some(element=>{
          if(!(element instanceof HTMLElement))return false;
          const overflowY=getComputedStyle(element).overflowY;
          return (overflowY==='auto'||overflowY==='scroll')&&element.scrollHeight>element.clientHeight+2;
        }),
        scrollBottomReachable:dashboard.scrollTop+dashboard.clientHeight>=dashboard.scrollHeight-2,
        dockVisible:dockRect.width>0&&dockRect.height>0&&dockRect.top<innerHeight&&dockRect.bottom<=innerHeight+1,
        overlap:mainRect.bottom>dockRect.top+1,
      };
    });
    await page.locator('.workspace-dashboard').evaluate(element=>{element.scrollTop=0;});
    const screenshot=await page.screenshot({path:join(screenshots,`td2-${width}x${height}.png`)});
    result.captures.push({requested:{width,height},nativeBounds,png:pngSize(screenshot),layout});
    if(layout.documentOverflow||layout.dashboardOverflow||layout.workspaceVerticalOverflow||layout.calendarNestedScroll||!layout.scrollBottomReachable||!layout.dockVisible||layout.overlap){
      result.violations.push(`Layout contract failed at ${width}x${height}: ${JSON.stringify(layout)}`);
    }
  }

  const dock=page.getByRole('navigation',{name:'주요 기능'});
  const quickMemo=dock.getByRole('button',{name:'빠른 메모',exact:true});
  await quickMemo.click();
  await page.getByRole('dialog',{name:'빠른 메모',exact:true}).waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  await quickMemo.waitFor({state:'visible'});
  result.actionability.quickMemo=true;

  const tools=dock.getByRole('button',{name:'업무 도구',exact:true});
  await tools.click();
  await page.getByRole('dialog',{name:'업무 도구',exact:true}).waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  await tools.waitFor({state:'visible'});
  result.actionability.tools=true;

  // Read-only packaged IPC checks: never sign in or make provider requests.
  result.packagedIpc=await page.evaluate(async()=>{
    const w=window.electronWork;
    const calls={chatgpt:()=>w.chatgpt.status(),finance:()=>w.finance.status(),finder:()=>w.educationVideo.searchProvider.status(),ai:()=>w.ai.status(),inventory:()=>w.inventory.load(),school:()=>w.school.load(),admin:()=>w.admin.load(),purchaseAi:()=>w.purchase.images.ai.connections()};
    const out={};
    for(const [name,call] of Object.entries(calls)){const r=await call();if(!r.ok)throw Error('Packaged IPC failed: '+name);out[name]='PASS (status/load only; no service calls)';}
    return out;
  });
  result.moduleButtons=await dock.getByRole('button').allTextContents();
  result.moduleGui={};
  const reset=async()=>{await page.reload();await dock.waitFor({state:'visible'});};
  const modules=[['school-admin','학교 행정 업무 도우미'],['finance','MY FINANCE · 암호화 로컬'],['purchase','품의 도우미 · 세션 전용'],['finder','교육영상 Finder · 합성 Mock'],['official','공문작업실 · 로컬 초안'],['inventory','물품관리 — 로컬 저장']];
  for(const [name,label] of modules){
    try{await reset();await dock.getByRole('button',{name:'업무 도구',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click({timeout:10000});await page.waitForTimeout(1000);await page.screenshot({path:join(screenshots,`module-${name}.png`)});result.moduleGui[name]='PASS: opened and captured only; remaining functional flows NOT RUN';}
    catch{result.moduleGui[name]='FAIL: could not open/capture';}
  }
  await reset();
  const synthetic=await page.evaluate(async()=>{
    const w=window.electronWork;const current=await w.inventory.load();if(!current.ok||current.data.document!==null)throw Error('Expected empty isolated inventory');
    const doc={version:1,items:[{itemId:'qa-item',name:'합성 QA 물품',baseUnit:'개',recommendedStock:2}],lots:[],movements:[],updatedAt:new Date().toISOString()};
    const save=await w.inventory.save(doc,null);if(!save.ok)throw Error('Synthetic inventory save failed');return save.data.document.updatedAt;
  });
  result.inventoryPersistence='saved; restart pending';
  await closeBrowser();await waitForWrapperExit();await browser.close();browser=undefined;browserSession=undefined;
  result.shutdown.browserCloseSent=false;child=launch();child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});
  await waitForCdp();browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);browserSession=await browser.newBrowserCDPSession();
  const restoredPage=browser.contexts()[0].pages().find(p=>p.url().startsWith('file:'));
  await restoredPage.waitForLoadState('domcontentloaded');
  await restoredPage.waitForFunction(()=>!!window.electronWork);
  const restored=await restoredPage.evaluate(async()=>{const info=await window.electronP0.info();const r=await window.electronWork.inventory.load();return {userData:info.userData,ok:r.ok&&r.data.document?.items.some(i=>i.itemId==='qa-item')};});
  if(!restored.ok||restored.userData!==result.actualUserData)throw Error('Isolated inventory restart failed');
  result.inventoryPersistence='PASS: synthetic item saved and restored across actual Portable restart';

  await closeBrowser();
  await waitForWrapperExit();
  result.shutdown.wrapperExited=true;
  result.verdict=result.violations.length?'PARTIAL':'PASS';
  result.remaining=['Existing small-card/Quick Memo/Launcher PARTIAL requires manual review','OS DPI 125/150 NOT RUN','Actual credentials, paid AI, YouTube requests and school login NOT RUN'];
}catch(error){
  result.error=error instanceof Error?error.stack??error.message:String(error);
  throw error;
}finally{
  await closeBrowser();
  if(browser){try{await browser.close();}catch{}}
  await writeFile(join(evidenceRoot,'portable-gui-result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}
