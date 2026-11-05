// QA controller only. Runs against a separate immutable product checkout on Actions.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const source=resolve(process.env.TD2_PRODUCT_ROOT??'');
const out=resolve(process.env.TD2_EVIDENCE_ROOT??'');
assert.equal(process.platform,'win32');
assert.ok(out.startsWith(resolve(process.env.RUNNER_TEMP)+'\\'));
const require=createRequire(join(source,'package.json'));
const {_electron,expect}=require('@playwright/test');
const {PNG}=require('pngjs');
const XLSX=require('xlsx');
const {PDFDocument}=require('pdf-lib');
const sha='243ae95e69483dfbe8d2438c41f858577d748048';
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),sha);
const run=randomUUID(),qaRoot=process.env.ELECTRON_P0_QA_ROOT;
const result={qaSha:execFileSync('git',['rev-parse','HEAD'],{cwd:resolve(import.meta.dirname,'../..'),encoding:'utf8'}).trim(),sourceSha:sha,classification:'Actual Windows Electron, native loopback PostgreSQL, synthetic Auth; not Portable or Hosted',checks:[],notRun:['Physical printer','Native OS file/save/confirmation dialogs (narrow QA return-value substitution)','Native OS print preview dialog (real Chromium printToPDF instead)','Microsoft Excel desktop application','Instructor standalone web GUI'],captures:[],externalRendererRequests:[],verdict:'NOT RUN'};
await mkdir(out,{recursive:true});
const save=()=>writeFile(join(out,'instructor02-result.json'),JSON.stringify(result,null,2));
const pass=async(name,details={})=>{result.checks.push({name,status:'PASS',...details});await save();console.log('PASS '+name);};
const hash=value=>createHash('sha256').update(value).digest('hex');
for(const [name,color] of [['teacher',[190,0,20]],['instructor',[0,40,180]],['replacement',[0,100,20]]]){
 const p=new PNG({width:120,height:120});
 for(let y=0;y<120;y++)for(let x=0;x<120;x++){
  const i=(y*120+x)*4,ring=Math.abs(Math.hypot(x-60,y-60)-48)<3,mark=x>35&&x<85&&y>48&&y<72;
  p.data[i]=color[0];p.data[i+1]=color[1];p.data[i+2]=color[2];p.data[i+3]=ring||mark?255:0;
 }
 await writeFile(join(out,name+'.png'),PNG.sync.write(p));
}
let app,page,stage='launch';
const capture=async name=>{await page.screenshot({path:join(out,name+'.png')});result.captures.push(name+'.png');(result.captureHashes??={})[name+'.png']=hash(await readFile(join(out,name+'.png')));};
const busy=async()=>expect(page.locator('section.instructor-workspace')).toHaveAttribute('aria-busy','false');
const instructor=()=>page.getByRole('region',{name:'보건지원강사 근무관리',exact:true});
const tab=async name=>{await instructor().getByRole('navigation',{name:'강사 관리 메뉴'}).getByRole('button',{name,exact:true}).click();await busy();};
async function login(id=3){
 const workspace=page.getByRole('region',{name:'우리 보건실 제품 화면'});
 await workspace.getByLabel('검증 계정').selectOption(String(id));
 await workspace.getByRole('button',{name:'로그인',exact:true}).click();
 await workspace.getByLabel('학교명',{exact:true}).fill('늘봄');
 await workspace.getByLabel('시도교육청').selectOption(id===6?'C10':'B10');
 await workspace.getByRole('button',{name:'학교 검색',exact:true}).click();
 await workspace.getByRole('button',{name:'이 학교 선택',exact:true}).click();
 await workspace.getByRole('button',{name:'학교 공동 공간 열기',exact:true}).click();
 await workspace.getByRole('navigation',{name:'우리 보건실 메뉴'}).getByRole('button',{name:'보건지원강사 근무관리',exact:true}).click();
 await busy();
 await instructor().getByLabel('조회 월').fill('2026-08');await busy();
}
async function launch(){
 app=await _electron.launch({executablePath:require('electron'),args:[join(source,'build/electron-p0-app')],cwd:source,timeout:60000,env:{...process.env,ELECTRON_RUN_AS_NODE:undefined,ELECTRON_P0_QA_PROFILE:'1',ELECTRON_P0_QA_ROOT:qaRoot,ELECTRON_P0_TEST_RUN:run,ELECTRON_P0_DEV_URL:'',SCHOOL_WORKSPACE_MODE:'synthetic',NODE_ENV:'development'}});
 page=await app.firstWindow();page.setDefaultTimeout(20000);
 page.on('request',r=>{if(/^https?:|^wss?:/.test(r.url()))result.externalRendererRequests.push(new URL(r.url()).origin);});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1440,900);});
 await page.getByRole('navigation',{name:'주요 기능'}).waitFor();
 const later=page.getByRole('button',{name:'나중에 설정',exact:true});
 if(await later.count())await later.click();
 await page.getByRole('navigation',{name:'주요 기능'}).locator('button[data-dock-item="toolbox"]').click();
 await page.getByRole('button',{name:/우리 보건실 · 학교 공유/}).click();
 await expect.poll(()=>page.evaluate(()=>window.electronWorkspace.status().then(s=>s.mode))).toBe('qa');
 const info=await page.evaluate(()=>window.electronP0.info());
 result.runtime=info;assert.equal(info.sourceSha,sha);assert.ok(resolve(info.userData).toLowerCase().startsWith(resolve(qaRoot).toLowerCase()+'\\'));
 await app.evaluate(({dialog,BrowserWindow},paths)=>{
  globalThis.__instructor02={pick:paths.teacher,pdf:null,printError:null};
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[globalThis.__instructor02.pick]});
  dialog.showSaveDialog=async()=>({canceled:false,filePath:paths.workbook});
  dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});
  BrowserWindow.getAllWindows()[0].webContents.print=(_options,callback)=>{
   const q=globalThis.__instructor02;
   BrowserWindow.getAllWindows()[0].webContents.printToPDF({preferCSSPageSize:true,printBackground:true}).then(async bytes=>{
    await process.getBuiltinModule('fs').promises.writeFile(q.pdf,bytes);callback(true);
   }).catch(e=>{q.printError=e.message;callback(false,e.message);});
  };
 },{teacher:join(out,'teacher.png'),workbook:join(out,'payment.xlsx')});
}
async function stop(){
 if(!app)return;
 await app.evaluate(({Menu})=>{const walk=menu=>{for(const item of menu.items){if(item.label==='완전 종료'){item.click();return true;}if(item.submenu&&walk(item.submenu))return true;}return false;};if(!walk(Menu.getApplicationMenu()))throw Error('Quit menu unavailable');}).catch(()=>{});
 const child=app.process();await new Promise((resolveExit,reject)=>{if(child.exitCode!==null)return resolveExit();const t=setTimeout(()=>reject(Error('Owned Electron did not quit')),15000);child.once('exit',()=>{clearTimeout(t);resolveExit();});});
 app=undefined;
}
async function pick(role,file){
 await app.evaluate((_e,path)=>{globalThis.__instructor02.pick=path;},join(out,file+'.png'));
 await instructor().getByRole('button',{name:new RegExp('^'+role+' 도장 (등록|교체)$')}).click();await busy();
 await expect(instructor().getByAltText('등록한 '+role+' 도장')).toBeVisible();
 return instructor().getByAltText('등록한 '+role+' 도장').getAttribute('src');
}
async function check(name,fn){try{await fn();}catch(e){result.checks.push({name,status:'FAIL',message:String(e).slice(0,1500)});await capture('failure-'+name.replace(/[^a-z0-9]+/gi,'-').slice(0,60)).catch(()=>{});await save();console.error('FAIL '+name);}}
async function topmost(dialog){
 const proof=await dialog.evaluate(el=>{const overlay=el.parentElement,school=document.querySelector('.s05-overlay'),root=document.querySelector('#root');return{dialogZ:Number(getComputedStyle(overlay).zIndex),schoolZ:Number(getComputedStyle(school).zIndex),rootInert:root.inert,activeInside:el.contains(document.activeElement),portalParent:overlay.parentElement.tagName,transform:getComputedStyle(overlay).transform};});
 assert.ok(proof.dialogZ>proof.schoolZ);assert.ok(proof.rootInert);assert.ok(proof.activeInside);assert.equal(proof.portalParent,'BODY');return proof;
}
async function visiblePreviews(){
 const opener=instructor().getByRole('button',{name:'출근관리부 미리보기',exact:true});await opener.scrollIntoViewIfNeeded();
 const before=await page.locator('.s05-overlay').evaluate(el=>({top:el.scrollTop,left:el.scrollLeft}));
 await opener.click();await busy();let dialog=page.getByRole('dialog',{name:'출력 미리보기',exact:true});const layer=await topmost(dialog);
 for(const name of ['이번 출력에 강사 도장 포함','이번 출력에 보건교사 도장 포함']){await expect(dialog.getByLabel(name)).toBeInViewport();await dialog.getByLabel(name).check();}
 await dialog.locator('.attendance-register-preview h2').scrollIntoViewIfNeeded();await expect(dialog.locator('.attendance-register-preview h2')).toBeInViewport();await capture('fixed-attendance-preview-980');
 const first=dialog.getByRole('button',{name:'출력 미리보기 닫기'}),last=dialog.getByRole('button',{name:'출력 취소·닫기'});await first.focus();await page.keyboard.press('Shift+Tab');await expect(last).toBeFocused();await page.keyboard.press('Tab');await expect(first).toBeFocused();
 await page.locator('.s05-overlay button').first().evaluate(el=>el.focus());assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));
 await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();await dialog.locator('.attendance-register-preview__verifier').scrollIntoViewIfNeeded();await capture('fixed-attendance-footer-980');
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();assert.deepEqual(await page.locator('.s05-overlay').evaluate(el=>({top:el.scrollTop,left:el.scrollLeft})),before);
 await pass('Visible attendance modal, keyboard containment, inert background, focus and scroll restoration at 980x700',layer);
 await instructor().getByRole('button',{name:'지급명세서 미리보기',exact:true}).click();dialog=page.getByRole('dialog',{name:'출력 미리보기',exact:true});await topmost(dialog);assert.equal(await dialog.locator('img').count(),0);await expect(dialog.locator('.payment-statement-preview h2')).toBeInViewport();await capture('fixed-payment-preview-980');await dialog.getByRole('button',{name:'출력 미리보기 닫기'}).click();await expect(dialog).toHaveCount(0);
 await pass('Visible payment preview without any seal or payment engine changes');
}
async function makePdf(count){
 const opener=instructor().getByRole('button',{name:'출근관리부 미리보기',exact:true});await opener.click();await busy();const dialog=page.getByRole('dialog',{name:'출력 미리보기',exact:true});await topmost(dialog);
 await dialog.getByLabel('이번 출력에 강사 도장 포함').check();await dialog.getByLabel('이번 출력에 보건교사 도장 포함').check();await dialog.getByLabel('확인자 이름').fill('합성 확인자');
 await expect.poll(()=>dialog.locator('img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
 assert.equal(await dialog.locator('.attendance-register-preview tbody tr').count(),count);assert.equal(await dialog.locator('img').count(),2*count+1);
 const name='attendance-'+count+'-rows';await capture(name+'-preview');await app.evaluate((_e,path)=>{globalThis.__instructor02.pdf=path;globalThis.__instructor02.printError=null;},join(out,name+'.pdf'));
 await dialog.getByRole('button',{name:'미리보기 확인 후 인쇄'}).click();await busy();assert.equal(await app.evaluate(()=>globalThis.__instructor02.printError),null);
 const bytes=await readFile(join(out,name+'.pdf')),pdf=await PDFDocument.load(bytes),pages=pdf.getPages().map(p=>p.getSize());assert.equal(pages.length,count===19?1:2);assert.ok(pages.every(p=>Math.abs(p.width-595.28)<2&&Math.abs(p.height-841.89)<2));
 await writeFile(join(out,name+'-manifest.json'),JSON.stringify({productSha:sha,rows:count,seals:2*count+1,sha256:hash(bytes),pages,rasterReview:'Required after downloading original Windows artifact; native printer NOT RUN'},null,2));
 await pass('Actual Windows Chromium PDF '+count+' rows',{sha256:hash(bytes),rows:count,seals:2*count+1,pages});await dialog.getByRole('button',{name:'출력 취소·닫기'}).click();
}
async function rowsThrough(day){
 const ok=await page.evaluate(async day=>{const base={school:'10000000-0000-0000-0000-000000000001',month:'2026-08'},api=window.electronWorkspace.instructor,r=await api.read(base);if(r.phase!=='ready')throw Error('read');
 const existing=new Set(r.board.logs.map(l=>l.date));const payload=Array.from({length:day},(_,i)=>i+1).map(d=>'2026-08-'+String(d).padStart(2,'0')).filter(date=>!existing.has(date)).map(date=>({instructorId:r.board.instructor.id,date,startTime:'09:00',endTime:'12:00',note:'합성 다중 페이지 QA'}));
 const saved=await api.import({...base,version:r.board.version,request_id:crypto.randomUUID(),payload});if(saved.phase!=='ready'||saved.board.logs.length!==day)throw Error('rows');return true;},day);assert.ok(ok);await instructor().getByRole('button',{name:'최신 자료 조회'}).click();await busy();
}
try{
 await launch();await login();await pass('Actual isolated Windows Electron fixed product launch');stage='fixture-setup';
 const form=instructor().getByRole('form',{name:'강사 운영 설정'}),fields={name:'합성 강사 QA 수정',subject:'학교보건지원',weeklyHours:'14',hourlyRate:'30000',monthlyInsurance:'45000',monthlyHourLimit:'60',weeklyHourLimit:'15',totalBudget:'500000',operationStartDate:'2026-08-01',operationEndDate:'2026-12-31'};
 for(const[key,value]of Object.entries(fields))await form.locator(`[name="${key}"]`).fill(value);await form.getByRole('button',{name:'강사 운영 설정 저장'}).click();await busy();await tab('근무기록');const formLog=instructor().getByRole('form',{name:'근무표 편집'});
 for(const[key,value]of Object.entries({date:'2026-08-04',startTime:'09:00',endTime:'12:00',note:'합성 QA 근무 기록'}))await formLog.locator(`[name="${key}"]`).fill(value);await formLog.getByRole('button',{name:'근무표 저장'}).click();await busy();await tab('설정');await pick('보건교사','teacher');await pick('강사','instructor');await tab('지급명세서·출력');
 await check('Payment XLSX regression',async()=>{await instructor().getByRole('button',{name:'지급명세서 Excel 저장'}).click();await busy();const bytes=await readFile(join(out,'payment.xlsx')),wb=XLSX.read(bytes,{type:'buffer',bookFiles:true}),rows=XLSX.utils.sheet_to_json(wb.Sheets['지급명세서'],{header:1});assert.equal(rows.find(r=>r[0]==='총계')[2],3);assert.equal(rows.find(r=>r[0]==='금액')[2],90000);assert.ok(!Object.keys(wb.files).some(p=>p.startsWith('xl/media/')||p.startsWith('xl/drawings/')));await pass('Payment XLSX regression',{sha256:hash(bytes),hours:3,wages:90000,sealing:'NOT REQUIRED',ExcelApplication:'NOT RUN'});});
 await rowsThrough(19);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(980,700));result.smallWindow=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,rootOverflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(result.smallWindow.rootOverflow,false);
 await check('980 preview visibility and interactions',visiblePreviews);
 if(await page.getByRole('dialog',{name:'출력 미리보기'}).count())await page.keyboard.press('Escape');
 await check('19-row PDF',()=>makePdf(19));if(await page.getByRole('dialog',{name:'출력 미리보기'}).count())await page.keyboard.press('Escape');
 await rowsThrough(31);await check('31-row PDF',()=>makePdf(31));if(await page.getByRole('dialog',{name:'출력 미리보기'}).count())await page.keyboard.press('Escape');
 result.verdict=result.checks.some(c=>c.status==='FAIL')?'FAIL':'CONDITIONAL_PENDING_PDF_RASTER_REVIEW';
}catch(e){result.verdict='FAIL';result.failure={stage,message:String(e).slice(0,1500)};if(page)await capture('failure').catch(()=>{});process.exitCode=1;}
finally{try{await stop();result.normalExit=true;}catch(e){result.normalExit=false;result.cleanupError=String(e);if(app)await app.close().catch(()=>{});process.exitCode=1;}await save();}
if(result.checks.some(c=>c.status==='FAIL'))process.exitCode=1;
