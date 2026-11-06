import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import * as XLSX from 'xlsx';
export async function checkInstructor({page,workspace,tab,mainCall,screenshots,evidenceRoot,result,check}){
 const seed=await page.evaluate(async()=>{
  const api=window.electronWorkspace.instructor,school='10000000-0000-0000-0000-000000000001',month='2026-08';
  let state=await api.read({school,month});
  state=await api.settings({school,month,version:state.board.version,request_id:crypto.randomUUID(),payload:{name:'합성 Windows 강사',subject:'합성 보건업무',weeklyHours:14,hourlyRate:30000,monthlyInsurance:45000,weeklyHourLimit:15,monthlyHourLimit:60,totalBudget:5000000,operationStartDate:'2026-08-01',operationEndDate:'2026-12-31'}});
  if(state.phase!=='ready')throw Error('Instructor settings not saved');
  const rows=Array.from({length:19},(_,i)=>({instructorId:state.board.instructor.id,date:'2026-08-'+String(i+1).padStart(2,'0'),startTime:'09:00',endTime:'10:00',note:'합성 QA'}));
  return api.import({school,month,version:state.board.version,request_id:crypto.randomUUID(),payload:rows});
 });check(seed.phase==='ready'&&seed.board.logs.length===19,'Instructor real IPC/DB import failed');
 await tab('보건지원강사 근무관리');
 // section has an aria-label but no explicit region role in all Chromium builds.
 const section=page.locator('section[aria-label="보건지원강사 근무관리"]');
 await section.getByLabel('조회 월').fill('2026-08');await section.getByRole('button',{name:'최신 자료 조회',exact:true}).click();
 await section.getByRole('button',{name:'지급명세서·출력',exact:true}).click();
 const evidence=[];
 for(const count of [19,31]){
  if(count===31){await page.evaluate(async()=>{const api=window.electronWorkspace.instructor,school='10000000-0000-0000-0000-000000000001',month='2026-08';let s=await api.read({school,month});const rows=Array.from({length:12},(_,i)=>({instructorId:s.board.instructor.id,date:'2026-08-'+String(i+20),startTime:'09:00',endTime:'10:00',note:'합성 QA'}));s=await api.import({school,month,version:s.board.version,request_id:crypto.randomUUID(),payload:rows});if(s.phase!=='ready'||s.board.logs.length!==31)throw Error('31 row import failed');});await section.getByRole('button',{name:'최신 자료 조회',exact:true}).click();}
  await section.getByRole('button',{name:'출근관리부 미리보기',exact:true}).click();const dialog=page.getByRole('dialog',{name:'출력 미리보기',exact:true});await dialog.waitFor();
  check(!await dialog.getByLabel('이번 출력에 강사 도장 포함').isChecked()&&!await dialog.getByLabel('이번 출력에 보건교사 도장 포함').isChecked(),'Stamp default changed');
  check(await dialog.locator('.attendance-register-preview tbody tr').count()===count,'Attendance rows missing');
  await page.screenshot({path:join(screenshots,`instructor-preview-${count}.png`)});
  await page.evaluate(()=>document.body.classList.add('instructor-print'));
  let pdf;
  try{pdf=await mainCall(async function(){const q=globalThis.__school05qa;const bytes=await q.w.webContents.printToPDF({printBackground:true,preferCSSPageSize:true});return bytes.toString('base64');});}finally{await page.evaluate(()=>document.body.classList.remove('instructor-print'));}
  const bytes=Buffer.from(pdf,'base64');await writeFile(join(evidenceRoot,`instructor-attendance-${count}.pdf`),bytes);const pages=(await PDFDocument.load(bytes)).getPageCount();check(pages===(count===19?1:2),'Instructor PDF page count changed');evidence.push({rows:count,pages,stampDefaultOff:true,engine:'actual Windows Electron printToPDF; not physical print'});
  await dialog.getByRole('button',{name:'출력 취소·닫기',exact:true}).click();
 }
 await section.getByRole('button',{name:'지급명세서 미리보기',exact:true}).click();await page.getByText('지급명세서는 날인이 필요하지 않습니다. 도장 이미지를 삽입하지 않습니다.',{exact:true}).waitFor();check(await page.getByRole('dialog',{name:'출력 미리보기'}).locator('.instructor-print-stamp').count()===0,'Payment stamp appeared');await page.getByRole('button',{name:'출력 취소·닫기',exact:true}).click();
 const state=await page.evaluate(()=>window.electronWorkspace.instructor.read({school:'10000000-0000-0000-0000-000000000001',month:'2026-08'}));
 const workerData={kind:'write',board:state.board,month:'2026-08'};
 const base64=await mainCall(new Function(`return (async()=>{const req=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json'),{Worker}=req('node:worker_threads'),{join}=req('node:path'),{pathToFileURL}=req('node:url'),q=globalThis.__school05qa;return await new Promise((ok,bad)=>{const w=new Worker(pathToFileURL(join(q.e.app.getAppPath(),'main/instructor-workbook-worker.js')),{workerData:${JSON.stringify(workerData)}});w.once('message',b=>{void w.terminate();ok(Buffer.from(b).toString('base64'));});w.once('error',bad);});})()`));
 const workbook=Buffer.from(base64,'base64');check(!workbook.includes(Buffer.from('xl/media/')),'Payment XLSX contains media');const wb=XLSX.read(workbook,{type:'buffer'}),rows=XLSX.utils.sheet_to_json(wb.Sheets['지급명세서'],{header:1});check(rows.at(-1)[2]===930000,'Payment calculation changed');await writeFile(join(evidenceRoot,'instructor-payment-synthetic.xlsx'),workbook);
 result.instructor={verdict:'PASS',dbAndIpc:true,pdf:evidence,xlsx:{actualMainWorker:true,rows:31,wages:930000,stamp:'NOT REQUIRED; no media'},physicalPrint:'NOT RUN',nativeSaveDialog:'NOT RUN'};
}
