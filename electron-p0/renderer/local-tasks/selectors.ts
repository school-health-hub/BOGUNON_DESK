import type {LocalTaskDocument} from '../../local-tasks'
import {adaptWorkspaceData} from '../../../src/workspace-data/workspaceDataAdapter'
import type {BogunonTaskRow,BogunonEventRow} from '../../../src/workspace-data/types'
export function localTaskWorkspace(document:LocalTaskDocument,now:Date){
 const tasks:BogunonTaskRow[]=document.tasks.map(t=>({id:t.id,title:t.title,area:'healthWork',status:t.completed?'completed':'planned',priority:t.priority,scheduled_date:t.scheduledDate,due_date:t.dueDate,follow_up_date:null,completed_at:null,category:t.category,updated_at:t.scheduledDate}))
 const colors={'교육':'blue','검진':'mint','행사':'yellow','보고':'lavender'} as const
 const events:BogunonEventRow[]=document.tasks.flatMap(t=>[...new Set([t.scheduledDate,...(t.dueDate?[t.dueDate]:[])])].map(date=>({id:`${t.id}:${date}`,title:`${t.completed?'완료 · ':''}${t.title}${date===t.dueDate&&date!==t.scheduledDate?' (마감)':''}`,area:'healthWork' as const,start_date:date,end_date:date,is_all_day:true,start_time:null,end_time:null,color_key:colors[t.category]})))
 const ddayTasks=tasks.filter(t=>document.tasks.find(task=>task.id===t.id)?.dday).map(t=>({...t,due_date:t.due_date??t.scheduled_date}))
 const result=adaptWorkspaceData({tasks,events,ddayTasks,ddayEvents:[],notificationTasks:tasks},now,['healthWork'])
 const calendar=adaptWorkspaceData({tasks:[],events,ddayTasks:[],ddayEvents:[],notificationTasks:[]},now,['healthWork'])
 return {...result,weekSchedule:calendar.weekSchedule,summary:{...result.summary,todayEventCount:0}}
}
