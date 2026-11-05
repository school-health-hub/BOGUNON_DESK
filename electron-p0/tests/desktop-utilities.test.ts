import {it,expect,vi} from 'vitest';
import {localQuickTask} from '../renderer/desktop-utilities/localQuickAdd';
import {electronCommands,runElectronCommand} from '../renderer/desktop-utilities/commands';
import {createInitialTaskInput} from '../../src/workspace-data/workItemCreateService';
const id='11111111-1111-4111-8111-111111111111';
it.each([['training','교육'],['studentHealthScreening','검진'],['event','행사'],['officialDocument','보고']])('maps the supported %s choice to the existing local category %s without changing its schema',(category,label)=>{
 const task=localQuickTask({...createInitialTaskInput('2026-11-04'),title:' 합성 업무 ',category,dueDate:'2026-11-06'},id);expect(task).toEqual({id,title:'합성 업무',scheduledDate:'2026-11-04',dueDate:'2026-11-06',category:label,priority:'normal',completed:false,dday:true});
});
it('rejects independent events, unsupported fields and invalid titles/dates before any storage call',()=>{
 const valid={...createInitialTaskInput('2026-11-04'),title:'합성 업무',category:'officialDocument'};
 for(const input of [{kind:'event',title:'합성 일정',date:'2026-11-04',area:'schoolSchedule'},{...valid,area:'personal'},{...valid,category:'firstAid'},{...valid,priority:'invalid'},{...valid,title:' '},{...valid,title:'가'.repeat(121)},{...valid,title:'제어\0문자'},{...valid,date:'2026-02-30'},{...valid,dueDate:'bad-date'}])expect(()=>localQuickTask(input as any,id)).toThrow();
});
it('exposes only supported commands and refuses arbitrary paths, URLs or OS command strings',async()=>{
 const handlers={openQuickAdd:vi.fn(),runDesktopAction:vi.fn(async()=>{}),openWorkspaceEditor:vi.fn(),openWidgetLibrary:vi.fn()};
 expect(electronCommands.some(c=>['bogunon','online-health-room','work-portal'].includes(c.id))).toBe(false);
 for(const id of ['javascript:alert(1)','https://example.test','C:\\Windows\\system32\\cmd.exe','__proto__','constructor','record-student-search'])await expect(runElectronCommand(id,handlers)).rejects.toThrow();
 expect(handlers.runDesktopAction).not.toHaveBeenCalled();await runElectronCommand('calculator',handlers);expect(handlers.runDesktopAction).toHaveBeenCalledExactlyOnceWith('calculator');await runElectronCommand('quick-add',handlers);expect(handlers.openQuickAdd).toHaveBeenCalledOnce();
});
it('exposes the calendar only in Electron and never falls through to the Task Quick Add handler',async()=>{
 const handlers={openQuickAdd:vi.fn(),openLocalCalendar:vi.fn(),runDesktopAction:vi.fn(async()=>{}),openWorkspaceEditor:vi.fn(),openWidgetLibrary:vi.fn()};
 expect(electronCommands.filter(c=>c.id==='local-calendar')).toHaveLength(1);await runElectronCommand('local-calendar',handlers);expect(handlers.openLocalCalendar).toHaveBeenCalledOnce();expect(handlers.openQuickAdd).not.toHaveBeenCalled();expect(handlers.runDesktopAction).not.toHaveBeenCalled();await expect(runElectronCommand('local-calendar',{...handlers,openLocalCalendar:undefined})).rejects.toThrow();
});
