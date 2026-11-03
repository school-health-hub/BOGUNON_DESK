import {spawn,spawnSync} from 'node:child_process';
import {createRequire,registerHooks} from 'node:module';
import {mkdir,writeFile,readFile,readdir,stat} from 'node:fs/promises';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,dirname,extname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const sourceSha='9e22f7e5666ffa73afc48a03ff2c844ea67bc0c9';
const product=resolve(process.env.QA_PRODUCT_ROOT||'product');
const require=createRequire(join(product,'package.json'));
const out=resolve(process.env.INT_EL05H_OUTPUT||'diagnostic-output');
const fixtures=join(out,'fixtures');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(fixtures,{recursive:true});
if(process.argv.includes('--prepare')){
 const ts=require('typescript');const original=process.cwd();process.chdir(product);
 const hooks=registerHooks({
  resolve(name,context,next){
   if(name.startsWith('.')&&context.parentURL?.startsWith('file:')){
    const url=new URL(name,context.parentURL),plain=fileURLToPath(url);
    if(name.includes('?inline')&&existsSync(plain))return {url:url.href,shortCircuit:true};
    if(!extname(plain))for(const ext of ['.ts','.tsx'])if(existsSync(plain+ext))return {url:pathToFileURL(plain+ext).href,shortCircuit:true};
   }return next(name,context);
  },load(url,context,next){
   if(url.startsWith('file:')&&url.includes('?inline'))return {format:'module',source:'export default '+JSON.stringify('data:image/png;base64,'+readFileSync(fileURLToPath(url)).toString('base64')),shortCircuit:true};
   if(url.startsWith('file:')&&/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
   return next(url,context);
  }
 });
 try{
  const module=await import(pathToFileURL(join(product,'electron-p0/tests/newsletter-b-fixture.ts')).href);
  await writeFile(join(fixtures,'newsletter-approved-synthetic.json'),JSON.stringify(await module.approvedSyntheticB()));
  await writeFile(join(fixtures,'synthetic.png'),module.syntheticImage);
  await writeFile(join(fixtures,'purchase.csv'),'품명,규격,수량,단가\n합성 통합 장갑,상자,2,12000\n합성 통합 거즈,팩,1,3000\n');
  await writeFile(join(out,'fixture-provenance.json'),JSON.stringify({sourceSha,author:'existing approvedSyntheticB factory',syntheticImageSha:hash(module.syntheticImage),originalPendingAssetsUnchanged:true},null,2));
 }catch(e){await writeFile(join(out,'fixture-preparation-error.txt'),e.stack||e.message);throw e;}
 finally{hooks.deregister();process.chdir(original);}process.exit(0);
}
const {chromium}=require('playwright');
const phase=process.env.INT_EL05H_PHASE||'endpoint';
const report={sourceSha,qaSha:process.env.GITHUB_SHA,phase,connection:'NOT RUN',checks:[],images:[],files:[],errors:[],verdict:'BLOCKED'};
const assert=(value,message)=>{if(!value)throw Error(message)};
class NotRun extends Error{}
let browser,page,info;
const expected=JSON.parse(await readFile(join(out,'expected-state.json'),'utf8').catch(()=>'{}'));
const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true});
async function visible(locator){await locator.waitFor({state:'visible',timeout:12000});}
async function text(locator,value){await locator.filter({hasText:value}).first().waitFor({state:'visible',timeout:12000});}
async function capture(name){const file=`${phase}-${name}.png`,path=join(out,file);await page.screenshot({path});report.images.push({file,sha256:hash(await readFile(path)),native:resizeOwnedWindow(),renderer:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))});}
async function recordFile(path,kind){const until=Date.now()+20000;while(!existsSync(path)&&Date.now()<until)await new Promise(r=>setTimeout(r,150));const bytes=await readFile(path);assert(bytes.length>0,'Empty '+kind);report.files.push({file:path.slice(out.length+1),kind,bytes:bytes.length,sha256:hash(bytes)});return bytes;}
function resizeOwnedWindow(width=0,height=0){
 const script=`
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class QaWindow {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
}
'@
[void][QaWindow]::SetThreadDpiAwarenessContext([IntPtr](-4))
$handle=[IntPtr]([long]$env:INT_EL05H_HWND);[uint32]$owner=0
if(-not [QaWindow]::IsWindow($handle)){throw 'Identified Portable HWND no longer exists'}
[void][QaWindow]::GetWindowThreadProcessId($handle,[ref]$owner)
if($owner -ne [uint32]$env:INT_EL05H_PID){throw 'HWND PID mismatch'}
$process=Get-CimInstance Win32_Process -Filter "ProcessId=$owner"
if(-not $process -or $process.ExecutablePath -ne $env:INT_EL05H_APP_PATH){throw 'Owned Portable executable mismatch'}
$width=[int]$env:QA_WIDTH;$height=[int]$env:QA_HEIGHT
if($width -gt 0){
 if(-not [QaWindow]::SetWindowPos($handle,[IntPtr]::Zero,0,0,$width,$height,0x14)){throw 'SetWindowPos failed'}
 Start-Sleep -Milliseconds 350
}
$outer=[QaWindow+RECT]::new();$client=[QaWindow+RECT]::new()
if(-not [QaWindow]::GetWindowRect($handle,[ref]$outer) -or -not [QaWindow]::GetClientRect($handle,[ref]$client)){throw 'Native window measurement failed'}
$result=@{pid=$owner;hwnd=$handle.ToInt64();outer=@{width=$outer.Right-$outer.Left;height=$outer.Bottom-$outer.Top};client=@{width=$client.Right-$client.Left;height=$client.Bottom-$client.Top}}
if($width -gt 0 -and ($result.outer.width -ne $width -or $result.outer.height -ne $height)){throw "Native resize mismatch: $($result | ConvertTo-Json -Compress)"}
$result | ConvertTo-Json -Compress
`;
 const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',timeout:15000,env:{...process.env,QA_WIDTH:String(width),QA_HEIGHT:String(height)}});
 assert(!result.error&&result.status===0,'Native HWND resize/measurement failed: '+(result.error?.message||result.stderr));
 return JSON.parse(result.stdout.trim());
}
// UIA operates only native dialogs owned by the verified Electron PID. No dialog/API mocking.
const nativeScript=String.raw`
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$steps=ConvertFrom-Json $env:QA_DIALOG_STEPS
$processId=[int]$env:INT_EL05H_PID
$process=Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
if(-not $process -or $process.ExecutablePath -ne $env:INT_EL05H_APP_PATH){throw 'Native dialog owner mismatch'}
$done=@()
foreach($step in $steps){
 $seconds=if($env:QA_DIALOG_TIMEOUT){[int]$env:QA_DIALOG_TIMEOUT}else{25};$until=[DateTime]::UtcNow.AddSeconds($seconds);$completed=$false
 do{
  $windows=[Windows.Automation.AutomationElement]::RootElement.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ProcessIdProperty,$processId))
  foreach($win in $windows){
   if($win.Current.NativeWindowHandle -eq [int64]$env:INT_EL05H_HWND){continue}
   $edits=$win.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Edit))
   $buttons=$win.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Button))
   $chosen=$null
   if($step.kind -eq 'dismiss'){foreach($b in $buttons){if($b.Current.AutomationId -eq '2' -or $b.Current.Name -match '^Cancel|^취소'){$chosen=$b;break}}}
   elseif($step.kind -in @('save','open','cancel')){
    if($edits.Count -eq 0){continue}
    if($step.kind -ne 'cancel'){
     $edit=$null
     foreach($el in $edits){if($el.Current.AutomationId -eq '1001' -or $el.Current.Name -match 'File name|파일 이름'){$edit=$el;break}}
     if(-not $edit){continue}
     $pattern=$edit.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern);$pattern.SetValue([string]$step.path)
    }
    foreach($b in $buttons){if(($step.kind -eq 'cancel' -and ($b.Current.AutomationId -eq '2' -or $b.Current.Name -match '^Cancel|^취소')) -or ($step.kind -ne 'cancel' -and $b.Current.AutomationId -eq '1')){$chosen=$b;break}}
   }elseif($step.kind -eq 'confirm'){
    if($edits.Count -gt 0){continue}
    foreach($b in $buttons){if($b.Current.Name -match '확인 후 진행|검토 후 저장|확인 후 저장 위치 선택|확인 후 복원|^OK$|^확인$'){$chosen=$b;break}}
   }
   if($chosen){$done+=@{kind=$step.kind;title=$win.Current.Name;button=$chosen.Current.Name};($chosen.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke();$completed=$true;break}
  }
  if(-not $completed){Start-Sleep -Milliseconds 150}
 }while(-not $completed -and [DateTime]::UtcNow -lt $until)
 if(-not $completed){throw "Owned native dialog action timed out: $($step.kind)"}
 Start-Sleep -Milliseconds 250
}
$done | ConvertTo-Json -Compress
`;
async function nativeAction(steps,action){
 const child=spawn('pwsh',['-NoProfile','-NonInteractive','-Command',nativeScript],{env:{...process.env,QA_DIALOG_STEPS:JSON.stringify(steps)},windowsHide:true});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new NotRun('Native dialog automation unavailable: '+stderr.slice(-700))));});done.catch(()=>{});
 try{await action();await done;report.nativeDialogs??=[];report.nativeDialogs.push({steps:steps.map(s=>s.kind),observations:stdout.trim()});}catch(e){if(child.exitCode===null)child.kill();throw e;}
}
async function resetDashboard(){
 await page.keyboard.press('Escape').catch(()=>{});
 for(let i=0;i<4;i++){
  let changed=false;
  for(const label of ['입력 취소','닫기','일정·업무 — 로컬 저장 닫기','품의 도우미 닫기','대시보드로','보건 업무로','학교 초기 설정 닫기','설정 닫기','업무 도구 닫기','빠른 메모 닫기']){
   const found=button(label);if(await found.count()&&await found.first().isVisible()){await found.first().click();changed=true;break;}
  }
  if(!changed)break;
 }
 await visible(page.getByRole('navigation',{name:'주요 기능'}));
}
async function tool(label){await button('업무 도구',page.getByRole('navigation',{name:'주요 기능'})).click();await page.getByRole('button',{name:label}).click();}
async function newsletter(){await button('설정',page.getByRole('navigation',{name:'주요 기능'})).click();await button('앱 정보').click();await button('보건소식지 제작소').click();await visible(page.getByRole('heading',{name:'보건소식지 제작소',exact:true}));}
async function check(name,fn){
 try{await resetDashboard();await fn();report.checks.push({name,status:'PASS'});}catch(e){spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',nativeScript],{env:{...process.env,QA_DIALOG_STEPS:JSON.stringify([{kind:'dismiss'}]),QA_DIALOG_TIMEOUT:'1'},timeout:5000,windowsHide:true});report.checks.push({name,status:e instanceof NotRun?'NOT RUN':'FAIL',error:e.message});if(page)await capture('failure-'+name).catch(()=>{});}
 finally{console.log('::notice title=INTEGRATED_PORTABLE_CHECK::'+JSON.stringify(report.checks.at(-1)));await writeFile(join(out,phase==='endpoint'?'ui-results.json':phase==='endpoint-financefresh'?'ui-financefresh-results.json':'ui-restart-results.json'),JSON.stringify(report,null,2));}
}
async function fillIncome(name,amount){await button('수입 등록').click();await page.getByLabel('지급처',{exact:true}).fill(name);await page.getByLabel(/^총수입 \(원\)/).fill(String(amount));await button('등록 내용 확인').click();await button('로컬 저장',page.getByRole('alertdialog')).click();await text(page.getByRole('status'),/수입을 등록했습니다/);}
try{
 assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.INT_EL05H_ENDPOINT),'Loopback endpoint required');
 browser=await chromium.connectOverCDP(process.env.INT_EL05H_ENDPOINT,{timeout:15000});page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/resources/app.asar/renderer/index.html'));assert(page,'Exact extracted Portable renderer required');page.setDefaultTimeout(10000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 info=await page.evaluate(()=>window.electronP0.info());assert(info.sourceSha===sourceSha&&info.userData.includes(process.env.INT_EL05H_PROFILE),'Product/profile identity mismatch');report.info=info;report.connection='PASS';
 const setup=page.getByRole('dialog',{name:'학교 초기 설정'});await setup.waitFor({state:'visible',timeout:2000}).then(()=>button('나중에 설정',setup).click()).catch(()=>{});
 if(phase==='endpoint-financefresh'){
  await check('finance-clean-profile-encrypted-restore',async()=>{await tool(/MY FINANCE/);await visible(page.getByRole('heading',{name:'내 수입, 한눈에'}));await button('백업·복원').click();const dialog=page.getByRole('dialog');await button('백업 복원',dialog).click();const path=join(out,'synthetic-finance.bgfnbk');if(!existsSync(path))throw new NotRun('No encrypted synthetic backup was produced by the earlier save check');await nativeAction([{kind:'open',path}],()=>button('백업 파일 선택',dialog).click());await dialog.getByLabel('복원 비밀번호',{exact:true}).fill('synthetic-only-backup-2026');await button('복호화 및 유효성 검사',dialog).click();await visible(page.getByRole('region',{name:'복원 검사 결과'}));const consent=dialog.getByRole('checkbox');if(await consent.count())await consent.check();await button('복원 최종 확인',dialog).click();await nativeAction([{kind:'confirm'}],()=>page.getByRole('alertdialog').getByRole('button',{name:/복원|이식/}).click());await page.getByRole('dialog').waitFor({state:'hidden',timeout:20000});const current=await page.evaluate(()=>window.electronWork.finance.load());assert(current.ok&&current.data.income.some(i=>i.sourceName==='합성 통합 지급처'),'Clean-profile restore mismatch');const db=await readFile(join(info.userData,'work-data','my-finance','finance.db'));assert(db.subarray(0,16).toString()!=='SQLite format 3\0','Restored DB is plaintext');await capture('finance-clean-restored');});
 }else if(phase!=='endpoint'){
  await check('restart-task-restore',async()=>{const r=await page.evaluate(()=>window.electronWork.tasks.load());assert(r.ok&&r.data.document.tasks.some(t=>t.title===expected.task),'Stored task missing after full Portable restart');await tool('일정·업무 — 로컬 저장');await visible(button(expected.task+' 수정'));await capture('task-restored');});
  await check('restart-inventory-restore',async()=>{await tool('물품관리 — 로컬 저장');await visible(page.getByRole('heading',{name:'재고 관리'}));const r=await page.evaluate(()=>window.electronWork.inventory.load());assert(r.ok&&JSON.stringify(r.data.document).includes('합성 통합 장갑'),'Local inventory missing after restart');await capture('inventory-restored');});
  await check('restart-finance-restore',async()=>{await tool(/MY FINANCE/);await visible(page.getByRole('heading',{name:'내 수입, 한눈에'}));const r=await page.evaluate(()=>window.electronWork.finance.load());assert(r.ok&&r.data.income.some(i=>i.sourceName==='합성 통합 지급처'),'Encrypted income missing after restart');assert(!r.data.income.some(i=>i.sourceName==='합성 복원 전 추가 지급처'),'Backup restore did not revert the synthetic extra record');await capture('finance-restored');});
  await check('restart-school-and-environment',async()=>{const r=await page.evaluate(()=>window.electronWork.school.load());assert(r.ok&&r.data.document.school,'School profile not restored');const a=await page.evaluate(()=>window.electronWork.admin.load());assert(a.ok&&a.data.document.launcher?.environment==='evpn','Last eVPN selection missing');await tool('학교 행정 업무 도우미');await visible(page.getByText('현재 주소 환경: eVPN'));await capture('school-restored');});
 }else{
  for(const [width,height] of [[980,700],[1440,900]])await check('surface-'+width,async()=>{report['native'+width]=resizeOwnedWindow(width,height);await page.waitForTimeout(200);const boxes=await page.evaluate(()=>{const m=document.querySelector('.workspace-dashboard'),d=document.querySelector('.dock-zone');return {main:m.getBoundingClientRect().toJSON(),dock:d.getBoundingClientRect().toJSON(),position:getComputedStyle(d).position,overflow:document.documentElement.scrollWidth>innerWidth,renderer:{width:innerWidth,height:innerHeight}}});assert(!boxes.overflow,'Surface horizontal overflow');if(width===980)assert(boxes.main.bottom<=boxes.dock.top+1,'Dock overlap');await page.locator('.workspace-dashboard').evaluate(el=>{el.scrollTop=el.scrollHeight});assert(await page.locator('.workspace-dashboard').evaluate(el=>el.scrollTop+el.clientHeight>=el.scrollHeight-1),'Dashboard bottom inaccessible');await page.locator('.workspace-dashboard').evaluate(el=>el.scrollTop=0);report['layout'+width]=boxes;await capture('surface-'+width);});
  await check('memo-save',async()=>{await button('빠른 메모',page.getByRole('navigation',{name:'주요 기능'})).click();const panel=page.getByRole('dialog',{name:'빠른 메모'});const input=panel.locator('textarea,[contenteditable=true]').first();await input.fill('합성 통합 메모');await button('메모 저장',panel).click();await text(panel.getByRole('status'),/메모 저장됨/);await capture('memo');});
  await check('official-import-odt-save',async()=>{await tool(/공문작업실/);await nativeAction([{kind:'open',path:join(product,'tools/official-document-cli/tests/fixtures/synthetic-document.odt')}],()=>button('PDF/HWPX/ODT 가져오기').click());const edit=button('가져온 원문으로 편집');if(await edit.count())await edit.click();await page.getByLabel('제목',{exact:true}).fill('합성 통합 공문');await page.getByLabel('본문',{exact:true}).fill('합성 검토용 본문입니다. 개인정보와 학교 업무 원본을 포함하지 않습니다.');const path=join(out,'official-synthetic.odt');await nativeAction([{kind:'confirm'},{kind:'save',path}],()=>button('ODT 새 파일 저장').click());const bytes=await recordFile(path,'ODT');assert(bytes.subarray(0,2).toString()==='PK','ODT is not ZIP');const zipCheck=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',"Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead($env:QA_ZIP_PATH); try { $z.Entries.FullName | ConvertTo-Json -Compress } finally { $z.Dispose() }"],{encoding:'utf8',env:{...process.env,QA_ZIP_PATH:path},timeout:10000});assert(zipCheck.status===0&&zipCheck.stdout.includes('content.xml')&&zipCheck.stdout.includes('META-INF/manifest.xml'),'ODT structure missing');await capture('official-saved');});
  await check('official-save-cancel-preserves-draft',async()=>{await tool(/공문작업실/);await button('신규 공문 작성').click();const blank=button('빈 문서 작성');if(await blank.count())await blank.click();await page.getByLabel('제목',{exact:true}).fill('합성 취소 원고');await page.getByLabel('본문',{exact:true}).fill('취소 후에도 남아 있어야 하는 합성 원고입니다.');const value=await page.getByLabel('본문',{exact:true}).inputValue();await nativeAction([{kind:'confirm'},{kind:'cancel'}],()=>button('ODT 새 파일 저장').click());assert(await page.getByLabel('본문',{exact:true}).inputValue()===value,'Cancel lost official draft');await capture('official-canceled');});
  await check('purchase-csv-xlsx-save-and-cancel',async()=>{await tool(/품의 도우미/);await button(/품목 추가/).click();await page.getByLabel('1행 품명',{exact:true}).fill('합성 통합 구매');await page.getByLabel('1행 품명',{exact:true}).press('Tab');for(const [name,value] of [['1행 수량','2'],['1행 단가','12000']]){const input=page.getByLabel(name,{exact:true});await input.fill(value);await input.press('Tab');}for(const [name,file] of [['CSV 저장','purchase.csv'],['XLSX 저장','purchase.xlsx']]){const path=join(out,file);await nativeAction([{kind:'confirm'},{kind:'save',path}],()=>button(name).click());const bytes=await recordFile(path,file);assert(file.endsWith('csv')?bytes.toString('utf8').includes('합성 통합 구매'):bytes.subarray(0,2).toString()==='PK','Purchase file invalid');}const before=await page.getByLabel('1행 품명',{exact:true}).inputValue();await nativeAction([{kind:'confirm'},{kind:'cancel'}],()=>button('XLSX 저장').click());await text(page.getByRole('status'),/취소/);assert(await page.getByLabel('1행 품명',{exact:true}).inputValue()===before,'Cancel lost purchase input');await capture('purchase-save');});
  await check('newsletter-new-and-pending-guard',async()=>{await newsletter();await button('새 소식지 작성').click();await page.getByLabel('작성 월',{exact:true}).fill('2026-11');await page.getByLabel('학교 유형',{exact:true}).selectOption('coed-high');await button('새 소식지 만들기').click();await visible(page.getByRole('img',{name:'A4 보건소식지 미리보기',exact:true}));const output=button('출력 위치 선택·저장');assert(await output.isDisabled(),'Pending official mascot export must remain blocked');await capture('newsletter-new-pending');});
  await check('newsletter-approved-synthetic-png-pdf',async()=>{await newsletter();await page.getByLabel('원고·디자인 JSON 열기',{exact:true}).setInputFiles(join(fixtures,'newsletter-approved-synthetic.json'));await page.getByLabel('이미지 원본 연결',{exact:true}).setInputFiles(join(fixtures,'synthetic.png'));await visible(page.getByRole('img',{name:'A4 보건소식지 미리보기',exact:true}));for(const [selection,file] of [['a4-png','newsletter.png'],['a4-pdf','newsletter.pdf']]){await page.getByLabel('출력 형식',{exact:true}).selectOption(selection);await nativeAction([{kind:'save',path:join(out,file)}],()=>button('출력 위치 선택·저장').click());const bytes=await recordFile(join(out,file),file);if(file.endsWith('.pdf')){const {PDFDocument}=require('pdf-lib');assert((await PDFDocument.load(bytes)).getPageCount()===1,'A4 PDF page contract');}else assert(bytes.subarray(1,4).toString()==='PNG','Canvas PNG invalid');}await capture('newsletter-exports');});
  await check('finder-json-save-and-reimport',async()=>{await tool(/교육영상 Finder/);await page.getByLabel('교육 주제',{exact:true}).fill('합성 손씻기');await page.getByLabel('검색 대상',{exact:true}).fill('합성 초등');await button('Mock 영상 검색').click();const result=page.locator('.ev-result').first();await result.getByRole('button').click();await page.getByLabel('안내문 직접 수정',{exact:true}).fill('합성 영상 검토용 안내문입니다. 실제 배포하지 않습니다.');await button('라이브러리 저장').click();await text(page.getByRole('status'),/라이브러리.*저장|저장했습니다/);const path=join(out,'finder.json');await nativeAction([{kind:'save',path}],()=>button('내보내기').click());const bytes=await recordFile(path,'Finder JSON'),doc=JSON.parse(bytes);assert(Array.isArray(doc.items)&&doc.items.length>=1,'Saved Finder JSON has no items');const before=await page.evaluate(()=>window.electronWork.educationVideo.load());await page.locator('input[type=file]').first().setInputFiles(path);await text(page.getByRole('status'),/가져왔습니다/);const after=await page.evaluate(()=>window.electronWork.educationVideo.load());assert(before.ok&&after.ok&&after.data.library.items.length===before.data.library.items.length,'Reimport changed existing library count');await capture('finder-reimported');});
  await check('task-save',async()=>{await tool('일정·업무 — 로컬 저장');expected.task='합성 통합 한글 업무명 저장과 재실행 복원 확인';await page.getByLabel('로컬 업무 제목',{exact:true}).fill(expected.task);await button('업무 저장').click();await text(page.getByRole('status'),/업무를 저장했습니다/);await capture('task-saved');});
  await check('inventory-movement-and-purchase-handoff',async()=>{await tool('물품관리 — 로컬 저장');await visible(page.getByRole('heading',{name:'재고 관리'}));await button('물품 등록').click();const editor=page.getByRole('form',{name:'물품 편집'});await editor.getByLabel('물품명',{exact:true}).fill('합성 통합 장갑');const stock=editor.getByLabel(/초기|현재고/);if(await stock.count())await stock.first().fill('8');await button('물품 저장').click();await page.getByRole('button',{name:'합성 통합 장갑 선택'}).click();await button('입고 기록').click();await page.getByLabel('수량',{exact:true}).fill('2');await page.getByLabel('사유',{exact:true}).fill('합성 통합 입고');await button('기록 저장').click();await text(page.getByRole('status'),/입고 기록을 저장했습니다/);const before=await page.evaluate(()=>window.electronWork.inventory.load());await button('구매 후보에 추가').click();const confirm=button('확인 후 Purchase에 추가');await visible(confirm);await confirm.click();await visible(page.getByRole('dialog',{name:'품의 도우미',exact:true}));assert((await page.locator('.purchase-helper-table').innerText()).includes('합성 통합 장갑'),'Purchase handoff item absent');const after=await page.evaluate(()=>window.electronWork.inventory.load());assert(JSON.stringify(before)===JSON.stringify(after),'Purchase handoff changed inventory');await capture('inventory-purchase');});
  await check('ai-settings-disconnect-no-paid-call',async()=>{await button('설정',page.getByRole('navigation',{name:'주요 기능'})).click();await button('AI 연결').click();await visible(page.getByLabel('AI 제공자',{exact:true}));await button('로그아웃·저장 연결 삭제').click();const status=await page.evaluate(()=>window.electronWork.ai.status());assert(status.ok,'AI status unavailable after disconnect');report.ai=status.data;await capture('ai-disconnected');});
  await check('finance-encrypted-save',async()=>{await tool(/MY FINANCE/);await visible(page.getByRole('heading',{name:'내 수입, 한눈에'}));await fillIncome('합성 통합 지급처',120000);const path=join(info.userData,'work-data','my-finance','finance.db'),bytes=await readFile(path);assert(bytes.subarray(0,16).toString()!=='SQLite format 3\0','Plaintext SQLite detected');assert(existsSync(join(dirname(path),'key.dpapi')),'DPAPI-protected key absent');report.encryptedStore={bytes:bytes.length,plainSQLiteHeader:false,dpapiFilePresent:true};await capture('finance-income');});
  await check('finance-encrypted-backup',async()=>{await tool(/MY FINANCE/);await visible(page.getByRole('heading',{name:'내 수입, 한눈에'}));await button('백업·복원').click();const dialog=page.getByRole('dialog');await dialog.getByLabel('백업 비밀번호',{exact:true}).fill('synthetic-only-backup-2026');await dialog.getByLabel('비밀번호 확인',{exact:true}).fill('synthetic-only-backup-2026');const path=join(out,'synthetic-finance.bgfnbk');await nativeAction([{kind:'save',path}],()=>button('암호화 파일 저장',dialog).click());const bytes=await recordFile(path,'Encrypted Finance backup');assert(bytes.subarray(0,8).toString()==='BGFNBK01','Encrypted backup header invalid');await capture('finance-backup');});
  await check('school-admin-profile-neis-and-evpn',async()=>{await tool('학교 행정 업무 도우미');await visible(page.getByRole('heading',{name:'학교 행정 업무 도우미'}));await page.getByLabel('신청 사유',{exact:true}).fill('합성 복무 원고');await button('검토용 초안 만들기').click();const before=await page.getByLabel('복무 검토 본문',{exact:true}).inputValue();await button('eVPN').click();await visible(page.getByText('현재 주소 환경: eVPN'));assert(await page.getByLabel('복무 검토 본문',{exact:true}).inputValue()===before,'Environment change lost draft');await page.getByText('학교 선택·변경',{exact:true}).click();const profile=page.getByRole('region',{name:'공통 학교 프로필'});await profile.getByLabel('학교명',{exact:true}).fill('한빛');await button('NEIS 학교 검색',profile).click();const selected=profile.getByRole('button',{name:/^학교 선택 ·/}).first();try{await visible(selected);}catch{throw new NotRun('NEIS live query unavailable on Windows runner; see captured UI');}await selected.click();await text(profile.getByRole('status'),/학교 프로필을 저장했습니다/);const school=await page.evaluate(()=>window.electronWork.school.load());assert(school.ok&&school.data.document.school,'Common school selection was not persisted');report.school=school.data.document.school;await capture('school-profile');});
 }
}catch(e){report.fatal=e.stack||e.message;}
finally{
 await writeFile(join(out,'expected-state.json'),JSON.stringify(expected,null,2));
 report.verdict=report.fatal?'BLOCKED':report.checks.some(c=>c.status!=='PASS')?'CONDITIONAL':'PASS';
 await writeFile(join(out,phase==='endpoint'?'ui-results.json':phase==='endpoint-financefresh'?'ui-financefresh-results.json':'ui-restart-results.json'),JSON.stringify(report,null,2));
 if(browser)await browser.close().catch(()=>{});
}
console.log(JSON.stringify({phase,verdict:report.verdict,checks:report.checks}));
process.exitCode=report.verdict==='PASS'?0:1;
