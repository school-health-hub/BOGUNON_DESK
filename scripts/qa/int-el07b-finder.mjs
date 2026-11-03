// QA only: attach to the original Portable; never launch a replacement or change download policy.
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const require=createRequire(resolve('.qa-runtime/package.json')),{chromium}=require('playwright');
const out=process.env.INT_EL05H_OUTPUT,files=join(out,'finder-files');await mkdir(files,{recursive:true});
const report={sourceSha:'c06ce6a910002cc7658a5545e23e0d3ed914d377',verdict:'BLOCKED',events:[],images:[],cancel:'NOT RUN',failureInjection:'NOT RUN',reimport:'NOT RUN'};
const hash=b=>createHash('sha256').update(b).digest('hex');
const assert=(v,m)=>{if(!v)throw Error(m)};
let browser,page,mainSocket,mainEval,observing=false;
// Inspect only windows belonging to the already verified Electron PID. Native dialogs are cancelled, never accepted blindly.
function nativeDialogs(cancel=false){
 const script=`
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class FinderWindows {
 public delegate bool Callback(IntPtr h,IntPtr l);
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb,IntPtr l);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 public static string[] Observe(uint owner,bool cancel) {var result=new List<string>();EnumWindows((h,l)=>{uint pid;GetWindowThreadProcessId(h,out pid);var c=new StringBuilder(256);GetClassName(h,c,256);if(pid==owner&&IsWindowVisible(h)&&c.ToString()=="#32770"){var t=new StringBuilder(1024);GetWindowText(h,t,1024);result.Add(t.ToString());if(cancel)PostMessage(h,0x10,IntPtr.Zero,IntPtr.Zero);}return true;},IntPtr.Zero);return result.ToArray();}
}
'@
$p=Get-CimInstance Win32_Process -Filter "ProcessId=$env:INT_EL05H_PID"
if(-not $p -or $p.ExecutablePath -ne $env:INT_EL05H_APP_PATH){throw 'Portable process identity changed'}
ConvertTo-Json -InputObject @([FinderWindows]::Observe([uint32]$env:INT_EL05H_PID,($env:QA_CANCEL -eq '1'))) -Compress
`;
 const r=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',timeout:10000,env:{...process.env,QA_CANCEL:cancel?'1':'0'}});
 assert(!r.error&&r.status===0,'Native dialog observation failed: '+(r.error?.message||r.stderr));return JSON.parse(r.stdout.trim());
}
async function capture(file){const path=join(out,file);await page.screenshot({path});report.images.push({file,sha256:hash(await readFile(path))});}
async function attachMain(){
 const url=process.env.INT_EL07B_INSPECTOR;assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(url),'Owned loopback Node inspector required');
 const targets=await (await fetch(url+'/json/list',{redirect:'error',signal:AbortSignal.timeout(3000)})).json();
 const target=targets.find(t=>t.type==='node');assert(target&&new URL(target.webSocketDebuggerUrl).hostname==='127.0.0.1','Node inspector target mismatch');
 mainSocket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('Inspector connect timeout')),5000);mainSocket.addEventListener('open',()=>{clearTimeout(timer);ok()},{once:true});mainSocket.addEventListener('error',()=>{clearTimeout(timer);no(Error('Inspector connection failed'))},{once:true});});
 let id=0;const pending=new Map();mainSocket.addEventListener('message',event=>{const r=JSON.parse(String(event.data));if(pending.has(r.id)){pending.get(r.id)(r);pending.delete(r.id)}});
 mainEval=async expression=>{const n=++id;const r=await new Promise((ok,no)=>{const t=setTimeout(()=>{pending.delete(n);no(Error('Inspector evaluation timeout'))},5000);pending.set(n,r=>{clearTimeout(t);ok(r)});mainSocket.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});assert(!r.error&&!r.result?.exceptionDetails,'Inspector observation failed: '+JSON.stringify(r.error||r.result?.exceptionDetails));return r.result.result.value;};
 const main=await mainEval('({pid:process.pid,exe:process.execPath})');assert(main.pid===Number(process.env.INT_EL05H_PID)&&main.exe.toLowerCase()===process.env.INT_EL05H_APP_PATH.toLowerCase(),'Inspector is not owned Portable Main');
 report.main=main;
 await mainEval(`(async()=>{const {session}=process.getBuiltinModule('module').createRequire(process.execPath)('electron');const s=session.fromPartition('persist:electron-p0');globalThis.__finderQa={events:[],session:s};globalThis.__finderQa.listener=(event)=>{globalThis.__finderQa.events.push({at:new Date().toISOString(),prevented:event.defaultPrevented===true});};s.on('will-download',globalThis.__finderQa.listener);s.setDownloadPath(${JSON.stringify(resolve(files))});return true;})()`);observing=true;
}
try{
 assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.INT_EL05H_ENDPOINT),'Renderer loopback required');
 browser=await chromium.connectOverCDP(process.env.INT_EL05H_ENDPOINT,{timeout:15000});page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/resources/app.asar/renderer/index.html'));assert(page,'Original Portable renderer missing');page.setDefaultTimeout(10000);
 const info=await page.evaluate(()=>window.electronP0.info());assert(info.sourceSha===report.sourceSha&&info.userData.includes(process.env.INT_EL05H_PROFILE),'Product/profile mismatch');
 await attachMain();
 await page.getByRole('navigation',{name:'주요 기능'}).getByRole('button',{name:'업무 도구',exact:true}).click();await page.getByRole('button',{name:'교육영상 Finder · 합성 Mock',exact:true}).click();
 await page.getByLabel('교육 주제',{exact:true}).fill('합성 손씻기 교육');await page.getByLabel('검색 대상',{exact:true}).fill('합성 QA 대상');await page.getByRole('button',{name:'Mock 영상 검색',exact:true}).click();
 for(const index of [0,1]){
  await page.locator('.ev-result').nth(index).getByRole('button',{name:/선택/}).click();
  await page.getByLabel('교육 일시 또는 시청 기간',{exact:true}).fill('합성 QA 일정');await page.getByLabel('안내사항',{exact:true}).fill('합성 데이터만 사용합니다.');await page.getByRole('button',{name:'안내문 생성',exact:true}).click();await page.getByRole('button',{name:'라이브러리 저장',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ev-notice')?.textContent==='독립 라이브러리에 저장했습니다.');
 }
 const before=await page.evaluate(()=>window.electronWork.educationVideo.load());assert(before.ok&&before.data.library.items.length===2,'Synthetic library setup failed');
 report.libraryBefore=before.data.library;await writeFile(join(out,'library-before.json'),JSON.stringify(before.data.library,null,2));
 report.diskBefore=await mainEval(`(async()=>{const fs=process.getBuiltinModule('fs/promises');const p=process.getBuiltinModule('path');return fs.readFile(p.join(${JSON.stringify(info.userData)},'work-data','education-video','library.json'),'utf8');})()`);
 await capture('finder-before-export.png');report.clickAt=new Date().toISOString();await page.getByRole('button',{name:'내보내기',exact:true}).click();report.buttonClicked=true;
 report.nativeDialogSamples=[];
 for(let i=0;i<3;i++){await new Promise(r=>setTimeout(r,500));const dialogs=nativeDialogs();report.nativeDialogSamples.push({at:new Date().toISOString(),titles:dialogs});if(dialogs.length){report.nativeDialogDetected=true;report.cancel={requested:true,titles:nativeDialogs(true)};break;}}
 report.events=await mainEval('globalThis.__finderQa.events');report.notice=await page.locator('.ev-notice').innerText();await capture('finder-after-export.png');
 report.files=[];for(const file of await readdir(files)){const bytes=await readFile(join(files,file));let json;try{json=JSON.parse(bytes.toString('utf8'))}catch{}report.files.push({file,bytes:bytes.length,sha256:hash(bytes),version:json?.version,items:json?.items?.length,valid:json?.version===1&&JSON.stringify(json.items)===JSON.stringify(before.data.library.items)});}
 const exported=report.files.find(f=>f.valid);
 if(exported){await page.locator('.ev-import input[type=file]').setInputFiles(join(files,exported.file));await page.waitForFunction(()=>document.querySelector('.ev-notice')?.textContent?.startsWith('가져왔습니다.'));report.reimport='PASS — actual exported file selected via existing UI';}
 const after=await page.evaluate(()=>window.electronWork.educationVideo.load());report.libraryUnchanged=JSON.stringify(before)===JSON.stringify(after);
 const diskAfter=await mainEval(`(async()=>{const fs=process.getBuiltinModule('fs/promises');const p=process.getBuiltinModule('path');return fs.readFile(p.join(${JSON.stringify(info.userData)},'work-data','education-video','library.json'),'utf8');})()`);report.diskUnchanged=report.diskBefore===diskAfter;report.librarySha256=hash(Buffer.from(diskAfter));delete report.diskBefore;
 const success=report.notice==='라이브러리를 내보냈습니다.';
 if(report.nativeDialogDetected){report.case='D';report.verdict='BLOCKED';report.reason='Native dialog observed and cancelled; destination selection not automated';}
 else if(report.files.some(f=>f.valid)&&success){report.case='A';report.verdict='PASS';}
 else if(!report.files.length&&success){report.case='B';report.verdict='FAIL';}
 else if(!report.files.length&&!success&&/완료하지 못|실패/.test(report.notice)){report.case='C';report.verdict='FAIL';report.failureNotice='REVIEW wording against observed error';}
 else{report.reason='Evidence does not fit A/B/C/D';}
 if(!report.libraryUnchanged||!report.diskUnchanged){report.verdict='FAIL';report.reason='Existing library changed during export';}
}catch(e){report.error=e.message;}
finally{
 if(observing)await mainEval("globalThis.__finderQa.session.removeListener('will-download',globalThis.__finderQa.listener);delete globalThis.__finderQa;true").catch(e=>{report.cleanupError=e.message;report.verdict='BLOCKED'});
 if(mainSocket)mainSocket.close();if(browser)await browser.close();
 await writeFile(join(out,'ui-results.json'),JSON.stringify(report,null,2));
 console.log('::notice title=INT_EL07B_RESULT::'+JSON.stringify({verdict:report.verdict,case:report.case,error:report.error,events:report.events,notice:report.notice,files:report.files,nativeDialogDetected:report.nativeDialogDetected??false,libraryUnchanged:report.libraryUnchanged,diskUnchanged:report.diskUnchanged,images:report.images}));
}
if(report.verdict!=='PASS')process.exitCode=1;
