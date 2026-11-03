// @vitest-environment jsdom
import {useState} from 'react'
import {it,expect,vi,afterEach} from 'vitest'
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react'
import {mkdtemp,readFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os'
import {WidgetSessionProvider} from '../../src/dashboard/WidgetSessionContext'
import {LocalWorkspaceProvider} from '../renderer/local-tasks/LocalWorkspaceProvider'
import {LocalTasksPanel} from '../renderer/local-tasks/LocalTasksPanel'
import {LocalTaskStore,createLocalTaskHandlers} from '../main/local-tasks'
import {TodayTasksWidget} from '../../src/widgets/TodayTasksWidget'
import {CalendarWidget} from '../../src/widgets/CalendarWidget'
import {WeeklyWidget} from '../../src/widgets/WeeklyWidget'
import {DdayWidget} from '../../src/widgets/DdayWidget'
import type {LocalTaskDocument} from '../local-tasks'
vi.mock('../../src/workspace-data/WorkspaceDataContext',async()=>await import('../renderer/adapters/workspace'))
vi.mock('../../src/components/desktop/DesktopPanelContext',()=>({useDesktopPanels:()=>({openBogunonTask:async()=>{},openQuickAddEventForDate:()=>{}})}))
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers()})
function Host(){const [open,setOpen]=useState(true);return <WidgetSessionProvider><LocalWorkspaceProvider><button onClick={()=>setOpen(true)}>업무 열기</button><TodayTasksWidget/><CalendarWidget/><WeeklyWidget/><DdayWidget/>{open&&<LocalTasksPanel request={{key:'test'}} onClose={()=>setOpen(false)}/>}</LocalWorkspaceProvider></WidgetSessionProvider>}
it('creates/edits/completes/deletes through the shared provider, updates original widgets and restores from disk after remount',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(2026,10,3,12));const dir=await mkdtemp(join(tmpdir(),'local-task-ui-')),url='file:///p0',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};let handlers=createLocalTaskHandlers(wc,url,new LocalTaskStore(dir)),fail=false
 const save=vi.fn((doc:LocalTaskDocument,revision:number)=>fail?Promise.resolve({ok:false,error:{code:'STORAGE_ERROR',message:'합성 저장 실패 — 기존 업무 유지',retryable:true}}):handlers.save(event,doc,revision));vi.stubGlobal('electronWork',{tasks:{load:()=>handlers.load(event),save}})
 render(<Host/>);await screen.findByText('표시할 로컬 업무가 없습니다.');fireEvent.change(screen.getByLabelText('로컬 업무 제목'),{target:{value:'합성 업무'}});fireEvent.change(screen.getByLabelText('로컬 업무 마감일'),{target:{value:'2026-11-06'}});fireEvent.click(screen.getByRole('button',{name:'업무 저장'}));await screen.findByText('업무를 저장했습니다. Dashboard에도 반영됐습니다.')
 expect(document.querySelectorAll('.calendar-event')).toHaveLength(2);expect(document.querySelector('.week-schedule-list')?.textContent).toBeTruthy();expect(document.querySelector('.dday-list')?.textContent).toContain('D-3');expect(document.querySelector('.task-title-action')?.textContent).toBe('합성 업무')
 fireEvent.click(screen.getByRole('button',{name:'일정·업무 — 로컬 저장 닫기'}));fireEvent.click(screen.getByRole('checkbox',{name:'합성 업무 완료 처리'}));await waitFor(()=>expect(document.querySelector('.dday-list')).toBeNull());expect(document.querySelector('.task-check')?.getAttribute('aria-checked')).toBe('true')
 fireEvent.click(screen.getByRole('checkbox',{name:'합성 업무 완료 해제'}));await waitFor(()=>expect(document.querySelector('.dday-list')?.textContent).toContain('D-3'));fireEvent.click(screen.getByRole('checkbox',{name:'합성 업무 완료 처리'}));await waitFor(()=>expect(document.querySelector('.dday-list')).toBeNull())
 fireEvent.click(screen.getByRole('button',{name:'업무 열기'}));await screen.findByRole('button',{name:'합성 업무 수정'});fireEvent.click(screen.getByRole('button',{name:'합성 업무 수정'}));fireEvent.change(screen.getByLabelText('로컬 업무 제목'),{target:{value:'긴 한글 업무명으로 입력 내용을 유지하는 합성 수정 업무'}});fireEvent.change(screen.getByLabelText('로컬 업무 날짜'),{target:{value:'2026-11-04'}});fireEvent.change(screen.getByLabelText('로컬 업무 마감일'),{target:{value:'2026-11-07'}});fail=true;fireEvent.click(screen.getByRole('button',{name:'업무 저장'}));await screen.findByText('저장하지 못했습니다. 입력을 유지합니다.');expect((screen.getByLabelText('로컬 업무 제목') as HTMLInputElement).value).toContain('긴 한글 업무명');expect(document.querySelector('.task-title-action')?.textContent).toBe('합성 업무')
 fail=false;fireEvent.click(screen.getByRole('button',{name:'업무 저장'}));await screen.findByText('업무를 저장했습니다. Dashboard에도 반영됐습니다.');const stored=JSON.parse(await readFile(join(dir,'tasks.json'),'utf8'));expect(stored.tasks[0]).toMatchObject({completed:true,scheduledDate:'2026-11-04',dueDate:'2026-11-07'})
 cleanup();handlers=createLocalTaskHandlers(wc,url,new LocalTaskStore(dir));render(<Host/>);await screen.findByRole('button',{name:'긴 한글 업무명으로 입력 내용을 유지하는 합성 수정 업무 삭제'});const remove=screen.getByRole('button',{name:'긴 한글 업무명으로 입력 내용을 유지하는 합성 수정 업무 삭제'}),confirm=vi.spyOn(window,'confirm').mockReturnValue(false);const before=save.mock.calls.length;fireEvent.click(remove);expect(save).toHaveBeenCalledTimes(before);confirm.mockReturnValue(true);fireEvent.click(remove);await screen.findByText('업무를 삭제했습니다.');expect(JSON.parse(await readFile(join(dir,'tasks.json'),'utf8')).tasks).toEqual([]);expect(document.querySelectorAll('.calendar-event')).toHaveLength(0)
})
it('shows read errors rather than an empty success list, and does not save without a valid loaded document',async()=>{
 const save=vi.fn();vi.stubGlobal('electronWork',{tasks:{load:async()=>({ok:false,error:{message:'합성 읽기 오류'}}),save}});render(<Host/>);await screen.findByText(/합성 읽기 오류/);expect(screen.queryByLabelText('로컬 업무 제목')).toBeNull();expect(screen.queryByText('표시할 로컬 업무가 없습니다.')).toBeNull();expect(save).not.toHaveBeenCalled()
})
it('keeps a recovered backup read-only and does not overwrite a damaged primary',async()=>{
 const save=vi.fn();vi.stubGlobal('electronWork',{tasks:{load:async()=>({ok:true,data:{document:{version:1,revision:3,tasks:[]},recovered:true}}),save}});render(<Host/>);await screen.findByText(/손상된 원본 대신 백업/);expect((screen.getByRole('button',{name:'업무 저장'}).closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);expect(save).not.toHaveBeenCalled()
})
