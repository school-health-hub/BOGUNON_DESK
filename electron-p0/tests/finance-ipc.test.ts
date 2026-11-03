import {it,expect,vi} from 'vitest';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {FinanceService,createFinanceHandlers,validateFinanceInput} from '../main/finance-ipc';
import {FINANCE_FAILURE,type FinanceWorker} from '../main/finance-process';
const id='00000000-0000-4000-8000-000000000001',token='00000000-0000-4000-8000-000000000002';
const expected={schemaVersion:2 as const,datasetId:id,revision:1,history:[id]},snapshot={identity:expected,income:[]};
const entry={id,sourceName:'합성 지급처',incomeKind:'lecture',contractLabel:'합성',taxCategory:'unverified',taxCategoryVerified:false,earnedOn:'2026-01-01',paidOn:null,grossKrw:100,deductions:[],netKrw:100,notes:''};
function setup(root='/synthetic/private'){const worker:FinanceWorker={available:vi.fn(async()=>true),call:vi.fn(async()=>snapshot),close:vi.fn(async()=>{})},pickBackup=vi.fn(async():Promise<string|undefined>=>undefined),saveBackup=vi.fn(async():Promise<string|undefined>=>undefined),reviewRestore=vi.fn(async()=>true);const service=new FinanceService({worker,protectedRoot:root,pickBackup,saveBackup,reviewRestore});return {service,worker,pickBackup,saveBackup,reviewRestore};}
it('validates explicit arguments; rejects path/SQL/key, stale schema, unsafe integers and oversized passwords',()=>{
 expect(validateFinanceInput('createIncome',{expected,entry})).toEqual({expected,entry});
 for(const input of [{expected,entry,path:'C:/other'},{expected:{...expected,schemaVersion:1},entry},{expected,entry:{...entry,grossKrw:-Infinity}},{expected,entry:{...entry,notes:'x'.repeat(5001)}},{expected:{...expected,revision:Number.MAX_SAFE_INTEGER+1},entry}])expect(()=>validateFinanceInput('createIncome',input)).toThrow();
 expect(()=>validateFinanceInput('load',{sql:'SELECT *'})).toThrow();expect(()=>validateFinanceInput('exportBackup',{expected,password:'short'})).toThrow();expect(()=>validateFinanceInput('inspectBackup',{token,password:'x'.repeat(1025)})).toThrow();
});
it('checks exact window/frame/URL/arity and never returns raw native error details',async()=>{
 const ctx=setup(),frame={},contents={mainFrame:frame,getURL:()=> 'file:///synthetic/index.html'},handlers=createFinanceHandlers(contents,contents.getURL(),ctx.service),event={sender:contents,senderFrame:frame};
 expect(await handlers.load({...event,senderFrame:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await handlers.load({...event,sender:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await handlers.load(event,'extra')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 vi.mocked(ctx.worker.call).mockRejectedValueOnce(Error('synthetic-password-must-not-escape'));const result=await handlers.createIncome(event,{expected,entry});expect(result).toMatchObject({ok:false,error:{retryable:false,message:FINANCE_FAILURE}});expect(JSON.stringify(result)).not.toContain('synthetic-password-must-not-escape');
 contents.getURL=()=> 'https://other.test';expect(await handlers.load(event)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
});
it('forwards CAS identity and original records unchanged and requires reload after uncertain mutation',async()=>{
 const ctx=setup();expect(await ctx.service.execute('createIncome',{expected,entry})).toEqual(snapshot);expect(ctx.worker.call).toHaveBeenCalledWith({operation:'createIncome',expected,entry});
 vi.mocked(ctx.worker.call).mockRejectedValueOnce(Error('uncertain'));await expect(ctx.service.execute('deleteIncome',{expected,id})).rejects.toThrow();const calls=vi.mocked(ctx.worker.call).mock.calls.length;await expect(ctx.service.execute('updateIncome',{expected,entry})).rejects.toThrow();expect(ctx.worker.call).toHaveBeenCalledTimes(calls);await ctx.service.execute('load');expect(ctx.worker.close).toHaveBeenCalledTimes(1);
});
it('keeps cancel safe: no picker result means no worker request; unsupported host never opens dialogs',async()=>{
 const ctx=setup();expect(await ctx.service.execute('exportBackup',{expected,password:'synthetic-password-123'})).toBe(false);expect(await ctx.service.execute('selectBackup')).toBeNull();expect(ctx.worker.call).not.toHaveBeenCalled();vi.mocked(ctx.worker.available).mockResolvedValue(false);await expect(ctx.service.execute('selectBackup')).rejects.toThrow('Windows');expect(ctx.pickBackup).toHaveBeenCalledTimes(1);
});
it('allows only picker-selected encrypted backups outside protected storage and never overwrites',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'finance-picker-')),privateRoot=join(dir,'private');await mkdir(privateRoot);const ctx=setup(privateRoot);
 try{const original=join(dir,'existing.bgfnbk');await writeFile(original,'SYNTHETIC ENCRYPTED FILE');ctx.saveBackup.mockResolvedValue(original);await expect(ctx.service.execute('exportBackup',{expected,password:'synthetic-password-123'})).rejects.toThrow();expect(await readFile(original,'utf8')).toBe('SYNTHETIC ENCRYPTED FILE');expect(ctx.worker.call).not.toHaveBeenCalled();await ctx.service.execute('load');
  ctx.saveBackup.mockResolvedValue(join(privateRoot,'forbidden.bgfnbk'));await expect(ctx.service.execute('exportBackup',{expected,password:'synthetic-password-123'})).rejects.toThrow();await ctx.service.execute('load');ctx.saveBackup.mockResolvedValue(join(dir,'plaintext.json'));await expect(ctx.service.execute('exportBackup',{expected,password:'synthetic-password-123'})).rejects.toThrow();
  await ctx.service.execute('load');const next=join(dir,'new.bgfnbk');ctx.saveBackup.mockResolvedValue(next);vi.mocked(ctx.worker.call).mockResolvedValueOnce(true);expect(await ctx.service.execute('exportBackup',{expected,password:'synthetic-password-123'})).toBe(true);expect(ctx.worker.call).toHaveBeenLastCalledWith({operation:'exportBackup',path:next,expected,password:'synthetic-password-123'});
 }finally{await ctx.service.close();await rm(dir,{recursive:true,force:true});}
});
it('binds restore to the selected token and current engine; preserves explicit dataset confirmation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'finance-restore-')),path=join(dir,'source.bgfnbk');await writeFile(path,'SYNTHETIC ENCRYPTED BACKUP');const ctx=setup(join(dir,'private'));
 try{ctx.pickBackup.mockResolvedValue(path);vi.mocked(ctx.worker.call).mockResolvedValueOnce(token);expect(await ctx.service.execute('selectBackup')).toBe(token);
  await expect(ctx.service.execute('inspectBackup',{token:id,password:'synthetic-password-123'})).rejects.toThrow();
  const preview={token,eligible:true,reason:'합성 검사',requiresDatasetConfirmation:true,currentDatasetId:id,backupDatasetId:token,currentRevision:1,backupRevision:2,recordCount:1};vi.mocked(ctx.worker.call).mockResolvedValueOnce(preview);expect(await ctx.service.execute('inspectBackup',{token,password:'synthetic-password-123'})).toEqual(preview);
  vi.mocked(ctx.worker.call).mockResolvedValueOnce(snapshot);expect(await ctx.service.execute('restoreBackup',{token,confirmDatasetChange:true})).toEqual(snapshot);expect(ctx.worker.call).toHaveBeenLastCalledWith({operation:'restoreBackup',token,confirmDatasetChange:true});expect(ctx.reviewRestore).toHaveBeenCalledTimes(1);
  await expect(ctx.service.execute('inspectBackup',{token,password:'synthetic-password-123'})).rejects.toThrow();expect(await readFile(path,'utf8')).toBe('SYNTHETIC ENCRYPTED BACKUP');
 }finally{await ctx.service.close();await rm(dir,{recursive:true,force:true});}
});
it('serializes fire-and-forget ticket cancellation before selection and rejects queued work after close',async()=>{
 const ctx=setup();let release!:(value:unknown)=>void;vi.mocked(ctx.worker.call).mockImplementationOnce(()=>new Promise(r=>{release=r;}));const loading=ctx.service.execute('load');await vi.waitFor(()=>expect(release).toBeTypeOf('function'));const queued=ctx.service.execute('createIncome',{expected,entry}),rejected=expect(queued).rejects.toThrow();const closing=ctx.service.close();release(snapshot);await loading;await rejected;await closing;expect(ctx.worker.call).toHaveBeenCalledTimes(1);expect(ctx.worker.close).toHaveBeenCalledTimes(1);
});
