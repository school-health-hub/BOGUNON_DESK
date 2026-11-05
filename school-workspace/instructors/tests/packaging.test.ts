import {it,expect} from 'vitest';import {readFile} from 'node:fs/promises';import {Worker} from 'node:worker_threads';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import * as XLSX from 'xlsx';
it('built Main worker performs offline XLSX round trip and is covered by existing ASAR main glob',async()=>{
 const builder=JSON.parse(await readFile('electron-p0/builder.json','utf8'));expect(builder.files).toContain('main/**');expect(builder.extraResources).toBeTruthy();
 expect(await readFile('build/electron-p0-app/main/instructor-sheetjs-license.txt','utf8')).toBe(await readFile('school-workspace/instructors/SHEETJS-LICENSE.txt','utf8'));
 const source=await readFile('build/electron-p0-app/main/instructor-workbook-worker.js','utf8');expect(source).not.toMatch(/from\s*["']xlsx/);
 const call=(workerData:unknown)=>new Promise<any>((resolveResult,reject)=>{const w=new Worker(pathToFileURL(resolve('build/electron-p0-app/main/instructor-workbook-worker.js')),{workerData});const t=setTimeout(()=>{void w.terminate();reject(Error('worker_timeout'));},5000);w.once('message',value=>{clearTimeout(t);void w.terminate();resolveResult(value);});w.once('error',reject);});
 const instructor={id:'a',name:'합성 강사',subject:'합성 업무',hourlyRate:30000,monthlyInsurance:45000,weeklyHours:14,weeklyHourLimit:15,monthlyHourLimit:60,totalBudget:500000};
 const bytes=await call({kind:'write',month:'2026-08',board:{instructor,logs:[{instructorId:'a',date:'2026-08-04',startTime:'09:00',endTime:'12:00',note:'합성'}]}});expect(bytes).toBeInstanceOf(Uint8Array);const book=XLSX.read(bytes,{type:'array'});expect(book.SheetNames).toEqual(['지급명세서']);
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['날짜','요일','시작시간','종료시간','실근무시간','비고','주차','표시여부','이번달'],['2026-08-04','','09:00','12:00','','합성']]),'근무기록');const imported=await call({kind:'read',bytes:new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})),input:{instructorId:'a',existingLogs:[]}});expect(imported.rows[0]).toMatchObject({date:'2026-08-04',startTime:'09:00',endTime:'12:00',status:'ready'});
 const resources=JSON.stringify([builder.extraResources,builder.win?.extraResources]);for(const name of ['purchase-excel-cli','official-document-cli','my-finance-cli','chatgpt-auth-cli','record-helper-cli','purchase-ocr'])expect(resources).toContain(name);
});
