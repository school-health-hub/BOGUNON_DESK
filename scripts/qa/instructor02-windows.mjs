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
const sha='002a095f238a505b284f3af4f8a46ca101207411';
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim(),sha);
const run=randomUUID(),qaRoot=process.env.ELECTRON_P0_QA_ROOT;
const result={sourceSha:sha,classification:'Actual Windows Electron, native loopback PostgreSQL, synthetic Auth; not Portable or Hosted',checks:[],notRun:['Physical printer','Native OS file/save/confirmation dialogs (narrow QA return-value substitution)','Native OS print preview dialog (real Chromium printToPDF instead)','Microsoft Excel desktop application','Instructor standalone web GUI'],captures:[],externalRendererRequests:[],verdict:'NOT RUN'};
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
const capture=async name=>{await page.screenshot({path:join(out,name+'.png')});result.captures.push(name+'.png');};
const busy=async()=>expect(page.getByRole('region',{name:'보건지원강사 근무관리',exact:true})).toHaveAttribute('aria-busy','false');
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
 await page.getByRole('navigation',{name:'주요 기능'}).locator('button[data-dock-item="toolbox"]').click();
 await page.getByRole('button',{name:/우리 보건실 · 학교 공유/}).click();
 await expect.poll(()=>page.evaluate(()=>window.electronWorkspace.status().then(s=>s.mode))).toBe('qa');
 const info=await page.evaluate(()=>window.electronP0.info());
 result.runtime=info;assert.equal(info.sourceSha,sha);assert.ok(info.userData.startsWith(qaRoot));
 await app.evaluate(({dialog,BrowserWindow},paths)=>{
  globalThis.__instructor02={pick:paths.teacher,pdf:null,printError:null};
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[globalThis.__instructor02.pick]});
  dialog.showSaveDialog=async()=>({canceled:false,filePath:paths.workbook});
  dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});
  BrowserWindow.getAllWindows()[0].webContents.print=(_options,callback)=>{
   const q=globalThis.__instructor02;
   BrowserWindow.getAllWindows()[0].webContents.printToPDF({preferCSSPageSize:true,printBackground:true}).then(async bytes=>{
    await (await import('node:fs/promises')).writeFile(q.pdf,bytes);callback(true);
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
async function preview(name,teacher,instructorSeal){
 await instructor().getByRole('button',{name:'출근관리부 미리보기',exact:true}).click();await busy();
 const dialog=page.getByRole('dialog',{name:'출력 미리보기',exact:true});
 await expect(dialog.getByLabel('이번 출력에 강사 도장 포함')).not.toBeChecked();
 await expect(dialog.getByLabel('이번 출력에 보건교사 도장 포함')).not.toBeChecked();
 await dialog.getByLabel('이번 출력에 강사 도장 포함').setChecked(instructorSeal);
 await dialog.getByLabel('이번 출력에 보건교사 도장 포함').setChecked(teacher);
 await dialog.getByLabel('확인자 이름').fill('합성 확인자');
 const geometry=await dialog.locator('.attendance-register-preview').evaluate(el=>{
  const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  return [...el.querySelectorAll('img')].map(img=>({alt:img.alt,box:box(img),parent:box(img.parentElement),inside:(()=>{const a=img.getBoundingClientRect(),b=img.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;})()}));
 });
 assert.equal(geometry.length,(teacher?2:0)+(instructorSeal?1:0));assert.ok(geometry.every(g=>g.inside));
 await capture(name);
 await app.evaluate((_e,path)=>{globalThis.__instructor02.pdf=path;},join(out,name+'.pdf'));
 await dialog.getByRole('button',{name:'미리보기 확인 후 인쇄'}).click();await busy();
 assert.equal(await app.evaluate(()=>globalThis.__instructor02.printError),null);
 const pdf=await PDFDocument.load(await readFile(join(out,name+'.pdf')));
 const pages=pdf.getPages().map(p=>p.getSize());assert.ok(pages.every(p=>Math.abs(p.width-595.28)<2&&Math.abs(p.height-841.89)<2));
 await pass(name,{geometry,pages});
 await dialog.getByRole('button',{name:'출력 취소·닫기'}).click();
}
try{
 await launch();await login();await capture('teacher-empty');await pass('Windows Electron launches isolated fixed product');
 stage='register';
 const form=instructor().getByRole('form',{name:'강사 운영 설정'});
 const fields={name:'합성 강사 QA',subject:'학교보건지원',weeklyHours:'14',hourlyRate:'30000',monthlyInsurance:'45000',monthlyHourLimit:'60',weeklyHourLimit:'15',totalBudget:'500000',operationStartDate:'2026-08-01',operationEndDate:'2026-12-31'};
 for(const [key,value]of Object.entries(fields))await form.locator(`[name="${key}"]`).fill(value);
 await form.getByRole('button',{name:'강사 운영 설정 저장'}).click();await busy();
 await expect(form.locator('[name="name"]')).toHaveValue(fields.name);
 await form.locator('[name="name"]').fill('합성 강사 QA 수정');await form.getByRole('button',{name:'강사 운영 설정 저장'}).click();await busy();
 await pass('Teacher registers and edits Instructor settings through real UI and DB');
 stage='log';await tab('근무기록');const log=instructor().getByRole('form',{name:'근무표 편집'});
 for(const [key,value]of Object.entries({date:'2026-08-04',startTime:'09:00',endTime:'12:00',note:'합성 QA 근무 기록'}))await log.locator(`[name="${key}"]`).fill(value);
 await log.getByRole('button',{name:'근무표 저장'}).click();await busy();
 await expect(instructor().getByRole('list',{name:'근무기록 수정 목록'}).getByRole('listitem')).toHaveCount(1);
 await capture('teacher-saved-log');await pass('Synthetic work log saved and queried');
 stage='stamps';await tab('설정');
 const teacher=await pick('보건교사','teacher'),assistant=await pick('강사','instructor');assert.notEqual(hash(teacher),hash(assistant));
 await pick('강사','replacement');assert.equal(await instructor().getByAltText('등록한 보건교사 도장').getAttribute('src'),teacher);
 await instructor().getByRole('button',{name:'강사 도장 삭제',exact:true}).click();await busy();await expect(instructor().getByAltText('등록한 강사 도장')).toHaveCount(0);
 assert.equal(await instructor().getByAltText('등록한 보건교사 도장').getAttribute('src'),teacher);await pick('강사','instructor');
 await capture('independent-stamps');await pass('Instructor stamp register/preview/replace/delete preserves separate teacher stamp',{teacherHash:hash(teacher),instructorHash:hash(assistant),nativeDialog:'NOT RUN; return path substituted'});
 await pick('보건교사','replacement');assert.equal(await instructor().getByAltText('등록한 강사 도장').getAttribute('src'),assistant);
 await instructor().getByRole('button',{name:'보건교사 도장 삭제',exact:true}).click();await busy();await expect(instructor().getByAltText('등록한 보건교사 도장')).toHaveCount(0);
 assert.equal(await instructor().getByAltText('등록한 강사 도장').getAttribute('src'),assistant);await pick('보건교사','teacher');await pass('Teacher stamp replace/delete preserves instructor stamp');
 stage='outputs';await tab('지급명세서·출력');
 await preview('attendance-no-stamps',false,false);await preview('attendance-instructor-only',false,true);await preview('attendance-teacher-only',true,false);await preview('attendance-both-stamps',true,true);
 await instructor().getByRole('button',{name:'지급명세서 Excel 저장'}).click();await busy();
 const bytes=await readFile(join(out,'payment.xlsx'));const workbook=XLSX.read(bytes,{type:'buffer',bookFiles:true});
 assert.deepEqual(workbook.SheetNames,['지급명세서']);const rows=XLSX.utils.sheet_to_json(workbook.Sheets['지급명세서'],{header:1});
 assert.equal(rows.find(r=>r[0]==='총계')[2],3);assert.equal(rows.find(r=>r[0]==='금액')[2],90000);
 const paths=Object.keys(workbook.files??{});assert.ok(!paths.some(p=>p.startsWith('xl/media/')||p.startsWith('xl/drawings/')));
 const formulaCount=Object.values(workbook.Sheets['지급명세서']).filter(v=>v&&typeof v==='object'&&v.f).length;
 const xml=paths.filter(p=>p.endsWith('.xml')).map(p=>String(workbook.files[p].content)).join('\n');
 await pass('Actual worker XLSX export reopens with expected calculation and no stamp images',{rows,sha256:hash(bytes),formulaCount,explicitPageSetup:xml.includes('<pageSetup'),explicitPrintArea:xml.includes('_xlnm.Print_Area'),excelApplication:'NOT RUN'});
 await instructor().getByRole('button',{name:'지급명세서 미리보기'}).click();const payment=page.getByRole('dialog',{name:'출력 미리보기'});
 assert.equal(await payment.locator('img').count(),0);await capture('payment-no-stamp');await payment.getByRole('button',{name:'출력 취소·닫기'}).click();
 stage='small-window';await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(980,700));
 await capture('instructor-980x700');result.smallWindow=await page.evaluate(()=>({width:innerWidth,height:innerHeight,rootOverflow:document.documentElement.scrollWidth>innerWidth,devicePixelRatio}));
 await instructor().getByRole('button',{name:'지급명세서 Excel 저장'}).scrollIntoViewIfNeeded();await expect(instructor().getByRole('button',{name:'지급명세서 Excel 저장'})).toBeInViewport();
 await pass('980x700 main output button reachable',result.smallWindow);
 stage='restart';await stop();await launch();await login();await tab('근무기록');await expect(instructor().getByRole('list',{name:'근무기록 수정 목록'}).getByRole('listitem')).toHaveCount(1);
 await tab('설정');await expect(instructor().getByAltText('등록한 강사 도장')).toBeVisible();await expect(instructor().getByAltText('등록한 보건교사 도장')).toBeVisible();await capture('restart-restored');await pass('Normal quit/relaunch restores DB record and both encrypted local stamps');
 stage='multi-page';
 const imported=await page.evaluate(async()=>{
  const base={school:'10000000-0000-0000-0000-000000000001',month:'2026-08'},api=window.electronWorkspace.instructor;
  const read=await api.read(base);if(read.phase!=='ready')return false;
  const payload=Array.from({length:31},(_,i)=>i+1).filter(d=>d!==4).map(d=>({instructorId:read.board.instructor.id,date:'2026-08-'+String(d).padStart(2,'0'),startTime:'09:00',endTime:'12:00',note:'합성 다중 페이지 QA'}));
  return (await api.import({...base,version:read.board.version,request_id:crypto.randomUUID(),payload})).phase==='ready';
 });assert.ok(imported);await instructor().getByRole('button',{name:'최신 자료 조회'}).click();await busy();await tab('지급명세서·출력');
 await preview('attendance-multiple-pages',true,true);assert.ok(result.checks.at(-1).pages.length>1);
 stage='assistant';await page.getByRole('button',{name:'공동 계정 로그아웃'}).click();await login(4);
 await expect(instructor().getByRole('region',{name:'월별 근무표'})).toContainText('3시간');assert.equal(await instructor().getByRole('navigation',{name:'강사 관리 메뉴'}).count(),0);assert.equal(await instructor().getByRole('form').count(),0);
 const denied=await page.evaluate(async()=>{const r=await window.electronWorkspace.instructor.settings({school:'10000000-0000-0000-0000-000000000001',month:'2026-08',version:3,request_id:crypto.randomUUID(),payload:{name:'합성 거부 시도'}});return r.phase!=='ready';});assert.ok(denied);
 await capture('assistant-read-only');await pass('Assistant Electron schedule read-only and direct settings IPC denied');
 result.verdict='CONDITIONAL';
}catch(e){result.verdict='FAIL';result.failure={stage,message:String(e).slice(0,1500)};if(page){await capture('failure').catch(()=>{});await writeFile(join(out,'failure-ui.txt'),await page.locator('body').innerText().catch(()=>''));}process.exitCode=1;}
finally{try{await stop();result.normalExit=true;}catch(e){result.normalExit=false;result.cleanupError=String(e);if(app)await app.close().catch(()=>{});process.exitCode=1;}await save();}
