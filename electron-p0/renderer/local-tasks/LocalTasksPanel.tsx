import {useState,type FormEvent} from 'react'
import {SurfaceDialog} from '../SurfaceDialog'
import {useLocalWorkspace} from './LocalWorkspaceProvider'
import type {LocalTask} from '../../local-tasks'
import {formatWorkspaceDate,createWorkspaceDateRange} from '../../../src/workspace-data/workspaceDataAdapter'
import {useWidgetSession} from '../../../src/dashboard/WidgetSessionContext'
export type LocalTaskRequest={key:string;id?:string;date?:string;title?:string}
export function LocalTasksPanel({request,onClose}:{request:LocalTaskRequest;onClose:()=>void}){
 const data=useLocalWorkspace()
 return <SurfaceDialog title="일정·업무 — 로컬 저장" onClose={onClose}>
  <p>이 Electron 앱에만 보관합니다. 기존 BOGUNON 일정과 연결·병합하지 않습니다. 학생·교직원 개인정보와 건강정보를 입력하지 마세요.</p>
  {data.error&&<p role="alert">{data.error} 마지막 정상 화면과 입력은 유지됩니다.</p>}
  {data.recovered&&<p role="alert">손상된 원본 대신 백업을 읽었습니다. 원본 파일을 보존하기 위해 현재는 읽기 전용입니다.</p>}
  <button type="button" disabled={data.pendingTaskId!==null} onClick={()=>void data.refresh()}>업무 다시 불러오기</button>
  {!data.document?<p role="status">{data.busy?'업무 불러오는 중…':'업무를 불러오지 못했습니다. 다시 불러오기를 눌러 주세요.'}</p>:<TaskEditor key={request.key} request={request}/>}
 </SurfaceDialog>
}
function TaskEditor({request}:{request:LocalTaskRequest}){
 const data=useLocalWorkspace(),{now}=useWidgetSession(),today=formatWorkspaceDate(now)
 const empty=():LocalTask=>({id:crypto.randomUUID(),title:request.title??'',scheduledDate:request.date??today,dueDate:null,completed:false,priority:'normal',category:'보고',dday:true})
 const [form,setForm]=useState<LocalTask>(()=>data.document?.tasks.find(t=>t.id===request.id)??empty()),[message,setMessage]=useState(''),[view,setView]=useState('all')
 const tasks=data.document!.tasks,range=createWorkspaceDateRange(now),disabled=data.busy||data.recovered
 const visible=tasks.filter(t=>view==='all'||[t.scheduledDate,t.dueDate].some(d=>d!==null&&(view==='today'?d===today:view==='week'?d>=range.weekStart&&d<=range.weekEnd:d>=range.monthStart&&d<=range.monthEnd))).slice().sort((a,b)=>a.scheduledDate.localeCompare(b.scheduledDate)||a.title.localeCompare(b.title))
 const save=async(event:FormEvent)=>{event.preventDefault();const task={...form,title:form.title.trim()},next=tasks.some(t=>t.id===task.id)?tasks.map(t=>t.id===task.id?task:t):[...tasks,task];if(await data.commit(next,task.id)){setForm(task);setMessage('업무를 저장했습니다. Dashboard에도 반영됐습니다.')}else setMessage('저장하지 못했습니다. 입력을 유지합니다.')}
 const remove=async(task:LocalTask)=>{if(!window.confirm(`“${task.title}” 업무를 삭제할까요?`))return;if(await data.commit(tasks.filter(t=>t.id!==task.id),task.id)){if(form.id===task.id)setForm(empty());setMessage('업무를 삭제했습니다.')}else setMessage('삭제하지 못했습니다. 기존 업무를 유지합니다.')}
 return <>
  <form onSubmit={event=>void save(event)}><fieldset className="td2-task-fields" disabled={disabled} style={{border:0,minWidth:0}}><legend>{tasks.some(t=>t.id===form.id)?'업무 수정':'업무 등록'}</legend>
   <label className="td2-wide">업무 제목<input aria-label="로컬 업무 제목" required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
   <label>업무 날짜<input aria-label="로컬 업무 날짜" type="date" required value={form.scheduledDate} onChange={e=>setForm({...form,scheduledDate:e.target.value})}/></label>
   <label>마감일<input aria-label="로컬 업무 마감일" type="date" value={form.dueDate??''} onChange={e=>setForm({...form,dueDate:e.target.value||null})}/></label>
   <label>분류<select aria-label="로컬 업무 분류" value={form.category} onChange={e=>setForm({...form,category:e.target.value as LocalTask['category']})}>{['교육','검진','행사','보고'].map(v=><option key={v}>{v}</option>)}</select></label>
   <label>중요도<select aria-label="로컬 업무 중요도" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as LocalTask['priority']})}><option value="high">높음</option><option value="normal">보통</option><option value="low">낮음</option></select></label>
   <label><input type="checkbox" checked={form.completed} onChange={e=>setForm({...form,completed:e.target.checked})}/>완료</label>
   <label><input type="checkbox" checked={form.dday} onChange={e=>setForm({...form,dday:e.target.checked})}/>D-Day 표시 (마감일 또는 업무 날짜)</label>
   <div className="td2-task-actions"><button type="submit">업무 저장</button><button type="button" onClick={()=>{setForm(empty());setMessage('')}}>새 업무</button></div>
  </fieldset></form>
  {message&&<p role="status">{message}</p>}
  <label className="td2-task-filter">업무 표시 범위<select aria-label="업무 표시 범위" value={view} onChange={e=>setView(e.target.value)}><option value="all">전체</option><option value="today">오늘</option><option value="week">이번 주</option><option value="month">이번 달</option></select></label>
  {!visible.length?<p>표시할 로컬 업무가 없습니다.</p>:<ul className="td2-task-list" aria-label="로컬 업무 목록">{visible.map(task=><li key={task.id} style={{overflowWrap:'anywhere'}}>
   <label><input aria-label={`${task.title} 완료 상태`} type="checkbox" checked={task.completed} disabled={disabled} onChange={e=>{const completed=e.target.checked;void data.setTaskCompleted(task.id,completed).then(result=>{if(result==='success'&&form.id===task.id)setForm(current=>({...current,completed}))})}}/>{task.title}</label>
   <span> · {task.scheduledDate}{task.dueDate?` · 마감 ${task.dueDate}`:''} · {task.completed?'완료':'미완료'}</span>
   <button type="button" disabled={disabled} aria-label={`${task.title} 수정`} onClick={()=>{setForm(task);setMessage('')}}>수정</button><button type="button" disabled={disabled} className="td2-danger" aria-label={`${task.title} 삭제`} onClick={()=>void remove(task)}>삭제</button>
  </li>)}</ul>}
 </>
}
