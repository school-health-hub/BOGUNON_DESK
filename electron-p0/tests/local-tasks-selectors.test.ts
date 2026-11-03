import {it,expect} from 'vitest'
import {localTaskWorkspace} from '../renderer/local-tasks/selectors'
import type {LocalTask} from '../local-tasks'
const task:LocalTask={id:'11111111-1111-4111-8111-111111111111',title:'합성 일정·업무',scheduledDate:'2026-11-03',dueDate:'2026-11-06',completed:false,priority:'high',category:'교육',dday:true}
it('reuses the calendar/week/today/DDay adapters for one authoritative task list, without duplicates',()=>{
 const now=new Date(2026,10,3,12),view=localTaskWorkspace({version:1,revision:1,tasks:[task]},now)
 expect(view.todayTasks.map(t=>t.id)).toEqual([task.id]);expect(view.summary).toEqual({todayTaskCount:1,incompleteTaskCount:1,todayEventCount:0})
 expect(view.calendarEvents.map(e=>e.targetDate)).toEqual(['2026-11-03','2026-11-06']);expect(view.calendarEvents[0].category).toBe('교육');expect(view.weekSchedule.find(d=>d.date==='2026-11-03')?.items).toEqual([task.title]);expect(view.ddayItems).toMatchObject([{id:task.id,targetDate:'2026-11-06'}])
 const done=localTaskWorkspace({version:1,revision:2,tasks:[{...task,completed:true}]},now);expect(done.todayTasks[0].completed).toBe(true);expect(done.ddayItems).toEqual([]);expect(done.weekSchedule.find(d=>d.date==='2026-11-03')?.items).toEqual(['완료 · 합성 일정·업무'])
})
it('uses the scheduled date when a D-Day has no deadline, supports month boundaries and empty lists',()=>{
 const now=new Date(2026,9,31,23,59),view=localTaskWorkspace({version:1,revision:1,tasks:[{...task,scheduledDate:'2026-11-01',dueDate:null}]},now)
 expect(view.todayTasks).toEqual([]);expect(view.calendarEvents).toEqual([]);expect(view.ddayItems[0].targetDate).toBe('2026-11-01');expect(view.weekSchedule.find(d=>d.date==='2026-11-01')?.items).toEqual([task.title])
 const next=localTaskWorkspace({version:1,revision:1,tasks:[{...task,scheduledDate:'2026-11-01',dueDate:null}]},new Date(2026,10,1));expect(next.todayTasks).toHaveLength(1);expect(next.calendarEvents).toHaveLength(1)
 expect(localTaskWorkspace({version:1,revision:0,tasks:[]},now).ddayItems).toEqual([])
})
