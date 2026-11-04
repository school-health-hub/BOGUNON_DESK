import {chromium} from '@playwright/test';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const expectedSha=process.env.TD2_EXPECTED_SOURCE_SHA;
const executable=process.env.TD2_PORTABLE_EXE;
const evidenceRoot=process.env.TD2_EVIDENCE_ROOT;
const qaRoot=process.env.ELECTRON_P0_QA_ROOT;
if(!expectedSha||!executable||!evidenceRoot||!qaRoot)throw new Error('Missing TD2 QA environment');

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
  verdict:'FAIL',
  error:null,
};

const child=spawn(executable,[`--remote-debugging-port=${port}`],{
  cwd:process.cwd(),
  env:{...process.env,ELECTRON_P0_TEST_RUN:qaRun,ELECTRON_P0_QA_ROOT:qaRoot,ELECTRON_P0_DEV_URL:''},
  stdio:['ignore','pipe','pipe'],
  windowsHide:false,
});
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
  const expectedUserData=`${qaRoot}\\test-runs\\${qaRun}\\user-data`.toLowerCase();
  if(info.userData.toLowerCase()!==expectedUserData)throw new Error(`Unexpected userData: ${info.userData}`);
  result.actualUserData=info.userData;
  result.devicePixelRatio=await page.evaluate(()=>devicePixelRatio);

  browserSession=await browser.newBrowserCDPSession();
  for(const [width,height] of [[1440,900],[1280,800]]){
    const nativeBounds=setWindowBounds(width,height);
    await page.waitForFunction(([targetWidth,targetHeight])=>Math.abs(outerWidth-targetWidth)<=2&&Math.abs(outerHeight-targetHeight)<=2,[width,height]);
    await page.waitForTimeout(300);
    const layout=await page.evaluate(()=>{
      const dashboard=document.querySelector('.workspace-dashboard');
      const dock=document.querySelector('.dock-zone');
      if(!(dashboard instanceof HTMLElement)||!(dock instanceof HTMLElement))throw new Error('Dashboard or Dock missing');
      const mainRect=dashboard.getBoundingClientRect();
      const dockRect=dock.getBoundingClientRect();
      dashboard.scrollTop=dashboard.scrollHeight;
      return {
        innerWidth,innerHeight,outerWidth,outerHeight,
        documentOverflow:document.documentElement.scrollWidth>innerWidth+1,
        dashboardOverflow:dashboard.scrollWidth>dashboard.clientWidth+2,
        scrollBottomReachable:dashboard.scrollTop+dashboard.clientHeight>=dashboard.scrollHeight-2,
        dockVisible:dockRect.width>0&&dockRect.height>0&&dockRect.top<innerHeight&&dockRect.bottom<=innerHeight+1,
        overlap:mainRect.bottom>dockRect.top+1,
      };
    });
    if(layout.documentOverflow||layout.dashboardOverflow||!layout.scrollBottomReachable||!layout.dockVisible||layout.overlap){
      throw new Error(`Layout contract failed at ${width}x${height}: ${JSON.stringify(layout)}`);
    }
    await page.locator('.workspace-dashboard').evaluate(element=>{element.scrollTop=0;});
    const screenshot=await page.screenshot({path:join(screenshots,`td2-${width}x${height}.png`)});
    result.captures.push({requested:{width,height},nativeBounds,png:pngSize(screenshot),layout});
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

  await closeBrowser();
  await waitForWrapperExit();
  result.shutdown.wrapperExited=true;
  result.verdict='PASS';
}catch(error){
  result.error=error instanceof Error?error.stack??error.message:String(error);
  throw error;
}finally{
  await closeBrowser();
  if(browser){try{await browser.close();}catch{}}
  await writeFile(join(evidenceRoot,'portable-gui-result.json'),JSON.stringify(result,null,2));
}
