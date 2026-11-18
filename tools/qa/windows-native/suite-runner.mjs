import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {freemem} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const {chromium,expect}=await import(pathToFileURL(join(process.env.QA_SOURCE_PATH,'node_modules/playwright/test.mjs')).href);
import {createNative} from './native-client.mjs';
import {suite,planned} from './suite.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),run=randomUUID(),port=Number(process.env.QA_CDP_PORT??15448);
const exe=process.env.QA_PORTABLE_PATH;
const sha=b=>createHash('sha256').update(b).digest('hex'),temp=join(root,'temp'),profile=join(temp,'profile');
const env={...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,RUNNER_TEMP:temp,NODE_COMPILE_CACHE:join(temp,'node-cache'),ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:profile,ELECTRON_P0_TEST_RUN:run,ELECTRON_P0_DEV_URL:''};
const report={run,root,started:new Date().toISOString(),sourceSha:'d03a58fa7f73411aa2cdb9ebd31c0d8527e21947',checks:[],status:'RUNNING',resources:[]};
const record=()=>fs.writeFile(join(root,'results/summary.json'),JSON.stringify(report,null,2));
let child,browser,page,ctx;
async function resource(){const c=await fs.statfs('C:/'),sample={at:new Date().toISOString(),cFree:c.bavail*c.bsize,ramAvailable:freemem()};report.resources.push(sample);assert(sample.cFree>1024**3);assert(sample.ramAvailable>750*1024**2);}
async function step(name,fn){const item={name,status:'RUNNING',started:new Date().toISOString()};report.checks.push(item);await resource();await record();try{item.value=await fn();item.status='PASS';await page.screenshot({path:join(root,'screenshots',`stage-${String(report.checks.length).padStart(2,'0')}.png`)});}catch(error){item.status='FAIL';item.error=String(error.stack??error);throw error;}finally{item.finished=new Date().toISOString();await record();}}
try{
 await resource();assert(freemem()>1500*1024**2);report.portableSha256=sha(await fs.readFile(exe));assert.equal(report.portableSha256,'2050489bc1e1b5e980b9aa1c0846b2771612eca7000ef99ec773fc9bf4c19b90');
 report.scriptHashes={};for(const name of ['suite-runner.mjs','suite.mjs','native-client.mjs','native-dialog.ps1'])report.scriptHashes[name]=sha(await fs.readFile(join(root,'control',name)));
 const guard=createServer();await new Promise((r,j)=>{guard.once('error',j);guard.listen(port,'127.0.0.1',r);});await new Promise(r=>guard.close(r));
 await fs.mkdir(profile,{recursive:true});child=spawn(exe,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1'],{env,cwd:temp,stdio:'ignore',windowsHide:false});report.launcherPid=child.pid;await record();
 let ready=false;for(let i=0;i<180;i++){assert.equal(child.exitCode,null);try{const r=await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await delay(1000);}assert(ready,'Portable CDP readiness deadline');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{timeout:90000});page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(30000);
 await page.waitForFunction(()=>typeof window.electronP0?.info==='function');const info=await page.evaluate(()=>window.electronP0.info());assert.equal(info.sourceSha,report.sourceSha);assert(info.qaProfile);assert(info.userData.toLowerCase().replaceAll('\\','/').startsWith(profile.toLowerCase().replaceAll('\\','/')+'/'));
 page.on('dialog',()=>{}); // Observe only: physical Native confirmation is handled through UIAutomation.
 await page.getByRole('button',{name:'나중에 설정',exact:true}).click({timeout:30000});
 ctx={root,run,page,expect,native:createNative(root,child.pid)};
 ctx.openTool=async name=>{await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:'업무 도구',exact:true}).click();const menu=page.getByRole('dialog',{name:'업무 도구',exact:true});await menu.getByRole('searchbox',{name:'업무 도구 검색'}).fill(name);await menu.getByRole('button',{name,exact:true}).click();};
 report.owner=await ctx.native('discover','owner');report.outputs=await suite(ctx,step);report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack??error);if(page)try{await page.screenshot({path:join(root,'screenshots/failure.png'),timeout:5000});}catch{}if(ctx)try{report.pendingNative=await ctx.native('list','failure-native');}catch{}}
finally{
 report.notRun=planned.filter(name=>!report.checks.some(c=>c.name===name));
 if(page&&!page.isClosed())try{await page.close({runBeforeUnload:false});}catch(error){report.closeError=String(error.message);}
 if(browser)try{await browser.close();}catch{}
 if(child){for(let i=0;i<90&&child.exitCode===null;i++)await delay(500);report.exitCode=child.exitCode;report.ownedAppClosed=child.exitCode!==null;}
 if(report.status==='PASS'&&!report.ownedAppClosed)report.status='CONDITIONAL';
 report.finished=new Date().toISOString();await record();console.log(JSON.stringify(report,null,2));
}
if(report.status!=='PASS')process.exitCode=1;
