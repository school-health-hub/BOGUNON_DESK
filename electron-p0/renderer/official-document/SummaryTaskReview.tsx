import {useEffect,useRef,useState} from 'react';
import {useLocalWorkspace} from '../local-tasks/LocalWorkspaceProvider';
import {reviewedSummaryTask,sameSummaryTask,type SummaryTaskCandidate} from './summaryTasks';
export function SummaryTaskReview({initial,onClose,onBusyChange}:{initial:readonly SummaryTaskCandidate[];onClose:()=>void;onBusyChange:(busy:boolean)=>void}){
 const data=useLocalWorkspace(),[rows,setRows]=useState(initial),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),locked=useRef(false),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;onBusyChange(false);};},[onBusyChange]);
 const change=(id:string,patch:Partial<SummaryTaskCandidate>)=>setRows(current=>current.map(row=>row.id===id?{...row,...patch}:row));
 const save=async()=>{
  if(locked.current||data.busy||data.recovered||!data.document)return;
  const selected=rows.filter(row=>row.selected);if(!selected.length){setNotice('검토한 업무를 개별 선택해 주세요.');return;}
  let tasks;try{tasks=selected.map(reviewedSummaryTask);}catch{setNotice('제목·날짜·마감·분류를 확인해 주세요. 기존 업무는 변경하지 않았습니다.');return;}
  if(!window.confirm(`검토한 ${tasks.length}개 업무를 이 PC의 로컬 업무로 등록할까요? 서버 일정은 생성하지 않습니다.`))return;
  locked.current=true;setBusy(true);onBusyChange(true);
  try{
   const next=[...data.document.tasks];
   for(const task of tasks){const existing=next.find(t=>t.id===task.id);if(existing){if(!sameSummaryTask(existing,task))throw Error('이미 등록한 업무는 업무 관리에서 수정해 주세요. 기존 업무를 덮어쓰지 않습니다.');}else next.push(task);}
   if(next.length!==data.document.tasks.length&&!await data.commit(next,'official-summary-tasks'))throw Error('저장하지 못했습니다. 검토 내용과 기존 업무를 유지합니다. 다시 불러온 뒤 재시도해 주세요.');
   if(live.current)setNotice('선택 업무를 로컬에 저장했습니다. Dashboard에 반영됐습니다. 서버 동기화는 수행하지 않았습니다.');
  }catch{if(live.current)setNotice('저장하지 못했거나 기존 업무와 충돌했습니다. 기존 자료와 검토 내용을 유지합니다. 다시 불러온 뒤 확인해 주세요.');}
  finally{locked.current=false;if(live.current){setBusy(false);onBusyChange(false);}}
 };
 return <section aria-label="요약 업무 검토" className="od-task-review"><h3>요약에서 로컬 업무로 전달</h3>
  <p>후보는 요약 문구를 로컬 규칙으로 정리한 것입니다. 원문과 대조해 항목별로 수정·선택하세요. 명확한 연월일만 마감에 채웁니다. 시간·기간 일정·서버 동기화·담당자·제출방법·붙임은 저장하지 않으며 원문과 요약에서 확인해야 합니다.</p>
  {rows.map((row,index)=>{const saved=data.document?.tasks.some(t=>t.id===row.id);return <fieldset key={row.id} disabled={busy||saved}><legend>업무 후보 {index+1}{saved?' · 이미 등록됨':''}</legend>
   <label><input type="checkbox" checked={row.selected} onChange={e=>change(row.id,{selected:e.target.checked})}/>이 업무를 검토하고 선택</label>
   <label>업무 제목<input maxLength={120} value={row.title} onChange={e=>change(row.id,{title:e.target.value})}/></label>
   <label>수행일<input type="date" value={row.date} onChange={e=>change(row.id,{date:e.target.value})}/></label><label>마감일<input type="date" value={row.due} onChange={e=>change(row.id,{due:e.target.value})}/></label>
   <label>분류<select value={row.category} onChange={e=>change(row.id,{category:e.target.value as SummaryTaskCandidate['category']})}>{['교육','검진','행사','보고'].map(v=><option key={v}>{v}</option>)}</select></label>
   <label>중요도<select value={row.priority} onChange={e=>change(row.id,{priority:e.target.value as SummaryTaskCandidate['priority']})}><option value="normal">보통</option><option value="high">높음</option><option value="low">낮음</option></select></label>
  </fieldset>;})}
  {data.error&&<p role="alert">로컬 업무를 저장·불러오지 못했습니다. 기존 자료를 유지합니다.</p>}{data.recovered&&<p role="alert">백업 읽기 전용 상태에서는 등록할 수 없습니다.</p>}
  <p role="status">{notice}</p><div className="od-ai-actions"><button disabled={busy||data.pendingTaskId!==null} onClick={()=>void data.refresh()}>업무 다시 불러오기</button><button disabled={busy||data.busy||data.recovered||!data.document} onClick={()=>void save()}>선택 업무 저장 확인</button><button disabled={busy} onClick={onClose}>업무 전달 닫기</button></div>
 </section>;
}
