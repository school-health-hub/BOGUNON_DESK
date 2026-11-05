import type {WorkspaceDataState} from '../../../src/workspace-data/types';
import {adaptWorkspaceData,formatWorkspaceDate} from '../../../src/workspace-data/workspaceDataAdapter';
import {eventTimeLabel,eventsForDate,type EventDocument} from '../../local-events';
/** Keep the Dashboard's existing device-date reference; event wall times are explicitly KST. */
export function withLocalEvents(state:WorkspaceDataState,document:EventDocument|null,now:Date):WorkspaceDataState{
 if(state.status!=='ready'||!document)return state;
 const colors={교육:'blue',검진:'mint',행사:'yellow',보고:'lavender'} as const;
 const events=document.events.map(event=>({id:`local-event:${event.id}`,title:`일정 · ${eventTimeLabel(event)} · ${event.title}`,area:'healthWork' as const,start_date:event.startDate,end_date:!event.allDay&&event.endTime==='00:00'?new Date(Date.parse(event.endDate+'T00:00:00Z')-86400000).toISOString().slice(0,10):event.endDate,is_all_day:event.allDay,start_time:event.startTime,end_time:event.endTime,color_key:colors[event.category]}));
 const data=adaptWorkspaceData({tasks:[],events,ddayTasks:[],ddayEvents:[],notificationTasks:[]},now,['healthWork']);
 const base=state.data;
 return {status:'ready',data:{...base,calendarEvents:[...base.calendarEvents,...data.calendarEvents],weekSchedule:base.weekSchedule.map(day=>({...day,items:[...day.items,...(data.weekSchedule.find(row=>row.date===day.date)?.items??[])]})),upcomingEvents:[...base.upcomingEvents,...data.upcomingEvents].sort((a,b)=>a.targetDate.localeCompare(b.targetDate)||a.title.localeCompare(b.title)).slice(0,5),summary:{...base.summary,todayEventCount:eventsForDate(document.events,formatWorkspaceDate(now)).length}}};
}
