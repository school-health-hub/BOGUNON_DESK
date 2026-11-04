import {afterEach,it,expect,vi} from 'vitest';
import {mkdtemp,writeFile,readFile,rm,symlink,readdir,chmod} from 'node:fs/promises';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {createRecordHelperHandlers,validateReviewedRequest} from '../main/record-helper-ipc';
import {RecordHelperProcess} from '../main/record-helper-process';
import {ChatGptService} from '../main/chatgpt-service';import {ChatGptError} from '../main/chatgpt-process';
import {evaluateRecordHelperOutbound as originalEvaluate} from '../../src/record-helper/recordHelperAiService';
import {evaluateRecordHelperOutbound} from '../main/record-helper/recordHelperAiService';
import {deidentifyRecordHelperContent as originalRedact} from '../../src/record-helper/deidentification';
import {deidentifyRecordHelperContent} from '../main/record-helper/deidentification';
import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';
const roots:string[]=[];async function root(){const d=await mkdtemp(join(tmpdir(),'record-helper-'));roots.push(d);return d;}
afterEach(async()=>{vi.restoreAllMocks();for(const d of roots.splice(0))await rm(d,{recursive:true,force:true});});
const account='a'.repeat(64),model='gpt-synthetic',url='file:///renderer/index.html',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
const packet=()=>({reportId:'synthetic-report-1',requestId:1,accountId:account,model,approved:true as const,packet:{reportText:'실험 절차를 설명하고 활동 결과를 정리함.',teacherMemo:'토론에 참여한 과정을 관찰함.'},identityHints:['가상학생','가상학급']});
function setup(paths:readonly string[]=[],timeoutMs?:number){
 const run=vi.fn(async(r:Record<string,unknown>,_signal:AbortSignal):Promise<any>=>r.action==='generate'?{accountId:account,text:'합성 기록 초안'}:r.action==='models'?{state:{accountId:account,connection:{status:'connected',planUsageEnabled:true,showPlanUsageNotice:false}},models:[{slug:model,displayName:'합성 모델'}]}:{accountId:account,connection:{status:'connected',planUsageEnabled:true,showPlanUsageNotice:false}});
 const review=vi.fn(async(_request:unknown,_model:string)=>true),service=new ChatGptService({available:true,run,dispose:vi.fn(),flush:async()=>{}},review),extractor=new RecordHelperProcess(resolve('build/record-helper-cli',process.platform==='win32'?'record-helper-cli.exe':'record-helper-cli'));
 return {run,review,service,extractor,h:createRecordHelperHandlers(wc,url,{pick:async()=>paths,extractor,chatgpt:service,timeoutMs})};
}
async function ready(c:ReturnType<typeof setup>){await c.service.status();await c.service.refreshModels();}
it.each(['synthetic.pdf','synthetic.docx','synthetic.hwpx','synthetic.hwp','compressed.hwp'])('extracts %s using the actual read-only native helper with no persistent or temporary output',async name=>{
 const path=resolve('build/record-helper-fixtures',name),before=createHash('sha256').update(await readFile(path)).digest('hex'),c=setup([path]);
 const r=await c.h.pick(event);expect(r.ok).toBe(true);if(!r.ok||!r.data)throw Error();expect(r.data.reports).toHaveLength(1);expect(r.data.failures).toEqual([]);expect(r.data.reports[0].text.trim().length).toBeGreaterThan(5);expect(r.data.reports[0].sourceName).toBe(name);expect(createHash('sha256').update(await readFile(path)).digest('hex')).toBe(before);await c.h.flush();
});
it('reports corrupt/encrypted/oversized/linked inputs separately and preserves other successful files',async()=>{
 const d=await root(),bad=join(d,'broken.pdf'),huge=join(d,'huge.docx'),link=join(d,'link.hwpx');await writeFile(bad,'not a PDF');const {open}=await import('node:fs/promises');const f=await open(huge,'w');await f.truncate(15*1024*1024+1);await f.close();await symlink(resolve('build/record-helper-fixtures/synthetic.hwpx'),link);
 const c=setup([resolve('build/record-helper-fixtures/synthetic.docx'),bad,resolve('build/record-helper-fixtures/protected.hwp'),resolve('build/record-helper-fixtures/encrypted.pdf'),huge,link]),r=await c.h.pick(event);expect(r.ok).toBe(true);if(!r.ok||!r.data)throw Error();expect(r.data.reports).toHaveLength(1);expect(r.data.failures).toHaveLength(5);expect(JSON.stringify(r)).not.toContain(d);expect((await readdir(d)).sort()).toEqual(['broken.pdf','huge.docx','link.hwpx']);
});
it('rejects excessive selection count before invoking the extractor',async()=>{
 const c=setup(Array(51).fill(resolve('build/record-helper-fixtures/synthetic.pdf'))),spy=vi.spyOn(c.extractor,'run');expect(await c.h.pick(event)).toMatchObject({ok:false});expect(spy).not.toHaveBeenCalled();
});
it('preserves earlier files when the batch deadline expires and marks remaining files as failures',async()=>{
 const first=resolve('build/record-helper-fixtures/synthetic.pdf'),second=resolve('build/record-helper-fixtures/synthetic.docx'),third=resolve('build/record-helper-fixtures/synthetic.hwpx'),c=setup();
 const run=vi.fn(async(path:string,signal:AbortSignal)=>{if(path===first)return {reports:[{sourceName:'synthetic.pdf',format:'pdf' as const,text:'합성 활동 기록을 정리함.'}],failures:[]};return new Promise<never>((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true});});});
 const h=createRecordHelperHandlers(wc,url,{pick:async()=>[first,second,third],extractor:{run,flush:async()=>{}},chatgpt:c.service,batchMs:50});
 const r=await h.pick(event);expect(r.ok).toBe(true);if(!r.ok||!r.data)throw Error();expect(r.data.reports.map(v=>v.sourceName)).toEqual(['synthetic.pdf']);expect(r.data.failures.map(v=>v.sourceName)).toEqual(['synthetic.docx','synthetic.hwpx']);expect(run).toHaveBeenCalledTimes(2);
});
it.skipIf(process.platform==='win32')('terminates only its owned extraction process on timeout/cancel and waits for close',async()=>{
 const d=await root(),script=join(d,'owned-helper');await writeFile(script,`#!${process.execPath}\nprocess.stdin.resume();setInterval(()=>{},1000);\n`);await chmod(script,0o700);
 const helper=new RecordHelperProcess(script,30);await expect(helper.run('/synthetic.pdf',new AbortController().signal)).rejects.toThrow();await helper.flush();
 const controller=new AbortController(),pending=new RecordHelperProcess(script,30000);const request=pending.run('/synthetic.pdf',controller.signal);controller.abort();await expect(request).rejects.toThrow();await pending.flush();
 expect(await readdir(d)).toEqual(['owned-helper']);
});
it('keeps original deidentification and outbound privacy gates identical in Main and Renderer',()=>{
 for(const input of [{reportText:'학생명: 김가상 연락처: 010-0000-0000 활동 정리',teacherMemo:'김가상 관찰',studentLabel:'김가상',classLabel:'가상반'},{reportText:'실험 활동을 관찰함.',teacherMemo:'협력함',studentLabel:'',classLabel:''}])expect(deidentifyRecordHelperContent(input)).toEqual(originalRedact(input));
 for(const text of ['활동 과정을 설명함.','학생명: 김가상','치료 및 상담 기록','x'.repeat(65537)])expect(evaluateRecordHelperOutbound(text,'교사 관찰',['김가상'])).toEqual(originalEvaluate(text,'교사 관찰',['김가상']));
});
it('blocks approval omissions, raw identities, sensitive content, arbitrary prompt/paths and oversized packets with zero native AI calls',async()=>{
 const c=setup();await ready(c);const p=packet();
 for(const invalid of [{...p,approved:false},{...p,prompt:'bypass'},{...p,path:'/forged'},{...p,packet:{...p.packet,reportText:'가상학생이 참여함'}},{...p,packet:{...p.packet,reportText:'학생명: 김가상'}},{...p,packet:{...p.packet,teacherMemo:'진단 및 상담 내용'}},{...p,packet:{...p.packet,reportText:'x'.repeat(65537)}}]){expect(()=>validateReviewedRequest(invalid)).toThrow();expect(await c.h.generateReviewed(event,invalid)).toMatchObject({ok:false});}
 expect(c.review).not.toHaveBeenCalled();expect(c.run.mock.calls.filter(([r])=>r.action==='generate')).toHaveLength(0);
});
it('uses the existing ChatGPT account/model service only after both Renderer approval and Main consent',async()=>{
 const c=setup();await ready(c);c.review.mockResolvedValueOnce(false);expect(await c.h.generateReviewed(event,packet())).toEqual({ok:true,data:null});expect(c.run.mock.calls.filter(([r])=>r.action==='generate')).toHaveLength(0);
 expect(await c.h.generateReviewed(event,packet())).toEqual({ok:true,data:{text:'합성 기록 초안'}});expect(c.review.mock.calls[0][0]).toMatchObject({tool:'record-helper',prompt:evaluateRecordHelperOutbound(packet().packet.reportText,packet().packet.teacherMemo,packet().identityHints).prompt});
 const request=c.run.mock.calls.find(([r])=>r.action==='generate')![0];expect(request).toMatchObject({accountId:account,model});expect(JSON.stringify(request)).not.toContain('가상학생');expect(request).not.toHaveProperty('reportId');
 await expect(c.service.generate({tool:'record-helper',prompt:'bypass generic IPC'})).rejects.toThrow();
});
it('rejects stale account/model bindings and does not cancel another module request',async()=>{
 const c=setup();await ready(c);expect(await c.h.generateReviewed(event,{...packet(),accountId:'b'.repeat(64)})).toMatchObject({ok:false});expect(await c.h.generateReviewed(event,{...packet(),model:'other'})).toMatchObject({ok:false});
 let finish!:(v:unknown)=>void;c.run.mockImplementationOnce((_r,signal)=>new Promise((resolve,reject)=>{finish=resolve;signal.addEventListener('abort',()=>reject(new ChatGptError('cancelled')));}));const other=c.service.generate({tool:'finder',prompt:'합성 설명'});await vi.waitFor(()=>expect(c.run.mock.calls.some(([r])=>r.action==='generate')).toBe(true));await c.h.clear(event);expect(await c.h.generateReviewed(event,packet())).toMatchObject({ok:false});expect(c.service.snapshot().busy).toBe(true);finish({accountId:account,text:'다른 도구 합성 응답'});expect(await other).toEqual({text:'다른 도구 합성 응답'});
});
it('cancels only the matching student request, rejects late responses and releases the helper',async()=>{
 const c=setup();await ready(c);let finish!:(v:unknown)=>void;c.run.mockImplementationOnce((_r,signal)=>new Promise((resolve,reject)=>{finish=resolve;signal.addEventListener('abort',()=>reject(new ChatGptError('cancelled')),{once:true});}));const pending=c.h.generateReviewed(event,packet());await vi.waitFor(()=>expect(c.run.mock.calls.some(([r])=>r.action==='generate')).toBe(true));await c.h.cancelAi(event,{reportId:'another-student'});expect(c.service.snapshot().busy).toBe(true);await c.h.cancelAi(event,{reportId:packet().reportId});await pending;finish({accountId:account,text:'폐기된 늦은 초안'});expect(c.service.snapshot().busy).toBe(false);await c.h.flush();
});
it('times out an owned AI call without retrying or retaining a draft',async()=>{
 const c=setup([],15);await ready(c);c.run.mockImplementationOnce((_r,signal)=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(new ChatGptError('cancelled')),{once:true});}));expect(await c.h.generateReviewed(event,packet())).toMatchObject({ok:false});expect(c.run.mock.calls.filter(([r])=>r.action==='generate')).toHaveLength(1);expect(c.service.snapshot().busy).toBe(false);
});
it('cancels a pending picker and rejects forged callers/frames/path arguments with no file read',async()=>{
 const c=setup(),select=vi.fn(()=>new Promise<readonly string[]>(()=>{})),h=createRecordHelperHandlers(wc,url,{pick:select,extractor:c.extractor,chatgpt:c.service});
 expect(await h.pick({...event,sender:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await h.pick({...event,senderFrame:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await h.pick(event,'/forged.pdf')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(select).not.toHaveBeenCalled();const pending=h.pick(event);await h.cancelImport(event);expect(await pending).toEqual({ok:true,data:null});h.dispose();await h.flush();expect(await h.pick(event)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
});
it('preload exposes only frozen typed Record operations without raw paths or keys',async()=>{
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>({ok:true,data:null})),code=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports:{},process:{sandboxed:true,contextIsolated:true},require:(name:string)=>{if(name!=='electron')throw Error();return {contextBridge:{exposeInMainWorld:(key:string,value:unknown)=>{exposed[key]=value;}},ipcRenderer:{invoke}};}});
 const api=exposed.electronWork.recordHelper;expect(Object.isFrozen(api)).toBe(true);expect(Object.keys(api)).toEqual(['pick','cancelImport','generateReviewed','cancelAi','clear']);await api.pick('forged');expect(invoke.mock.calls.at(-1)).toEqual(['p2:record:pick']);await api.generateReviewed(packet());expect(invoke.mock.calls.at(-1)).toEqual(['p2:record:generateReviewed',packet()]);expect(api.invoke).toBeUndefined();expect(api.readFile).toBeUndefined();
});
