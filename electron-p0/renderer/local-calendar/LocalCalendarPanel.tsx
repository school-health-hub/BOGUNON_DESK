import {useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {getCalendarMonthCells} from '../../../src/widgets/CalendarWidget';
import {useWidgetSession} from '../../../src/dashboard/WidgetSessionContext';
import {validTaskDate} from '../../local-tasks';
import {EVENT_CATEGORIES,conflictingEvents,eventInterval,eventTimeLabel,eventsForDate,kstDate,validateEventDraft,type LocalEvent,type LocalEventDraft} from '../../local-events';
import {SurfaceDialog} from '../SurfaceDialog';
import {useLocalCalendar} from './LocalCalendarProvider';
import './calendar.css';
const dayKey=(year:number,month:number,day:number)=>`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
const blank=(date:string):LocalEventDraft=>({id:crypto.randomUUID(),title:'',startDate:date,endDate:date,startTime:null,endTime:null,allDay:true,description:'',location:'',category:'행사'});
type Editor={draft:LocalEventDraft;original:string;expected:string|null};
const draftOf=({createdAt:_created,updatedAt:_updated,...draft}:LocalEvent)=>draft;
export function LocalCalendarPanel({date,onClose}:{date?:string;onClose:()=>void}){
 const data=useLocalCalendar(),{now}=useWidgetSession(),today=kstDate(now),initial=date&&validTaskDate(date)?date:today;
 const [selectedDate,setSelectedDate]=useState(initial),[month,setMonth]=useState(initial.slice(0,7)),[selected,setSelected]=useState<string|null>(null),[editor,setEditor]=useState<Editor|null>(null),[pending,setPending]=useState(false),[notice,setNotice]=useState('');const locked=useRef(false),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 // The provider rejects stale writes even if a refresh occurs while this form is open.
 const events=data.document?.events??[],[year,monthNumber]=month.split('-').map(Number),cells=useMemo(()=>getCalendarMonthCells(year!,monthNumber!-1),[month]);
 const counts=useMemo(()=>new Map(cells.filter((d):d is number=>d!==null).map(day=>{const key=dayKey(year!,monthNumber!,day);return [key,eventsForDate(events,key).length];})),[month,data.document]);
 const dayEvents=eventsForDate(events,selectedDate),detail=events.find(event=>event.id===selected);
 const dirty=!!editor&&JSON.stringify(editor.draft)!==editor.original;
 const discard=()=>{if(locked.current)return false;if(dirty&&!window.confirm('저장하지 않은 일정 입력을 닫을까요? 기존 저장 일정과 업무는 유지됩니다.'))return false;setEditor(null);return true;};
 const close=()=>{if(discard()){live.current=false;onClose();}};
 const selectDate=(value:string)=>{if(!discard())return;setSelectedDate(value);setSelected(null);};
 const move=(delta:number)=>{if(!discard())return;const next=new Date(Date.UTC(year!,monthNumber!-1+delta,1));const key=dayKey(next.getUTCFullYear(),next.getUTCMonth()+1,1);if(!validTaskDate(key))return;setMonth(key.slice(0,7));setSelectedDate(key);setSelected(null);};
 const start=(event?:LocalEvent)=>{if(!discard())return;const draft=event?draftOf(event):blank(selectedDate);setSelected(event?.id??null);setEditor({draft,original:JSON.stringify(draft),expected:event?.updatedAt??null});setNotice('');};
 const update=(patch:Partial<LocalEventDraft>)=>setEditor(current=>current?{...current,draft:{...current.draft,...patch}}:null);
 let overlaps:readonly LocalEvent[]=[];if(editor){try{overlaps=conflictingEvents(validateEventDraft({...editor.draft,title:editor.draft.title.trim(),location:editor.draft.location.trim()}),events);}catch{/* Validation is reported on submit; no guessed times. */}}
 const save=async()=>{
  if(!editor||locked.current||data.busy||data.recovered||!data.document)return;
  let draft;try{draft=validateEventDraft({...editor.draft,title:editor.draft.title.trim(),location:editor.draft.location.trim()});}catch(e){setNotice(e instanceof Error?e.message:'일정 입력을 확인해 주세요.');return;}
  if(overlaps.length&&!window.confirm(`시간이 겹치는 일정 ${overlaps.length}개가 있습니다. 검토한 일정을 저장할까요?`))return;
  locked.current=true;setPending(true);
  try{if(await data.save(draft,editor.expected)){if(live.current){setSelected(draft.id);setSelectedDate(draft.startDate);setMonth(draft.startDate.slice(0,7));setEditor(null);setNotice('독립 로컬 일정을 저장했습니다. Dashboard에 반영됐습니다. 서버로 전송하지 않았습니다.');}}else if(live.current)setNotice('저장하지 못했습니다. 기존 자료와 입력을 유지합니다.');}
  finally{locked.current=false;if(live.current)setPending(false);}
 };
 const remove=async()=>{
  if(!detail||locked.current||data.busy||data.recovered||!window.confirm(`'${detail.title}' 일정을 삭제할까요? 기존 업무는 삭제하지 않습니다.`))return;
  locked.current=true;setPending(true);try{if(await data.remove(detail.id,detail.updatedAt)&&live.current){setSelected(null);setEditor(null);setNotice('일정을 삭제했습니다. 기존 업무는 유지됩니다.');}}finally{locked.current=false;if(live.current)setPending(false);}
 };
 const upcoming=events.filter(event=>eventInterval(event)[1]>now.getTime()).sort((a,b)=>eventInterval(a)[0]-eventInterval(b)[0]).slice(0,5);
 return <SurfaceDialog title="독립 로컬 일정" closeDisabled={pending} onClose={close}><div className="local-calendar">
  <p>개인 로컬 일정 · 한국 표준시 KST(UTC+09:00). 공동 일정·계정 동기화 없음. 학생 이름·질병·상담·투약 기록은 입력하지 마세요.</p>
  {Intl.DateTimeFormat().resolvedOptions().timeZone!=='Asia/Seoul'&&<p>이 PC의 시간대는 {Intl.DateTimeFormat().resolvedOptions().timeZone}입니다. 이 일정창의 오늘·시간은 KST이며, 기존 Dashboard 날짜 위젯은 PC 날짜 기준을 유지합니다.</p>}
  {!data.available&&<p role="alert">이 실행본에는 일정 저장 연결이 없습니다.</p>}{data.error&&<p role="alert">{data.error}</p>}{data.recovered&&<p role="alert">백업을 읽기 전용으로 표시합니다. 원본을 덮어쓰지 않습니다.</p>}
  <button type="button" disabled={pending} onClick={()=>void data.refresh()}>일정 다시 불러오기</button><p role="status">{notice}</p>
  <nav className="lc-toolbar" aria-label="일정 월 이동"><button disabled={pending||month==='1000-01'} aria-label="이전 달" onClick={()=>move(-1)}><ChevronLeft size={18}/></button><strong>{year}년 {monthNumber}월</strong><button disabled={pending||month==='9999-12'} aria-label="다음 달" onClick={()=>move(1)}><ChevronRight size={18}/></button><button disabled={pending} onClick={()=>{if(discard()){setMonth(today.slice(0,7));setSelectedDate(today);setSelected(null);}}}>오늘로 이동</button><button disabled={pending||data.busy||data.recovered||!data.document} onClick={()=>start()}><CalendarDays size={18}/>일정 추가</button></nav>
  <div className="lc-columns"><section><h2>월간 달력</h2><div className="lc-grid" aria-label={`${month} 달력`}>
   {['일','월','화','수','목','금','토'].map(value=><span className="lc-weekday" key={value}>{value}</span>)}
   {cells.map((day,index)=>day===null?<span key={`empty-${index}`}/>:<button disabled={pending} key={day} aria-label={`${dayKey(year!,monthNumber!,day)} 일정 ${(counts.get(dayKey(year!,monthNumber!,day))??0)}개`} aria-pressed={selectedDate===dayKey(year!,monthNumber!,day)} aria-current={dayKey(year!,monthNumber!,day)===today?'date':undefined} onClick={()=>selectDate(dayKey(year!,monthNumber!,day))}><strong>{day}</strong><small>{counts.get(dayKey(year!,monthNumber!,day))||''}</small></button>)}
  </div><h2>{selectedDate} 일정</h2>{!data.document?<p>일정을 불러오지 못했거나 불러오는 중입니다.</p>:!dayEvents.length?<p>선택한 날짜에 일정이 없습니다. 업무 마감과 별도로 일정을 추가하세요.</p>:<ul>{dayEvents.map(event=><li key={event.id}><button disabled={pending} onClick={()=>{if(discard())setSelected(event.id);}}>{eventTimeLabel(event)} · {event.title}</button></li>)}</ul>}
  <h3>오늘 일정 · {today} KST</h3><p>{eventsForDate(events,today).length}개</p><h3>다가오는 일정</h3>{upcoming.length?<ul>{upcoming.map(event=><li key={event.id}><button disabled={pending} onClick={()=>{if(discard()){setMonth(event.startDate.slice(0,7));setSelectedDate(event.startDate);setSelected(event.id);}}}>{event.startDate} · {eventTimeLabel(event)} · {event.title}</button></li>)}</ul>:<p>다가오는 일정이 없습니다.</p>}
  </section><section aria-label="일정 상세 편집">
   {editor?<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={pending}><legend>{editor.expected?'일정 수정':'새 일정'}</legend>
    <label>일정 제목<input required maxLength={120} value={editor.draft.title} onChange={e=>update({title:e.target.value})}/></label>
    <label className="lc-check"><input type="checkbox" checked={editor.draft.allDay} onChange={e=>update({allDay:e.target.checked,startTime:e.target.checked?null:'09:00',endTime:e.target.checked?null:'10:00'})}/>종일 일정</label>
    <div className="lc-fields"><label>시작 날짜<input required type="date" min="1000-01-01" max="9999-12-31" value={editor.draft.startDate} onChange={e=>update({startDate:e.target.value})}/></label><label>종료 날짜<input required type="date" min="1000-01-01" max="9999-12-31" value={editor.draft.endDate} onChange={e=>update({endDate:e.target.value})}/></label>
    {!editor.draft.allDay&&<><label>시작 시간 KST<input required type="time" value={editor.draft.startTime??''} onChange={e=>update({startTime:e.target.value})}/></label><label>종료 시간 KST<input required type="time" value={editor.draft.endTime??''} onChange={e=>update({endTime:e.target.value})}/></label></>}</div>
    <p>종일 종료 날짜는 포함합니다. 시간 일정은 종료 시각을 포함하지 않습니다. 최대 366일.</p><label>분류<select value={editor.draft.category} onChange={e=>update({category:e.target.value as LocalEventDraft['category']})}>{EVENT_CATEGORIES.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>장소<input maxLength={200} value={editor.draft.location} onChange={e=>update({location:e.target.value})}/></label><label>설명·메모<textarea rows={5} maxLength={4000} value={editor.draft.description} onChange={e=>update({description:e.target.value})}/></label>
    {overlaps.length>0&&<aside role="status">시간이 겹치는 일정 {overlaps.length}개: {overlaps.map(event=>event.title).join(', ')}. 저장 전에 확인하세요.</aside>}
    <div className="lc-actions"><button type="submit" disabled={data.busy||data.recovered||!data.document}>일정 저장</button><button type="button" onClick={discard}>일정 편집 취소</button></div>
   </fieldset></form>:detail?<><h2>{detail.title}</h2><p>{detail.startDate} ~ {detail.endDate} · {eventTimeLabel(detail)}</p><p>{detail.category} · {detail.location||'장소 없음'}</p><pre>{detail.description||'설명 없음'}</pre><p>생성 {detail.createdAt} / 수정 {detail.updatedAt} (UTC)</p><div className="lc-actions"><button disabled={pending||data.busy||data.recovered} onClick={()=>start(detail)}>일정 수정</button><button disabled={pending||data.busy||data.recovered} onClick={()=>void remove()}>일정 삭제</button></div></>:<p>일정을 선택하면 상세 내용을 보고 수정할 수 있습니다.</p>}
  </section></div>
 </div></SurfaceDialog>;
}
