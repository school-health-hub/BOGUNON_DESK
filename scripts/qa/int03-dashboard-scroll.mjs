import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

// A real Windows Electron regression, not a CSS-string assertion or DPR simulation.
assert.equal(process.platform,'win32');
const source=resolve(process.env.INT03_APP_SOURCE??process.cwd());
assert.ok(process.env.INT03_EVIDENCE_ROOT,'Explicit isolated evidence directory required');
const output=resolve(process.env.INT03_EVIDENCE_ROOT);
const allowedRoot=resolve(process.env.INT03_QA_ROOT??'..');
const outputRelative=relative(allowedRoot,output);
assert.ok(outputRelative&&!outputRelative.startsWith('..')&&!isAbsolute(outputRelative),'Evidence must stay beneath the approved QA root');
const sourceRelative=relative(source,output);
assert.ok(sourceRelative==='..'||sourceRelative.startsWith('..'+sep),'Keep QA evidence outside the source checkout');
const temp=join(output,'runner-temp');
const profile=join(temp,'profile');
const runId=randomUUID();
await mkdir(profile,{recursive:true});
const report={sourceSha:execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),states:[],errors:[],cleanup:false};
let app;

function measure(){
 const dashboard=document.querySelector('.workspace-dashboard');
 const grid=document.querySelector('.desktop-widget-grid');
 if(!(dashboard instanceof HTMLElement)||!(grid instanceof HTMLElement))throw new Error('Dashboard not rendered');
 const widgets=[...grid.querySelectorAll(':scope > [data-widget-type]')].map(element=>{
  const box=element.getBoundingClientRect(),style=getComputedStyle(element);
  return {type:element.getAttribute('data-widget-type'),left:box.left,right:box.right,width:box.width,transform:style.transform,transition:style.transition};
 });
 return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},pageOverflow:document.documentElement.scrollWidth-innerWidth,
  dashboard:{clientWidth:dashboard.clientWidth,scrollWidth:dashboard.scrollWidth,overflow:dashboard.scrollWidth-dashboard.clientWidth,scrollLeft:dashboard.scrollLeft},
  grid:{clientWidth:grid.clientWidth,scrollWidth:grid.scrollWidth},widgets};
}

try{
 app=await electron.launch({executablePath:join(source,'node_modules/electron/dist/electron.exe'),args:[join(source,'build/electron-p0-app')],chromiumSandbox:true,
  env:{...process.env,ELECTRON_P0_DEV_URL:'',ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:profile,ELECTRON_P0_TEST_RUN:runId,RUNNER_TEMP:temp,TEMP:temp,TMP:temp,NODE_ENV:'production'}});
 const page=await app.firstWindow();
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.getByRole('button',{name:'나중에 설정',exact:true}).click();
 const info=await page.evaluate(()=>window.electronP0.info());
 assert.equal(resolve(info.userData),join(profile,'test-runs',runId,'user-data'),'Only the isolated QA UUID profile may be used');
 report.profile=info.userData;
 report.native=await app.evaluate(({screen,BrowserWindow})=>({scale:screen.getPrimaryDisplay().scaleFactor,zoom:BrowserWindow.getAllWindows()[0].webContents.getZoomFactor(),bounds:screen.getPrimaryDisplay().bounds}));
 assert.equal(report.native.scale,1,'This exact content-viewport matrix runs at actual Windows100%');
 assert.equal(report.native.zoom,1);
 const before=await page.evaluate(()=>window.electronP0.readSettings());
 for(const mode of ['view','edit']){
  if(mode==='edit')await page.getByRole('button',{name:'화면 꾸미기',exact:true}).click();
  for(const [width,height]of [[1440,900],[1366,768],[1280,720],[980,700]]){
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
   await expect.poll(()=>page.evaluate(()=>[innerWidth,innerHeight])).toEqual([width,height]);
   const timeline=[];
   const started=performance.now();
   for(const delay of [0,50,150,300]){
    if(delay)await page.waitForTimeout(delay);
    const dom=await page.evaluate(measure);
    timeline.push({waitIncrementMs:delay,elapsedMs:performance.now()-started,dom});
   }
   const dom=await page.evaluate(measure);
   const bytes=await page.screenshot();
   const file=`${mode}-${width}x${height}.png`;
   await writeFile(join(output,file),bytes);
   report.states.push({mode,file,sha256:createHash('sha256').update(bytes).digest('hex'),dom,timeline});
  }
 }
 assert.deepEqual(await page.evaluate(()=>window.electronP0.readSettings()),before,'Mount, mode and viewport changes must not rewrite saved settings');
 report.settingsUnchanged=true;
 const overflowing=report.states.flatMap(state=>state.timeline.filter(sample=>sample.dom.dashboard.overflow>1||sample.dom.pageOverflow>1).map(sample=>({mode:state.mode,viewport:sample.dom.viewport,elapsedMs:sample.elapsedMs,overflow:sample.dom.dashboard.overflow})));
 report.overflowing=overflowing;
 assert.deepEqual(overflowing,[],'Viewport reflow must not animate widgets outside the horizontal workspace');
 assert.deepEqual(report.errors,[]);
 report.verdict='PASS';
}catch(error){
 report.verdict='FAIL';report.failure=String(error);process.exitCode=1;
}finally{
 if(app)await app.close();
 report.cleanup=true;
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({verdict:report.verdict,states:report.states.length,overflowing:report.overflowing?.length,cleanup:report.cleanup}));
