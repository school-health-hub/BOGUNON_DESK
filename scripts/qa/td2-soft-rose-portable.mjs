import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
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
const launch=()=>spawn(executable,[`--remote-debugging-port=${port}`,'--inspect=127.0.0.1:19228'],{
  cwd:process.cwd(),
  env:{...process.env,APPDATA:isolatedAppData,LOCALAPPDATA:isolatedLocalAppData,ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_TEST_RUN:qaRun,ELECTRON_P0_QA_ROOT:qaRoot,ELECTRON_P0_DEV_URL:''},
  stdio:['ignore','pipe','pipe'],
  windowsHide:false,
});

const seedRoot=join(qaRoot,'test-runs',qaRun,'user-data');
await mkdir(join(seedRoot,'poc-settings'),{recursive:true});
await writeFile(join(seedRoot,'poc-settings','desktop.json'),JSON.stringify({version:1,closeBehavior:'tray',maximized:false}));
await mkdir(join(seedRoot,'work-data/school-profile'),{recursive:true});
await writeFile(join(seedRoot,'work-data/school-profile/school.json'),JSON.stringify({version:1,revision:1,school:{officeCode:'K10',officeName:'강원특별자치도교육청',schoolCode:'1234567',schoolName:'합성 QA 긴 학교명 화면 표시 확인 전용 초등학교'}}));
await mkdir(join(seedRoot,'work-data/local-events'),{recursive:true});

let child=launch();
child.stdout.on('data',()=>{});
child.stderr.on('data',()=>{});

const ownedPids=new Set([child.pid]);
const psQuote=v=>"'"+v.replaceAll("'","''")+"'";
const ownedSnapshot=()=>{
 const script=`$all=@(Get-CimInstance Win32_Process);$ids=[System.Collections.Generic.HashSet[int]]::new();foreach($i in @(${[...ownedPids].join(',')})){[void]$ids.Add($i)};do{$added=$false;foreach($p in $all){if($ids.Contains([int]$p.ParentProcessId)-and !$ids.Contains([int]$p.ProcessId)){[void]$ids.Add([int]$p.ProcessId);$added=$true}}}while($added);$root=${psQuote(resolve(process.env.TEMP)+'\\')};$exe=${psQuote(resolve(executable))};@($all|Where-Object{($_.ExecutablePath -and ($_.ExecutablePath.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)-or $_.ExecutablePath -eq $exe))-and ($ids.Contains([int]$_.ProcessId)-or $_.Name -like 'BOGUNON*')}|Select-Object ProcessId,ParentProcessId,ExecutablePath,CreationDate)|ConvertTo-Json -Compress`;
 const raw=execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8'}).trim();const v=raw?JSON.parse(raw):[];const rows=Array.isArray(v)?v:[v];for(const p of rows)ownedPids.add(p.ProcessId);return rows;
};
const cleanupOwned=async()=>{
 await closeBrowser();
 let remaining=ownedSnapshot();result.shutdown.beforeCleanup=remaining;
 for(let i=0;i<5&&remaining.length;i++){await delay(500);remaining=ownedSnapshot();}
 result.shutdown.forced=remaining.length>0;
 for(const p of remaining){
  const script=`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${p.ProcessId}';if($p -and [datetime]$p.CreationDate -eq [datetime] ${psQuote(p.CreationDate)}){Stop-Process -Id ${p.ProcessId} -Force -ErrorAction Stop}`;
  execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8'});
 }
 for(let i=0;i<10;i++){remaining=ownedSnapshot();if(!remaining.length)break;await delay(500);}
 result.shutdown.remaining=remaining;result.shutdown.zeroResidual=remaining.length===0;
 if(remaining.length)throw Error('Owned QA process cleanup failed');
};
let mainWs;
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

const native=(action,extra=[])=>JSON.parse(execFileSync('pwsh',['-NoProfile','-File',join(dirname(fileURLToPath(import.meta.url)),'td2-window.ps1'),'-ExecutableRoot',process.env.TEMP,'-Action',action,...extra],{encoding:'utf8',timeout:25000}).trim());
let mainCall;
try{
 await waitForCdp();browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);browserSession=await browser.newBrowserCDPSession();const page=browser.contexts()[0].pages().find(p=>p.url().startsWith('file:'));await page.waitForLoadState('domcontentloaded');const dock=page.getByRole('navigation',{name:'주요 기능'});await dock.waitFor();
 const info=await page.evaluate(()=>window.electronP0.info());if(info.sourceSha!==expectedSha||resolve(info.userData).toLowerCase()!==resolve(seedRoot).toLowerCase()||!info.qaProfile||!info.qaProfile.stores.every(p=>resolve(p).toLowerCase().startsWith(resolve(seedRoot).toLowerCase()+'\\')))throw Error('Immutable source/QA profile mismatch');result.actualUserData=info.userData;result.profileIsolation={verdict:'PASS',...info.qaProfile};result.environment=native('Probe');result.remainingChecks={};
 const endpoints=await (await fetch('http://127.0.0.1:19228/json/list')).json();mainWs=new WebSocket(endpoints[0].webSocketDebuggerUrl);await new Promise((ok,bad)=>{mainWs.addEventListener('open',ok,{once:true});mainWs.addEventListener('error',bad,{once:true});});let seq=0;const callbacks=new Map();mainWs.addEventListener('message',event=>{const m=JSON.parse(event.data);callbacks.get(m.id)?.(m);callbacks.delete(m.id);});
 mainCall=async fn=>{const id=++seq;const m=await new Promise((ok,bad)=>{const timer=setTimeout(()=>{callbacks.delete(id);bad(Error('Main observation timeout'));},15000);callbacks.set(id,m=>{clearTimeout(timer);ok(m);});mainWs.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:'('+fn.toString()+')()',awaitPromise:true,returnByValue:true}}));});if(m.error||m.result?.exceptionDetails)throw Error('Main observation failed');return m.result.result.value;};
 await mainCall(async function(){const e=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');globalThis.__remainingQa={e,w:e.BrowserWindow.getAllWindows().find(w=>w.isVisible())};return true;});
 const initial=await page.evaluate(()=>window.electronWork.account.status());
 if(!initial.ok||initial.data.configured||!initial.data.secureStorage||initial.data.user)throw Error('Expected disabled configuration with actual Windows secure storage');
 result.accountDisabled={verdict:'PASS',configured:false,secureStorage:true};
 await dock.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('navigation',{name:'설정 카테고리'}).getByRole('button',{name:'학교 프로필',exact:true}).click();
 result.accountUi=[];
 for(const [width,height] of [[980,700],[900,680]]){native('Resize',['-Width',String(width),'-Height',String(height)]);await delay(300);const section=page.getByRole('region',{name:'BOGUNON 계정 연결'}),button=section.getByRole('button',{name:'Google로 BOGUNON 로그인'});await button.scrollIntoViewIfNeeded();if(!await button.isDisabled())throw Error('Unconfigured login enabled');await section.getByText('기존 Supabase 공개 클라이언트 빌드 설정이 필요합니다.',{exact:false}).waitFor();await page.screenshot({path:join(screenshots,`account-${width}.png`)});result.accountUi.push({width,height,disabledLogin:true,visible:await button.isVisible()});}
 const disabled=await page.evaluate(()=>window.electronWork.account.signIn());if(!disabled.ok||disabled.data.status!=='signedOut'||disabled.data.configured)throw Error('Unconfigured signin not blocked');
 result.syntheticWindows=await mainCall(async function(){
  globalThis.__accountStage='module-imports';try{const q=globalThis.__remainingQa,e=q.e,req=process.getBuiltinModule('module').createRequire(e.app.getAppPath()+'/package.json'),fs=req('node:fs/promises'),path=req('node:path'),url=req('node:url');
  const load=name=>import(url.pathToFileURL(path.join(e.app.getAppPath(),'main',name+'.js')).href);
  const {AccountVault}=await load('account-vault'),{AccountService}=await load('account-service'),{AccountLoopback}=await load('account-loopback'),{SchoolProfileStore}=await load('school-profile'),{createAccountHandlers}=await load('account-ipc');
  globalThis.__accountStage='dpapi';const root=path.join(e.app.getPath('userData'),'account-synthetic-qa');await fs.mkdir(root,{recursive:true});
  const check=(ok)=>{if(!ok)throw Error('Synthetic account assertion failed');};
  const cipher={available:process.platform==='win32'&&e.safeStorage.isEncryptionAvailable(),encrypt:v=>e.safeStorage.encryptString(v),decrypt:v=>e.safeStorage.decryptString(v)};check(cipher.available);
  const vault=new AccountVault(path.join(root,'vault'),cipher),marker='SYNTHETIC_DPAPI_ONLY';await vault.write({'sb-synthetic-auth-token':marker});const encrypted=await fs.readFile(path.join(root,'vault','session.bin'));check(!encrypted.includes(Buffer.from(marker)));check((await new AccountVault(path.join(root,'vault'),cipher).read())['sb-synthetic-auth-token']===marker);await vault.write({});
  const config=JSON.parse(await fs.readFile(path.join(e.app.getAppPath(),'account-config.json'),'utf8'));config.publishableKey='sb_publishable_synthetic_account_qa';
  let uid='11111111-1111-4111-8111-111111111111',loop,requests=0,externalOpens=0,expired=false;
  const school={officeCode:'B10',officeName:'서울특별시교육청',schoolCode:'1000001',schoolName:'합성 계정 QA 학교'};
  class FakeLoop extends AccountLoopback{async start(cb,timeout){this.cb=cb;this.timeout=timeout;return 'http://127.0.0.1:43210/auth/callback/synthetic';}arm(flow){this.flow=flow;}close(){}fire(){this.cb({flowId:this.flow,code:'synthetic-code',error:false});}}
  const transport=async(input,init)=>{requests++;const u=new URL(String(input));check(u.origin===config.origin);const user={id:uid,email:'synthetic@example.test',user_metadata:{name:'합성 QA'}};if(u.pathname==='/auth/v1/token'){const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return Response.json({access_token:enc({alg:'HS256'})+'.'+enc({sub:uid,exp:Math.floor(Date.now()/1000)+3600})+'.synthetic',refresh_token:'synthetic-ephemeral-refresh',expires_in:3600,token_type:'bearer',user});}if(u.pathname==='/auth/v1/user')return expired?Response.json({message:'expired'},{status:401}):Response.json(user);if(u.pathname==='/auth/v1/logout')return new Response(null,{status:204});if(u.pathname==='/rest/v1/user_settings')return Response.json([{neis_office_code:school.officeCode,neis_school_code:school.schoolCode,neis_school_name:school.schoolName,neis_office_name:school.officeName}]);throw Error('Unexpected synthetic endpoint');};
  const ports={vault,config,fetch:transport,open:async()=>{externalOpens++;},loopback:()=>{loop=new FakeLoop();return loop;}},service=new AccountService(ports);
  const settle=async(fn)=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Synthetic state timeout');};
  const login=async()=>{await service.signIn();loop.fire();await settle(async()=>(await service.status()).schoolStatus==='ready');};
  let handlers,restored;
  try{
   globalThis.__accountStage='sdk-login';await login();const state=await service.status();check(state.user.id===uid);check(!/access_token|refresh_token|code_verifier/.test(JSON.stringify(state)));
   globalThis.__accountStage='school-apply';const store=new SchoolProfileStore(path.join(root,'local-school')),frame={},contents={mainFrame:frame,getURL:()=> 'file:///synthetic'},event={sender:contents,senderFrame:frame};let approve=false;handlers=createAccountHandlers(contents,contents.getURL(),service,store,async()=>approve);
   const args={accountRevision:state.revision,expectedSchoolRevision:0};const cancel=await handlers.applySchool(event,args);check(cancel.ok&&cancel.data===null&&(await store.load()).document.school===null);
   approve=true;const saved=await handlers.applySchool(event,args);check(saved.ok&&saved.data.document.school.schoolName===school.schoolName);
   await service.cancel();check((await store.load()).document.school.schoolName===school.schoolName);
   globalThis.__accountStage='switch';await login();uid='22222222-2222-4222-8222-222222222222';const switching=await service.signIn();check(!switching.user&&!switching.school);loop.fire();await settle(async()=>(await service.status()).user?.id===uid);
   globalThis.__accountStage='expiry';expired=true;check((await service.refresh()).status==='expired');expired=false;await service.signOut();check(Object.keys(await vault.read()).length===0);check((await store.load()).document.school.schoolName===school.schoolName);
   globalThis.__accountStage='cancel';await service.signIn();const previous=loop;await service.cancel();previous.fire();await service.flush();check(!(await service.status()).user);
   await service.signIn();loop.timeout();await settle(async()=>(await service.status()).status==='signedOut');
   globalThis.__accountStage='restore';await login();service.dispose();restored=new AccountService({...ports,vault:new AccountVault(path.join(root,'vault'),cipher)});check((await restored.status()).user?.id===uid);await restored.signOut();
   globalThis.__accountStage='loopback';const real=new AccountLoopback();try{let accepted=false;const redirect=await real.start(()=>{accepted=true;},()=>{});real.arm('synthetic_flow_01');const response=await req('electron').net.fetch(redirect+'?code=synthetic&sb_flow_id=synthetic_flow_01');check(response.ok);await settle(()=>accepted);}finally{real.close();}
   return {verdict:'PASS',dpapi:'Actual Windows safeStorage encrypt/decrypt and new-vault disk restore',auth:'Synthetic transport; real bundled SDK and service',school:'Synthetic handler confirmation approve/cancel; no OS dialog injection into product',logoutSwitchExpiryCancelTimeout:true,schoolPreserved:true,rendererTokenFree:true,loopback:'Actual Windows 127.0.0.1 ephemeral listener',requests,externalNetworkRequests:0,systemBrowserOpens:0};
  }finally{handlers?.dispose();service.dispose();restored?.dispose();await vault.flush();}
 }catch(error){return {verdict:'FAIL',stage:globalThis.__accountStage,errorCode:error.code??error.name};}
 });
 if(result.syntheticWindows.verdict!=='PASS')throw Error('Synthetic Windows QA failed at '+result.syntheticWindows.stage+' / '+result.syntheticWindows.errorCode);
 await mainCall(async function(){const q=globalThis.__remainingQa,quit=q.e.Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.label==='완전 종료');quit.click();return true;});mainWs.close();mainWs=undefined;await waitForWrapperExit();result.shutdown.wrapperExited=true;
 result.realOAuth='NOT RUN: public configuration and operator-approved redirect compatibility/test account required';result.verdict='PASS';
}catch(error){result.error=String(error).split('\n')[0].slice(0,500);result.verdict='FAIL';}
finally{if(mainWs){try{mainWs.close();}catch{}}try{await cleanupOwned();}catch(error){result.cleanupError=String(error);result.verdict='FAIL';}if(browser){try{await browser.close();}catch{}}await writeFile(join(evidenceRoot,'account-windows-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
if(result.verdict==='FAIL')process.exitCode=1;
