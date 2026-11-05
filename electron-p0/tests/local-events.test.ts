import {afterEach,it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,readdir,rm,symlink} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {emptyEvents,validateEventDraft,validateEvents,eventInterval,eventsForDate,conflictingEvents,kstDate,type LocalEventDraft} from '../local-events';
import {LocalEventStore,createLocalEventHandlers,EventConflict} from '../main/local-events';
import {LocalTaskStore} from '../main/local-tasks';
import {withLocalEvents} from '../renderer/local-calendar/selectors';import {localTaskWorkspace} from '../renderer/local-tasks/selectors';
const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222',stamp='2026-11-05T00:00:00.000Z';
const draft=(patch:Partial<LocalEventDraft>={}):LocalEventDraft=>({id,title:'합성 개인 일정',startDate:'2026-11-05',endDate:'2026-11-05',startTime:null,endTime:null,allDay:true,description:'합성 설명',location:'합성 회의실',category:'행사',...patch});
const event=(patch:Partial<LocalEventDraft>={})=>({...draft(patch),createdAt:stamp,updatedAt:stamp});
const roots:string[]=[];async function root(){const path=await mkdtemp(join(tmpdir(),'local-events-'));roots.push(path);return path;}
afterEach(async()=>{vi.restoreAllMocks();for(const path of roots.splice(0))await rm(path,{recursive:true,force:true});});
it('validates separate events and rejects unknown fields, IDs, malformed dates, times, versions and metadata',()=>{
 expect(validateEvents({...emptyEvents(),events:[event()]}).events[0]).toEqual(event());
 for(const patch of [{title:''},{title:' '},{title:'a'.repeat(121)},{title:'주입\0문자'},{id:'path:/tmp'},{startDate:'2026-02-30'},{endDate:'2026-11-04'},{startTime:'09:00'},{allDay:false},{allDay:false,startTime:'25:00',endTime:'10:00'},{allDay:false,startTime:'10:00',endTime:'10:00'},{description:'a'.repeat(4001)},{location:'a'.repeat(201)},{category:'other'},{endDate:'2028-11-05'},{recurrence:'daily'},{path:'/tmp/private'}])expect(()=>validateEventDraft({...draft(),...patch})).toThrow();
 for(const value of [{...emptyEvents(),version:2},{...emptyEvents(),timeZone:'UTC'},{...emptyEvents(),events:[event(),event()]},{...emptyEvents(),events:[{...event(),updatedAt:'bad'}]},{...emptyEvents(),events:[{...event(),createdAt:'2027-01-01T00:00:00.000Z'}]}])expect(()=>validateEvents(value)).toThrow();
});
it('uses KST wall time with UTC timestamps, exclusive timed ends, inclusive all-day ends and valid leap/year boundaries',()=>{
 expect(kstDate(new Date('2026-01-31T15:00:00Z'))).toBe('2026-02-01');expect(kstDate(new Date('2025-12-31T14:59:59Z'))).toBe('2025-12-31');
 const timed=event({allDay:false,startDate:'2025-12-31',endDate:'2026-01-01',startTime:'23:00',endTime:'00:00'});expect(eventInterval(timed)).toEqual([Date.parse('2025-12-31T14:00:00Z'),Date.parse('2025-12-31T15:00:00Z')]);expect(eventsForDate([timed],'2026-01-01')).toHaveLength(0);expect(eventsForDate([timed],'2025-12-31')).toHaveLength(1);
 const allDay=event({startDate:'2025-12-31',endDate:'2026-01-01'});expect(eventsForDate([allDay],'2026-01-01')).toHaveLength(1);expect(eventsForDate([allDay],'2026-01-02')).toHaveLength(0);expect(validateEventDraft(draft({startDate:'2028-02-29',endDate:'2028-02-29'}))).toBeTruthy();
});
it('detects real interval conflicts without treating adjacent or self intervals as overlaps',()=>{
 const first=event({allDay:false,startTime:'09:00',endTime:'10:00'});
 expect(conflictingEvents(draft({id:id2,allDay:false,startTime:'10:00',endTime:'11:00'}),[first])).toHaveLength(0);
 expect(conflictingEvents(draft({id:id2,allDay:false,startTime:'09:59',endTime:'11:00'}),[first])).toHaveLength(1);expect(conflictingEvents(draft(),[first])).toHaveLength(0);expect(conflictingEvents(draft({id:id2}),[first])).toHaveLength(1);
});
it('creates, reads, edits, deletes and restores in a fresh store without modifying the Task file',async()=>{
 const path=await root(),taskRoot=join(path,'tasks'),store=new LocalEventStore(join(path,'events'),undefined,()=>new Date(stamp)),tasks=new LocalTaskStore(taskRoot);
 await tasks.save({version:1,revision:0,tasks:[]},0);const taskBytes=await readFile(join(taskRoot,'tasks.json'));
 const created=await store.save({event:draft(),expectedRevision:0,expectedUpdatedAt:null});expect(created.document.events[0]).toEqual(event());
 const updated=await store.save({event:draft({title:'수정한 합성 일정',description:'변경 메모'}),expectedRevision:1,expectedUpdatedAt:stamp});expect(updated.document.events[0]!.createdAt).toBe(stamp);expect(updated.document.events[0]!.updatedAt).toBe('2026-11-05T00:00:00.001Z');
 expect((await new LocalEventStore(join(path,'events')).load()).document).toEqual(updated.document);const removed=await store.remove({id,expectedRevision:2,expectedUpdatedAt:updated.document.events[0]!.updatedAt,confirmed:true});expect(removed.document.events).toHaveLength(0);expect((await store.load()).document.revision).toBe(3);expect(await readFile(join(taskRoot,'tasks.json'))).toEqual(taskBytes);
});
it('protects CAS, duplicate IDs and acknowledgement-loss retries without overwriting newer edits',async()=>{
 const store=new LocalEventStore(await root(),undefined,()=>new Date(stamp)),request={event:draft(),expectedRevision:0,expectedUpdatedAt:null};await store.save(request);expect((await store.save(request)).document.revision).toBe(1);
 await expect(store.save({...request,event:draft({title:'중복 ID로 변경 시도'})})).rejects.toBeInstanceOf(EventConflict);
 const results=await Promise.allSettled([store.save({event:draft({id:id2}),expectedRevision:1,expectedUpdatedAt:null}),store.save({event:draft({id:'33333333-3333-4333-8333-333333333333'}),expectedRevision:1,expectedUpdatedAt:null})]);expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);expect((await store.load()).document.events).toHaveLength(2);
 await expect(store.save({event:draft({title:'오래된 원고'}),expectedRevision:2,expectedUpdatedAt:'2026-11-04T00:00:00.000Z'})).rejects.toBeInstanceOf(EventConflict);
});
it('retains the primary on write failure and preserves corrupt/unsupported files without resetting them',async()=>{
 const path=await root(),store=new LocalEventStore(path);await store.save({event:draft(),expectedRevision:0,expectedUpdatedAt:null});const primary=await readFile(join(path,'events.json'));
 const failing=new LocalEventStore(path,async()=>{throw Error('synthetic denied');});await expect(failing.save({event:draft({title:'실패할 변경'}),expectedRevision:1,expectedUpdatedAt:(await store.load()).document.events[0]!.updatedAt})).rejects.toThrow();expect(await readFile(join(path,'events.json'))).toEqual(primary);
 await writeFile(join(path,'events.json'),'corrupt synthetic bytes');expect((await store.load()).recovered).toBe(true);await expect(store.save({event:draft(),expectedRevision:1,expectedUpdatedAt:null})).rejects.toThrow('read only');expect(await readFile(join(path,'events.json'),'utf8')).toBe('corrupt synthetic bytes');
 const unknown=await root();await writeFile(join(unknown,'events.json'),' {"version":99} ');await expect(new LocalEventStore(unknown).load()).rejects.toThrow();expect(await readFile(join(unknown,'events.json'),'utf8')).toBe(' {"version":99} ');
});
it('rejects linked storage and forged IPC and does not accept path or timestamp injection',async()=>{
 const path=await root(),store=new LocalEventStore(path),frame={},contents={mainFrame:frame,getURL:()=> 'file:///events'},eventRequest={sender:contents,senderFrame:frame},handlers=createLocalEventHandlers(contents,'file:///events',store);
 expect(await handlers.load({...eventRequest,senderFrame:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await handlers.load(eventRequest,'extra')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(await handlers.save(eventRequest,{event:{...draft(),createdAt:stamp},expectedRevision:0,expectedUpdatedAt:null})).toMatchObject({ok:false});expect(await readdir(path)).toEqual([]);
 const other=await root();await writeFile(join(other,'elsewhere'),'untouched');await symlink(join(other,'elsewhere'),join(path,'events.json'));await expect(store.load()).rejects.toThrow();expect(await readFile(join(other,'elsewhere'),'utf8')).toBe('untouched');
});
it('merges real events into Dashboard calendar/weekly/today counts without changing Task/D-Day semantics',()=>{
 const now=new Date(2026,10,5,12),tasks={version:1 as const,revision:0,tasks:[{id,title:'보존할 업무',scheduledDate:'2026-11-05',dueDate:'2026-11-06',completed:false,priority:'normal' as const,category:'보고' as const,dday:true}]};
 const base=localTaskWorkspace(tasks,now),merged=withLocalEvents({status:'ready',data:base},{...emptyEvents(),events:[event()]},now);expect(merged.status).toBe('ready');if(merged.status!=='ready')throw Error('not ready');expect(merged.data.todayTasks).toEqual(base.todayTasks);expect(merged.data.ddayItems).toEqual(base.ddayItems);expect(merged.data.summary).toEqual({...base.summary,todayEventCount:1});expect(merged.data.calendarEvents.some(row=>row.title.includes('일정 · 종일 · 합성 개인 일정'))).toBe(true);expect(merged.data.weekSchedule.find(row=>row.date==='2026-11-05')?.items.join(' ')).toContain('합성 개인 일정');
});
