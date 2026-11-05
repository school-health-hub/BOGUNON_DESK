// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,within} from '@testing-library/react';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {LocalCalendarProvider} from '../renderer/local-calendar/LocalCalendarProvider';
import {LocalCalendarPanel} from '../renderer/local-calendar/LocalCalendarPanel';
import {LocalWorkspaceProvider} from '../renderer/local-tasks/LocalWorkspaceProvider';
import {LocalEventStore,createLocalEventHandlers} from '../main/local-events';
import {LocalTaskStore,createLocalTaskHandlers} from '../main/local-tasks';
import {WidgetSessionProvider} from '../../src/dashboard/WidgetSessionContext';
import {TodaySummaryWidget} from '../../src/widgets/TodaySummaryWidget';import {CalendarWidget} from '../../src/widgets/CalendarWidget';
import {formatWorkspaceDate} from '../../src/workspace-data/workspaceDataAdapter';
import {kstDate} from '../local-events';
vi.mock('../../src/workspace-data/WorkspaceDataContext',async()=>await import('../renderer/adapters/workspace'));
vi.mock('../../src/components/desktop/DesktopPanelContext',()=>({useDesktopPanels:()=>({openQuickAddEventForDate:vi.fn()})}));
const roots:string[]=[];afterEach(async()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();for(const path of roots.splice(0))await rm(path,{recursive:true,force:true});});
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'local-calendar-ui-'));roots.push(root);const eventsRoot=join(root,'events'),store=new LocalEventStore(eventsRoot),taskRoot=join(root,'tasks'),tasks=new LocalTaskStore(taskRoot);
 await tasks.save({version:1,revision:0,tasks:[]},0);const taskBytes=await readFile(join(taskRoot,'tasks.json')),frame={},contents={mainFrame:frame,getURL:()=> 'file:///calendar'},request={sender:contents,senderFrame:frame};
 const handlers=createLocalEventHandlers(contents,contents.getURL(),store),taskHandlers=createLocalTaskHandlers(contents,contents.getURL(),tasks);
 const api={load:vi.fn(()=>handlers.load(request)),save:vi.fn((input:any)=>handlers.save(request,input)),remove:vi.fn((input:any)=>handlers.remove(request,input))};
 vi.stubGlobal('electronWork',{events:api,tasks:{load:()=>taskHandlers.load(request),save:vi.fn((doc,revision)=>taskHandlers.save(request,doc,revision))}});vi.spyOn(window,'confirm').mockReturnValue(true);
 const close=vi.fn(),view=()=>render(<WidgetSessionProvider><LocalCalendarProvider><LocalWorkspaceProvider><LocalCalendarPanel date={formatWorkspaceDate(new Date())} onClose={close}/><TodaySummaryWidget/><CalendarWidget/></LocalWorkspaceProvider></LocalCalendarProvider></WidgetSessionProvider>);
 return {root,eventsRoot,store,taskRoot,taskBytes,handlers,request,api,close,view};
}
async function newEvent(title='합성 독립 일정'){
 await waitFor(()=>expect((screen.getByRole('button',{name:'일정 추가'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'일정 추가'}));fireEvent.change(screen.getByLabelText('일정 제목'),{target:{value:title}});
}
async function save(){fireEvent.click(screen.getByRole('button',{name:'일정 저장'}));await screen.findByText('독립 로컬 일정을 저장했습니다. Dashboard에 반영됐습니다. 서버로 전송하지 않았습니다.');}
it('creates/edits/deletes separate events, updates Dashboard, and restores after a fresh provider/store read',async()=>{
 const c=await setup(),view=c.view();await newEvent();fireEvent.change(screen.getByLabelText('설명·메모'),{target:{value:'보존할 합성 메모'}});await save();
 expect(c.api.save).toHaveBeenCalledOnce();expect(document.querySelector('.today-summary')?.textContent??document.body.textContent).toContain('1 일정');expect(document.querySelector('.calendar-panel')?.textContent).toContain('합성 독립 일정');
 fireEvent.click(screen.getByRole('button',{name:'일정 수정'}));fireEvent.change(screen.getByLabelText('일정 제목'),{target:{value:'수정한 합성 일정'}});await save();expect((await c.store.load()).document.events[0]!.title).toBe('수정한 합성 일정');
 view.unmount();const fresh=new LocalEventStore(c.eventsRoot);expect((await fresh.load()).document.events[0]!.description).toBe('보존할 합성 메모');const reopened=c.view();await screen.findByRole('button',{name:'종일 · 수정한 합성 일정'});fireEvent.click(screen.getByRole('button',{name:'종일 · 수정한 합성 일정'}));expect(screen.getByText('보존할 합성 메모')).toBeTruthy();
 vi.mocked(window.confirm).mockReturnValueOnce(false);fireEvent.click(screen.getByRole('button',{name:'일정 삭제'}));expect(c.api.remove).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'일정 삭제'}));await screen.findByText('일정을 삭제했습니다. 기존 업무는 유지됩니다.');expect((await fresh.load()).document.events).toHaveLength(0);expect(await readFile(join(c.taskRoot,'tasks.json'))).toEqual(c.taskBytes);reopened.unmount();
});
it('handles month/year navigation, selected-date lists, KST today, and dirty cancel/Escape without writing',async()=>{
 const c=await setup();c.view();await newEvent('취소할 입력');vi.mocked(window.confirm).mockReturnValueOnce(false);fireEvent.keyDown(screen.getByRole('dialog',{name:'독립 로컬 일정'}),{key:'Escape'});expect(c.close).not.toHaveBeenCalled();expect((screen.getByLabelText('일정 제목') as HTMLInputElement).value).toBe('취소할 입력');
 fireEvent.click(screen.getByRole('button',{name:'일정 편집 취소'}));expect(c.api.save).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'오늘로 이동'}));expect(screen.getByRole('heading',{name:`${kstDate(new Date())} 일정`})).toBeTruthy();
 const label=screen.getByRole('navigation',{name:'일정 월 이동'}).textContent!;fireEvent.click(screen.getByRole('button',{name:'다음 달'}));expect(screen.getByRole('navigation',{name:'일정 월 이동'}).textContent).not.toBe(label);fireEvent.click(screen.getByRole('button',{name:'이전 달'}));expect(screen.getByRole('navigation',{name:'일정 월 이동'}).textContent).toBe(label);expect(c.api.save).not.toHaveBeenCalled();
});
it('validates timed dates and displays overlap warnings requiring confirmation without deleting candidates',async()=>{
 const c=await setup();c.view();await newEvent('겹침 기준 일정');await save();await newEvent('시간 일정');fireEvent.click(screen.getByLabelText('종일 일정'));fireEvent.change(screen.getByLabelText('시작 시간 KST'),{target:{value:'11:00'}});fireEvent.change(screen.getByLabelText('종료 시간 KST'),{target:{value:'10:00'}});fireEvent.submit(screen.getByRole('button',{name:'일정 저장'}).closest('form')!);await screen.findByText('종료는 시작 이후여야 하며 기간은 최대 366일입니다.');expect(c.api.save).toHaveBeenCalledOnce();
 fireEvent.change(screen.getByLabelText('종료 시간 KST'),{target:{value:'12:00'}});expect(screen.getByText(/시간이 겹치는 일정 1개:/)).toBeTruthy();vi.mocked(window.confirm).mockReturnValueOnce(false);fireEvent.click(screen.getByRole('button',{name:'일정 저장'}));expect(c.api.save).toHaveBeenCalledOnce();await save();expect((await c.store.load()).document.events).toHaveLength(2);
});
it('keeps input and existing data on failure and handles an acknowledgement-loss retry without duplicate creation',async()=>{
 const c=await setup();c.api.save.mockImplementationOnce(async input=>{await c.handlers.save(c.request,input);return {ok:false,error:{code:'STORAGE_ERROR',message:'합성 응답 유실',retryable:true}};});c.view();await newEvent('중복되면 안 되는 일정');fireEvent.click(screen.getByRole('button',{name:'일정 저장'}));await screen.findByText('저장하지 못했습니다. 기존 자료와 입력을 유지합니다.');expect((screen.getByLabelText('일정 제목') as HTMLInputElement).value).toBe('중복되면 안 되는 일정');expect((await c.store.load()).document.events).toHaveLength(1);
 await save();expect((await c.store.load()).document.events).toHaveLength(1);expect((await c.store.load()).document.revision).toBe(1);expect(c.api.save).toHaveBeenCalledTimes(2);
});
it('locks duplicate submits/dismissal during a save and ignores late UI callbacks after unmount',async()=>{
 const c=await setup();let release!:(v:any)=>void;c.api.save.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));const view=c.view();await newEvent('원자 저장 중');const button=screen.getByRole('button',{name:'일정 저장'}),form=button.closest('form')!;fireEvent.submit(form);fireEvent.submit(form);expect(c.api.save).toHaveBeenCalledOnce();expect((screen.getByRole('button',{name:'독립 로컬 일정 닫기'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});expect(c.close).not.toHaveBeenCalled();
 const input=c.api.save.mock.calls[0]![0];view.unmount();release(await c.handlers.save(c.request,input));await Promise.resolve();expect(c.close).not.toHaveBeenCalled();expect((await c.store.load()).document.events).toHaveLength(1);
});
it('does not overwrite an event edited elsewhere while an old editor survives refresh',async()=>{
 const c=await setup();c.view();await newEvent();await save();const saved=(await c.store.load()).document.events[0]!;fireEvent.click(screen.getByRole('button',{name:'일정 수정'}));fireEvent.change(screen.getByLabelText('일정 제목'),{target:{value:'아직 미저장 편집'}});
 const {createdAt:_created,updatedAt:_updated,...draft}=saved;await c.store.save({event:{...draft,title:'다른 요청의 최신 편집'},expectedRevision:1,expectedUpdatedAt:saved.updatedAt});fireEvent.click(screen.getByRole('button',{name:'일정 다시 불러오기'}));await waitFor(()=>expect(c.api.load).toHaveBeenCalledTimes(2));await waitFor(()=>expect((screen.getByRole('button',{name:'일정 저장'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'일정 저장'}));await screen.findByText(/일정이 다른 요청에서 변경됐습니다/);expect((screen.getByLabelText('일정 제목') as HTMLInputElement).value).toBe('아직 미저장 편집');expect((await c.store.load()).document.events[0]!.title).toBe('다른 요청의 최신 편집');
});
it('shows corrupt and backup-recovered stores explicitly and blocks mutation without resetting files',async()=>{
 const c=await setup();await c.store.save({event:{id:'11111111-1111-4111-8111-111111111111',title:'백업 일정',startDate:'2026-11-05',endDate:'2026-11-05',allDay:true,startTime:null,endTime:null,description:'',location:'',category:'행사'},expectedRevision:0,expectedUpdatedAt:null});
 const saved=(await c.store.load()).document.events[0]!,{createdAt:_created,updatedAt:_updated,...draft}=saved;await c.store.save({event:{...draft,title:'두 번째'},expectedRevision:1,expectedUpdatedAt:saved.updatedAt});await writeFile(join(c.eventsRoot,'events.json'),'unknown original');c.view();await screen.findByText('백업을 읽기 전용으로 표시합니다. 원본을 덮어쓰지 않습니다.');expect((screen.getByRole('button',{name:'일정 추가'}) as HTMLButtonElement).disabled).toBe(true);expect(c.api.save).not.toHaveBeenCalled();expect(await readFile(join(c.eventsRoot,'events.json'),'utf8')).toBe('unknown original');
});
