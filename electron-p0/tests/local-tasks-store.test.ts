import {it,expect} from 'vitest'
import {mkdtemp,readFile,writeFile,readdir,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto'
import {LocalTaskStore,TaskConflict,createLocalTaskHandlers} from '../main/local-tasks'
import {emptyLocalTasks,validateLocalTasks,type LocalTask} from '../local-tasks'
const task=():LocalTask=>({id:randomUUID(),title:'합성 업무',scheduledDate:'2026-11-03',dueDate:'2026-11-06',completed:false,priority:'normal',category:'보고',dday:true})
const root=()=>mkdtemp(join(tmpdir(),'local-task-'))
it('persists create/edit/complete/delete across new store instances and backs up the preceding revision',async()=>{
 const dir=await root(),store=new LocalTaskStore(dir);expect((await store.load()).document).toEqual(emptyLocalTasks())
 const first=await store.save({...emptyLocalTasks(),tasks:[task()]},0);expect(first.document.revision).toBe(1)
 const second=await store.save({...first.document,tasks:[{...first.document.tasks[0],title:'합성 수정',completed:true}]},1)
 expect((await new LocalTaskStore(dir).load()).document).toEqual(second.document)
 expect(JSON.parse(await readFile(join(dir,'tasks.backup.json'),'utf8'))).toEqual(first.document)
 const deleted=await store.save({...second.document,tasks:[]},2);expect((await new LocalTaskStore(dir).load()).document).toEqual(deleted.document);expect(deleted.document.tasks).toEqual([])
})
it('preserves the good primary and a recoverable backup on write failure; stale concurrent saves cannot overwrite',async()=>{
 const dir=await root(),store=new LocalTaskStore(dir),first=await store.save({...emptyLocalTasks(),tasks:[task()]},0),before=await readFile(join(dir,'tasks.json'))
 const denied=new LocalTaskStore(dir,async()=>{throw Error('synthetic EPERM')});await expect(denied.save({...first.document,tasks:[]},1)).rejects.toThrow()
 expect(await readFile(join(dir,'tasks.json'))).toEqual(before);expect(JSON.parse(await readFile(join(dir,'tasks.backup.json'),'utf8'))).toEqual(first.document)
 const a=store.save({...first.document,tasks:[{...first.document.tasks[0],title:'첫 저장'}]},1),b=store.save({...first.document,tasks:[]},1)
 await a;await expect(b).rejects.toBeInstanceOf(TaskConflict);expect((await store.load()).document.tasks[0].title).toBe('첫 저장');expect((await readdir(dir)).some(f=>f.endsWith('.tmp'))).toBe(false)
})
it('shows a backup read-only without repairing, resetting or overwriting damaged original bytes',async()=>{
 const dir=await root(),store=new LocalTaskStore(dir),first=await store.save({...emptyLocalTasks(),tasks:[task()]},0);await store.save({...first.document,tasks:[]},1);await writeFile(join(dir,'tasks.json'),'SYNTHETIC CORRUPT')
 const loaded=await new LocalTaskStore(dir).load();expect(loaded.recovered).toBe(true);expect(loaded.document).toEqual(first.document);await expect(store.save(loaded.document,1)).rejects.toThrow();expect(await readFile(join(dir,'tasks.json'),'utf8')).toBe('SYNTHETIC CORRUPT')
})
it('rejects invalid/duplicate IDs, impossible dates, unknown fields, extra IPC args and forged callers',async()=>{
 const row=task(),doc={...emptyLocalTasks(),tasks:[row]}
 for(const invalid of [{...doc,path:'forged'},{...doc,tasks:[row,row]},{...doc,tasks:[{...row,title:' '}]},{...doc,tasks:[{...row,studentName:'not allowed'}]},{...doc,tasks:[{...row,scheduledDate:'2026-02-30'}]},{...doc,tasks:[{...row,dueDate:'2025-02-29'}]},{...doc,tasks:[{...row,completed:'true'}]}])expect(()=>validateLocalTasks(invalid)).toThrow()
 const url='file:///local',frame={},wc={mainFrame:frame,getURL:()=>url},e={sender:wc,senderFrame:frame},handlers=createLocalTaskHandlers(wc,url,new LocalTaskStore(await root()))
 expect(await handlers.save({sender:{},senderFrame:frame},doc,0)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await handlers.save({sender:wc,senderFrame:{}},doc,0)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}})
 expect(await handlers.load(e,'path')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(await handlers.save(e,doc,0,'extra')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(await handlers.save(e,{...doc,path:'bad'},0)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}})
 expect(await handlers.save(e,doc,0)).toMatchObject({ok:true,data:{document:{revision:1}}});expect(await handlers.save(e,doc,0)).toMatchObject({ok:false,error:{code:'CONFLICT'}})
})
it('does not read or overwrite a symlinked task file',async()=>{
 const dir=await root(),other=join(await root(),'original.json');await writeFile(other,JSON.stringify(emptyLocalTasks()));await symlink(other,join(dir,'tasks.json'));const store=new LocalTaskStore(dir);await expect(store.load()).rejects.toThrow();await expect(store.save({...emptyLocalTasks(),tasks:[task()]},0)).rejects.toThrow();expect(await readFile(other,'utf8')).toBe(JSON.stringify(emptyLocalTasks()))
})
