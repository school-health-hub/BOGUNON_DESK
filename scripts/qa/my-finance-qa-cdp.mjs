// CI-only actual installed WebView/IPC probe; never supplies real finance data.
import fs from "node:fs";
import { discoverPage } from "./my-finance-cdp-discovery.mjs";
if (process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_ENVIRONMENT !== "github-hosted") throw Error("Disposable GitHub runner only");
const [port, mode, output] = process.argv.slice(2);
const delay = ms => new Promise(r=>setTimeout(r,ms));
const { page, evidence } = await discoverPage(port);
fs.writeFileSync(output + '.discovery.json', JSON.stringify(evidence, null, 2));
if (!page) throw Error('Installed WebView debug target unavailable: ' + JSON.stringify(evidence));
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let id=0;const pending=new Map();const outbound=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result)}if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url)&&!m.params.request.url.startsWith('http://tauri.localhost')&&!m.params.request.url.startsWith('http://ipc.localhost'))outbound.push(m.params.request.url)};
const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error('Installed QA probe failed: '+r.result?.description);return r.result.value;};
try {
 await call('Runtime.enable');await call('Network.enable');await call('Page.enable');
 for(let i=0;i<60;i++){if(await evaluate('!!window.__TAURI_INTERNALS__'))break;await delay(300);}
 if(mode==='operating') {
  await evaluate(`localStorage.setItem('bogunon.synthetic.operating-work.v1','SYNTHETIC PRESERVE THIS WORK');true`);
  fs.writeFileSync(output,JSON.stringify({syntheticOperatingWorkSeeded:true}));
 } else {
  const info=await evaluate(`window.__TAURI_INTERNALS__.invoke('my_finance_qa_info')`);
  if(info.identifier!=='kr.sungandi.schoolhealthdesk.myfinanceqa'||[info.loginEnabled,info.updaterEnabled,info.deepLinkEnabled,info.autostartEnabled,info.trayEnabled].some(Boolean))throw Error('Native isolation mismatch');
  const sourceSha=process.env.QA_EXPECTED_SOURCE_SHA;
  if(info.sourceSha!==sourceSha||!info.localData.endsWith('kr.sungandi.schoolhealthdesk.myfinanceqa')||!info.settingsData.endsWith('kr.sungandi.schoolhealthdesk.myfinanceqa'))throw Error('Wrong native build/data path');
  for(const command of ['plugin:updater|check','plugin:deep-link|get_current','set_autostart_enabled','get_autostart_enabled','secure_session_get','secure_session_set','open_auth_url','chatgpt_start_sign_in']) {
   const denied=await evaluate(`(async()=>{try{await window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)});return false}catch(error){return /not found|unknown (command|plugin)|not allowed|permission.*denied|not permitted/i.test(String(error))}})()`);
   if(!denied)throw Error('Non-finance native command was not denied: '+command);
  }
  for(let i=0;i<60;i++){if(await evaluate(`!!document.querySelector('.finance-qa-banner details')`))break;await delay(300);}
  const fixture=JSON.parse(fs.readFileSync('src/my-finance/fixtures/cross-pc-synthetic.json','utf8'));
  // The first installed launch writes through real Tauri CRUD; reinstall must
  // read the very same encrypted local data without seeding it again.
  const initial=await evaluate(`window.__TAURI_INTERNALS__.invoke('my_finance_list_income')`);
  if(mode==='qa-seed') {
   if(initial.income.length)throw Error('QA store must start empty');
   const entries=[...fixture.schoolIncome];entries[1]=fixture.homeUpdate;entries.push(fixture.homeCreate);
   for(const entry of entries)await evaluate(`(async()=>{const s=await window.__TAURI_INTERNALS__.invoke('my_finance_list_income');await window.__TAURI_INTERNALS__.invoke('my_finance_create_income',{expected:s.identity,entry:${JSON.stringify(entry)}});return true})()`);
  } else if(initial.income.length!==4)throw Error('QA reinstall lost financial data');
  const snapshot=await evaluate(`window.__TAURI_INTERNALS__.invoke('my_finance_list_income')`);
  if(snapshot.income.length!==4)throw Error('Wrong native income count');
  for(let i=0;i<60;i++){if(await evaluate(`!!document.querySelector('[aria-label="최신 목록 새로고침"]') && !document.querySelector('[aria-label="최신 목록 새로고침"]').disabled`))break;await delay(300);}
  await evaluate(`document.querySelector('[aria-label="최신 목록 새로고침"]').click();true`);
  for(let i=0;i<60;i++){if(await evaluate(`!document.querySelector('[aria-label="최신 목록 새로고침"]').disabled`))break;await delay(300);}
  await evaluate(`(()=>{const year=document.querySelector('.finance-filters select');year.value='2026';year.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await delay(250);
  const ui=await evaluate(`({banner:document.querySelector('.finance-qa-banner').textContent,summary:document.querySelector('.finance-summary').textContent,hasOperatingUi:!!document.querySelector('[data-finance-launcher]')})`);
  if(!ui.banner.includes('합성 데이터 전용')||ui.hasOperatingUi||!['1,350,000원','40,500원','1,309,500원','1건'].every(x=>ui.summary.includes(x)))throw Error('Installed finance-only UI/summary mismatch');
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(output+'.png',Buffer.from(shot.data,'base64'));
  if(outbound.length)throw Error('External request from QA WebView');
  fs.writeFileSync(output,JSON.stringify({info,mode,records:snapshot.income.length,revision:snapshot.identity.revision,expectedAnnual:fixture.expectedAnnual,blockedNativeIntegrations:true,externalRequests:outbound.length},null,2));
 }
} finally {ws.close();}
