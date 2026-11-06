// The same direct Electron + loopback CDP/Node inspector method as prior Windows QA.
// This changes the test launcher only, never Main/Preload or sandbox preferences.
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function launchQaElectron(options){
 const env={...options.env,APPDATA:join(options.env.ELECTRON_P0_QA_ROOT,'launch-appdata'),LOCALAPPDATA:join(options.env.ELECTRON_P0_QA_ROOT,'launch-localappdata')};
 delete env.ELECTRON_RUN_AS_NODE;
 await mkdir(env.APPDATA,{recursive:true});await mkdir(env.LOCALAPPDATA,{recursive:true});
 const child=spawn(options.executablePath,[...options.args,'--remote-debugging-port=19237','--inspect=127.0.0.1:19238'],{env,stdio:['ignore','pipe','pipe'],windowsHide:false});
 let stderr='',launchError;child.on('error',e=>launchError=e);child.stderr.on('data',b=>{stderr=(stderr+b).slice(-16000);});child.stdout.on('data',()=>{});
 const log=()=>writeFile(join(env.TD2_REVIEW_DIR,'native-launch.log'),stderr.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[JWT REDACTED]'));
 let endpoints;
 for(let i=0;i<200;i++){
  if(launchError||child.exitCode!==null){await log();throw Error('Native QA Electron launch exited: '+String(launchError??child.exitCode)+'; see native-launch.log');}
  try{endpoints=await(await fetch('http://127.0.0.1:19238/json/list')).json();await fetch('http://127.0.0.1:19237/json/version');break;}catch{await sleep(150);}
 }
 if(!endpoints?.length){await log();throw Error('Native QA debugger startup timed out');}
 const ws=new WebSocket(endpoints[0].webSocketDebuggerUrl);await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',bad,{once:true});});
 let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);pending.get(m.id)?.(m);pending.delete(m.id);});
 const evaluate=async(fn,arg)=>{const id=++seq;const m=await new Promise((ok,bad)=>{const t=setTimeout(()=>{pending.delete(id);bad(Error('Native QA Main observation timed out'));},15000);pending.set(id,v=>{clearTimeout(t);ok(v);});const expression=`(async()=>{const e=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');return await (${fn.toString()})(e,${JSON.stringify(arg)??'undefined'});})()`;ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});if(m.error||m.result?.exceptionDetails)throw Error('Native QA Main observation failed');return m.result.result.value;};
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19237');let closed=false;
 return{
  process:()=>child,evaluate,windows:()=>browser.contexts().flatMap(c=>c.pages()),
  async firstWindow(){for(let i=0;i<200;i++){const p=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('file:'));if(p)return p;await sleep(100);}throw Error('Actual Electron file window missing');},
  async close(){if(closed)return;closed=true;await evaluate(({app,Menu})=>{const item=Menu.getApplicationMenu()?.items[0]?.submenu?.items.find(i=>i.label==='완전 종료');if(item)item.click();else app.quit();return true;});ws.close();for(let i=0;i<100&&child.exitCode===null;i++)await sleep(100);await log();await browser.close().catch(()=>{});if(child.exitCode===null)throw Error('QA Electron did not exit normally');}
 };
}
