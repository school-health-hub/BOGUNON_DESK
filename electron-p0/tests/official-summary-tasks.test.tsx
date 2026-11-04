// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {LocalTaskStore,createLocalTaskHandlers} from '../main/local-tasks';
import {LocalWorkspaceProvider} from '../renderer/local-tasks/LocalWorkspaceProvider';
import {WidgetSessionProvider} from '../../src/dashboard/WidgetSessionContext';
import {TodayTasksWidget} from '../../src/widgets/TodayTasksWidget';
import {OfficialDocumentWorkspace} from '../../src/official-document/OfficialDocumentWorkspace';
import {OfficialAiWorkflow} from '../renderer/official-document/OfficialAiWorkflow';
import {SummaryTaskReview} from '../renderer/official-document/SummaryTaskReview';
import {summaryTaskCandidates,reviewedSummaryTask} from '../renderer/official-document/summaryTasks';
import type {LocalTaskDocument} from '../local-tasks';
vi.mock('../../src/workspace-data/WorkspaceDataContext',async()=>await import('../renderer/adapters/workspace'));
vi.mock('../../src/components/desktop/DesktopPanelContext',()=>({useDesktopPanels:()=>({openBogunonTask:async()=>{}})}));
const roots:string[]=[];afterEach(async()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();for(const path of roots.splice(0))await rm(path,{recursive:true,force:true});});
const id='33333333-3333-4333-8333-333333333333',day=new Date().toISOString().slice(0,10),text='대상: 합성 교사\n합성 점검 결과를 제출하여 주시기 바랍니다.\n제출기한: 2026-11-30';
const rows=()=>summaryTaskCandidates(text,day,[id]);
const ok=<T,>(data:T)=>({ok:true as const,data});
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'official-summary-'));roots.push(root);const store=new LocalTaskStore(root),frame={},contents={mainFrame:frame,getURL:()=> 'file:///synthetic-app'},event={sender:contents,senderFrame:frame},raw=createLocalTaskHandlers(contents,'file:///synthetic-app',store);const handlers={load:()=>raw.load(event),save:(doc:LocalTaskDocument,revision:number)=>raw.save(event,doc,revision)};
 const save=vi.fn((doc:LocalTaskDocument,revision:number)=>handlers.save(doc,revision)),load=vi.fn(()=>handlers.load());vi.spyOn(window,'confirm').mockReturnValue(true);
 vi.stubGlobal('electronWork',{tasks:{save,load},officialDocument:{pick:async()=>ok({text,format:'odt',sourceName:'synthetic.odt'}),cancel:async()=>ok(null)},chatgpt:{status:async()=>ok({supported:false})},ai:{status:async()=>ok({connected:false})}});
 return {root,store,handlers,save,load};
}
function host(children:React.ReactNode){return <WidgetSessionProvider><LocalWorkspaceProvider>{children}<TodayTasksWidget/></LocalWorkspaceProvider></WidgetSessionProvider>;}
async function selectAndSave(){await waitFor(()=>expect((screen.getByRole('button',{name:'선택 업무 저장 확인'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'선택 업무 저장 확인'}));}
it('reuses original action/date mapping without inventing ambiguous deadlines or independent event fields',()=>{
 const candidate=rows()[0]!;expect(candidate.selected).toBe(false);expect(candidate.title).toContain('합성 점검');expect(candidate.due).toBe('2026-11-30');expect(reviewedSummaryTask(candidate)).toMatchObject({id,scheduledDate:day,dueDate:'2026-11-30',category:'보고',completed:false});
 const uncertain=summaryTaskCandidates('제출기한: 11월 30일\n합성 자료를 제출하여 주시기 바랍니다.',day,[id])[0]!;expect(uncertain.due).toBe('');expect(summaryTaskCandidates('명시된 업무 없음',day,[id])[0]!.title).toBe('');expect(()=>reviewedSummaryTask({...candidate,title:''})).toThrow();expect(()=>reviewedSummaryTask({...candidate,date:'2026-02-30'})).toThrow();
});
it('registers reviewed summary candidates through real local storage, updates Dashboard and restores after remount',async()=>{
 const c=await setup(),renderWorkspace=()=>host(<OfficialDocumentWorkspace onClose={vi.fn()} renderAiWorkflow={context=><OfficialAiWorkflow key={context.sessionId} context={context} onSettings={vi.fn()}/>}/>);
 const view=render(renderWorkspace());fireEvent.click(screen.getByRole('button',{name:'PDF/HWPX/ODT 가져오기'}));await waitFor(()=>expect((screen.getByLabelText('받은 공문 원문') as HTMLTextAreaElement).value).toBe(text));fireEvent.change(screen.getByLabelText('분석할 문서'),{target:{value:'source'}});fireEvent.click(screen.getByRole('button',{name:'선택 문서 로컬 핵심정리'}));fireEvent.click(screen.getByRole('button',{name:'요약 업무 후보 검토'}));expect(c.save).not.toHaveBeenCalled();
 const review=screen.getByRole('region',{name:'요약 업무 검토'});fireEvent.click(within(review).getByRole('button',{name:'선택 업무 저장 확인'}));expect(c.save).not.toHaveBeenCalled();
 await selectAndSave();await screen.findByText(/선택 업무를 로컬에 저장했습니다/);expect(c.save).toHaveBeenCalledOnce();const persisted=JSON.parse(await readFile(join(c.root,'tasks.json'),'utf8'));expect(persisted.tasks).toHaveLength(1);expect(persisted.tasks[0].title).toContain('합성 점검');expect(document.querySelector('.today-tasks-widget')?.textContent??document.body.textContent).toContain('합성 점검');
 fireEvent.click(screen.getByRole('button',{name:'선택 업무 저장 확인'}));await waitFor(()=>expect(c.save).toHaveBeenCalledOnce());fireEvent.click(screen.getByRole('button',{name:'업무 전달 닫기'}));fireEvent.click(screen.getByRole('button',{name:'요약 업무 후보 검토'}));expect(screen.getByText(/업무 후보 1 · 이미 등록됨/)).toBeTruthy();
 view.unmount();render(host(<p>합성 재실행</p>));await waitFor(()=>expect(document.body.textContent).toContain(persisted.tasks[0].title));expect((await c.store.load()).document.tasks).toHaveLength(1);
});
it('preserves review/current data on cancel or write failure and retries with the same ID',async()=>{
 const c=await setup(),close=vi.fn();c.save.mockResolvedValueOnce({ok:false,error:{code:'IO',message:'synthetic write denied'}} as any);render(host(<SummaryTaskReview initial={rows()} onClose={close} onBusyChange={vi.fn()}/>));
 vi.mocked(window.confirm).mockReturnValueOnce(false);await selectAndSave();expect(c.save).not.toHaveBeenCalled();expect((await c.store.load()).document.tasks).toHaveLength(0);fireEvent.click(screen.getByRole('button',{name:'선택 업무 저장 확인'}));await screen.findByText(/저장하지 못했거나 기존 업무와 충돌/);expect((screen.getByLabelText('업무 제목') as HTMLInputElement).value).toContain('합성 점검');expect((await c.store.load()).document.tasks).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'선택 업무 저장 확인'}));await screen.findByText(/선택 업무를 로컬에 저장했습니다/);expect((await c.store.load()).document.tasks[0]!.id).toBe(id);fireEvent.click(screen.getByRole('button',{name:'업무 전달 닫기'}));expect(close).toHaveBeenCalledOnce();
});
it('does not duplicate an already committed task when its acknowledgement was lost',async()=>{
 const c=await setup();c.save.mockImplementationOnce(async(doc,revision)=>{await c.handlers.save(doc,revision);return {ok:false,error:{code:'IO',message:'synthetic acknowledgement lost'}} as any;});render(host(<SummaryTaskReview initial={rows()} onClose={vi.fn()} onBusyChange={vi.fn()}/>));await selectAndSave();await screen.findByText(/저장하지 못했거나 기존 업무와 충돌/);expect((await c.store.load()).document.tasks).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'업무 다시 불러오기'}));await screen.findByText(/이미 등록됨/);fireEvent.click(screen.getByRole('button',{name:'선택 업무 저장 확인'}));await screen.findByText(/선택 업무를 로컬에 저장했습니다/);expect(c.save).toHaveBeenCalledOnce();expect((await c.store.load()).document.tasks).toHaveLength(1);
});
it('blocks duplicate submits and close while the atomic batch is in flight',async()=>{
 const c=await setup();let finish!:(v:any)=>void;c.save.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));const onBusy=vi.fn(),close=vi.fn();render(host(<SummaryTaskReview initial={rows()} onClose={close} onBusyChange={onBusy}/>));await selectAndSave();fireEvent.click(screen.getByRole('button',{name:'선택 업무 저장 확인'}));expect(c.save).toHaveBeenCalledOnce();expect((screen.getByRole('button',{name:'업무 전달 닫기'}) as HTMLButtonElement).disabled).toBe(true);expect(onBusy).toHaveBeenCalledWith(true);
 finish(await c.handlers.save({version:1,revision:0,tasks:[reviewedSummaryTask(rows()[0]!)]},0));await screen.findByText(/선택 업무를 로컬에 저장했습니다/);expect(onBusy).toHaveBeenLastCalledWith(false);expect(close).not.toHaveBeenCalled();
});
it('keeps backup-recovered storage read-only and never silently overwrites a conflicting existing ID',async()=>{
 const c=await setup();c.load.mockResolvedValueOnce(ok({document:{version:1,revision:0,tasks:[]},recovered:true}));const view=render(host(<SummaryTaskReview initial={rows()} onClose={vi.fn()} onBusyChange={vi.fn()}/>));await screen.findByText('백업 읽기 전용 상태에서는 등록할 수 없습니다.');expect((screen.getByRole('button',{name:'선택 업무 저장 확인'}) as HTMLButtonElement).disabled).toBe(true);expect(c.save).not.toHaveBeenCalled();view.unmount();
 await c.handlers.save({version:1,revision:0,tasks:[{...reviewedSummaryTask(rows()[0]!),title:'다른 기존 업무'}]},0);render(host(<SummaryTaskReview initial={[{...rows()[0]!,selected:true}]} onClose={vi.fn()} onBusyChange={vi.fn()}/>));await screen.findByText(/이미 등록됨/);fireEvent.click(screen.getByRole('button',{name:'선택 업무 저장 확인'}));await screen.findByText(/저장하지 못했거나 기존 업무와 충돌/);expect((await c.store.load()).document.tasks[0]!.title).toBe('다른 기존 업무');expect(c.save).not.toHaveBeenCalled();
});
