import {useEffect,useRef,useState} from 'react';
import {SurfaceDialog} from '../../../electron-p0/renderer/SurfaceDialog.js';
import type {Bridge,Board,Action} from '../core/types.js';
import {teacher} from '../core/types.js';
import {calculateHealthSupportInstructorManager} from '../core/domain.js';
import {createHealthSupportSettlementDocuments} from '../core/settlement/documents.js';
import type {HealthSupportSettlementDocuments} from '../core/settlement/documents.js';
import type {HealthSupportInstructor,HealthSupportWorkLog} from '../core/validation.js';
import type {InstructorFilesApi,StampView,InstructorFilesRequest,HealthSupportWorkLogImportPreview} from '../../../electron-p0/instructor-files-protocol.js';
import {InstructorSettingsForm} from './instructor-settings-form.js';
import {Dashboard,SettlementPanel} from './health-support-instructor-status-pane.js';
import {PaymentStatementPreview} from './payment-statement-preview.js';
import './instructor.css';
const currentMonth=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date());
const tabs=['대시보드','근무기록','월별 정산','지급명세서·출력','설정'] as const;
type PrintKind='attendance'|'payment'|'detail';
const filesApi=()=>typeof window==='undefined'?undefined:(window as Window&{electronInstructorFiles?:InstructorFilesApi}).electronInstructorFiles;
function initialInstructor(month:string):HealthSupportInstructor{return{id:'',name:'',subject:'학교보건지원',weeklyHours:0,hourlyRate:0,monthlyInsurance:0,monthlyHourLimit:60,weeklyHourLimit:15,totalBudget:0,operationStartDate:month+'-01',operationEndDate:month.slice(0,4)+'-12-31'};}
export function InstructorWorkspace({bridge,school,client}:{bridge:Bridge;school:string;client:'web'|'electron'}){
 const [month,setMonth]=useState(currentMonth),[board,setBoard]=useState<Board>(),[tab,setTab]=useState<(typeof tabs)[number]>('대시보드'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState<HealthSupportWorkLog>(),[preview,setPreview]=useState<HealthSupportWorkLogImportPreview>(),[stamp,setStamp]=useState<StampView|null>(null),[instructorStamp,setInstructorStamp]=useState<StampView|null>(null),[printing,setPrinting]=useState<PrintKind>(),[include,setInclude]=useState(false),[includeInstructor,setIncludeInstructor]=useState(false),[verifier,setVerifier]=useState('');
 const mounted=useRef(true),serial=useRef(0),pending=useRef(false);
 const canEdit=!!board&&teacher(board.role),files=client==='electron'?filesApi():undefined;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;serial.current++;document.body.classList.remove('instructor-print');};},[]);
 useEffect(()=>{const ticket=++serial.current;setBoard(undefined);setEditing(undefined);setPreview(undefined);setStamp(null);setInstructorStamp(null);setPrinting(undefined);setInclude(false);setIncludeInstructor(false);setMessage('조회 중');void bridge.command('read',{school,month}).then(s=>{if(mounted.current&&ticket===serial.current){setBoard(s.board);setMessage(s.message??(s.phase==='ready'?'': '자료를 확인하지 못했습니다.'));}});return()=>{serial.current++;};},[bridge,school,month]);
 const request=():InstructorFilesRequest=>({school,month,version:board?.version??0});
 const act=async(action:Action,payload?:unknown,id?:string)=>{
  if(pending.current||!board)return false;pending.current=true;setBusy(true);const ticket=serial.current;
  try{const result=await bridge.command(action,{school,month,version:board.version,request_id:crypto.randomUUID(),payload,id});if(!mounted.current||ticket!==serial.current)return false;
   setMessage(result.message??'');if(result.phase==='locked'){setBoard(undefined);setStamp(null);setInstructorStamp(null);setPrinting(undefined);setInclude(false);setIncludeInstructor(false);}if(result.phase==='ready'&&result.board){setBoard(result.board);return true;}return false;
  }catch{if(mounted.current)setMessage('연결에 실패했습니다. 입력과 기존 자료를 유지합니다.');return false;}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 };
 const fileAction=async(a:keyof InstructorFilesApi,role:'teacher'|'instructor'='teacher')=>{
  if(!files||pending.current||!canEdit)return;pending.current=true;setBusy(true);const ticket=serial.current;
  try{const result=await files[a]({...request(),stampRole:role});if(!mounted.current||ticket!==serial.current)return;
   if(!result.ok){setMessage(result.message);return;}if(result.status==='canceled'){setMessage('취소했습니다. 기존 자료를 유지합니다.');return;}
   if(a==='stampRead'||a==='stampPick')(role==='instructor'?setInstructorStamp:setStamp)((result.data??null) as StampView|null);
   if(a==='stampRemove')(role==='instructor'?setInstructorStamp:setStamp)(null);
   if(a==='workbookPick'){const value=result.data as HealthSupportWorkLogImportPreview;if(value.error)setMessage('근무기록 시트·헤더·파일 형식을 확인하세요.');else{setPreview(value);setMessage('가져올 행을 검토하고 선택하세요. 기존 자료는 아직 변경하지 않았습니다.');}}
   else setMessage(result.status==='saved'?'로컬 파일 작업을 완료했습니다.':'');
  }catch{if(mounted.current)setMessage('파일 작업을 완료하지 못했습니다. 기존 자료는 유지됩니다.');}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 };
 const loadStamps=async()=>{
  if(!files||pending.current||!canEdit)return;const ticket=serial.current,r=request();pending.current=true;setBusy(true);setStamp(null);setInstructorStamp(null);
  try{const own=await files.stampRead({...r,stampRole:'teacher'});if(!mounted.current||ticket!==serial.current)return;setStamp(own.ok?(own.data??null):null);
   if(board?.instructor){const assistant=await files.stampRead({...r,stampRole:'instructor'});if(mounted.current&&ticket===serial.current)setInstructorStamp(assistant.ok?(assistant.data??null):null);}
  }catch{if(mounted.current&&ticket===serial.current)setMessage('도장을 확인하지 못했습니다. 자동 날인하지 않습니다.');}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 };
 const openPrint=(kind:PrintKind)=>{setPrinting(kind);setInclude(false);setIncludeInstructor(false);if(kind==='attendance')void loadStamps();};
 const closePrint=()=>{setPrinting(undefined);setInclude(false);setIncludeInstructor(false);document.body.classList.remove('instructor-print');};
 const print=async()=>{if(!files||!printing||busy)return;setBusy(true);document.body.classList.add('instructor-print');try{const result=await files.print({...request(),kind:printing,includeStamp:printing==='attendance'&&include,includeInstructorStamp:printing==='attendance'&&includeInstructor});if(mounted.current)setMessage(result.ok?result.status==='saved'?'인쇄 요청을 완료했습니다.':'인쇄를 취소했습니다.':result.message);}catch{if(mounted.current)setMessage('인쇄하지 못했습니다.');}finally{document.body.classList.remove('instructor-print');setInclude(false);setIncludeInstructor(false);setBusy(false);}};
 const inst=board?.instructor,docs=inst?createHealthSupportSettlementDocuments({instructor:inst,month,workLogs:board.logs}):undefined;
 const calculation=inst?calculateHealthSupportInstructorManager({budget:inst.totalBudget,hourlyRate:inst.hourlyRate,monthlyInsuranceRate:inst.monthlyInsurance,monthlyLimitHours:inst.monthlyHourLimit,weeklyLimitHours:inst.weeklyHourLimit,weeklyWarningHours:Math.min(14,inst.weeklyHourLimit),workLogs:board.logs}):undefined;
 return <section className="instructor-workspace health-support-workspace" aria-label="보건지원강사 근무관리" aria-busy={busy}>
  <header className="instructor-header"><div><h2>보건지원강사 근무관리</h2><p>월별 근무표와 정산·출력 자료를 관리합니다.</p></div><span>격리된 합성 QA</span></header>
  <div className="instructor-actions instructor-query"><label>조회 월<input type="month" value={month} disabled={busy} onChange={e=>setMonth(e.target.value)}/></label><button disabled={busy} onClick={()=>void act('read')}>최신 자료 조회</button></div>
  {message&&<p className={`instructor-state ${message==='조회 중'?'is-loading':!board?'is-error':''}`} role={!board&&message!=='조회 중'?'alert':'status'}>{!board&&message!=='조회 중'?`격리된 합성 QA 자료를 불러오지 못했습니다. ${message}`:message}</p>}
  {board&&!canEdit&&<ReadOnlySchedule board={board}/>}
  {board&&canEdit&&<><nav aria-label="강사 관리 메뉴">{tabs.map(t=><button key={t} disabled={busy} aria-pressed={tab===t} className={tab===t?'':'secondary'} onClick={()=>{setTab(t);if(t==='설정')void loadStamps();}}>{t}</button>)}</nav>
   {!inst&&<p>운영 설정을 저장하면 근무표를 작성할 수 있습니다.</p>}
   {(tab==='설정'||!inst)&&<><InstructorSettingsForm key={board.version} instructor={inst??initialInstructor(month)} saveInstructor={async(_state,f)=>{
    const values=Object.fromEntries(f.entries());for(const key of ['weeklyHours','hourlyRate','monthlyInsurance','monthlyHourLimit','weeklyHourLimit','totalBudget'])values[key]=Number(values[key]) as unknown as string;delete values.id;
    return await act('settings',values)?{status:'success',message:'격리된 공유 운영 설정을 저장했습니다.'}:{status:'error',message:'저장하지 못했습니다. 입력·권한·연결을 확인해 주세요.'};
   }}/><section aria-label="개인 도장"><h3>개인 도장</h3><p>보건교사의 이 계정·이 PC에서만 보관합니다. 강사 도장은 현재 학교·강사별로 분리하며 공동 공간에는 공유하지 않습니다. PNG/JPEG 2MiB 이하, 8~1024px.</p>
    {(['teacher','instructor'] as const).map(role=>{const image=role==='teacher'?stamp:instructorStamp,label=role==='teacher'?'보건교사':'강사';return <section key={role} aria-label={label+' 도장 관리'}><h4>{label} 도장</h4>{image&&<img className="instructor-stamp-preview" src={image.dataUrl} alt={'등록한 '+label+' 도장'}/>}<button disabled={!files||busy||role==='instructor'&&!inst} onClick={()=>void fileAction('stampPick',role)}>{label} 도장 {image?'교체':'등록'}</button><button disabled={!files||busy||!image} onClick={()=>void fileAction('stampRemove',role)}>{label} 도장 삭제</button></section>;})}
    {!files&&<p>도장은 보건교사의 DESK에서만 관리합니다.</p>}
   </section></>}

   {inst&&docs&&calculation&&<>
    {tab==='대시보드'&&<Dashboard calculation={calculation} documents={docs} instructor={inst} onOpenWorkLogs={()=>setTab('근무기록')}/>}
    {tab==='근무기록'&&<><WorkLogForm key={editing?.id??'new'} instructor={inst} month={month} editing={editing} busy={busy} save={async payload=>{if(await act('save',payload))setEditing(undefined);}} cancel={()=>setEditing(undefined)}/>
     <ReadOnlySchedule board={board}/><div className="instructor-actions"><button disabled={!files||busy} onClick={()=>void fileAction('workbookPick')}>Excel 근무자료 가져오기</button></div>
     {preview&&<section aria-label="Excel 가져오기 검토"><p>XLSX 근무기록 시트 · 원본 파일은 변경하지 않습니다. 중복·잘못된 행은 추가하지 않습니다. 한 번에 최대 1000행을 선택하세요.</p><ul>{preview.rows.map((r,i)=><li key={r.sourceRow}><label><input type="checkbox" disabled={r.status!=='ready'||busy} checked={r.selected} onChange={e=>setPreview({...preview,rows:preview.rows.map((x,n)=>n===i?{...x,selected:e.target.checked}:x)})}/>{r.sourceRow}행 {r.date} {r.startTime}~{r.endTime} · {r.status}{r.reason?' · '+r.reason:''}</label></li>)}</ul><button disabled={busy||!preview.rows.some(r=>r.selected&&r.status==='ready')||preview.rows.filter(r=>r.selected&&r.status==='ready').length>1000} onClick={()=>{if(!window.confirm('선택한 근무기록을 추가할까요? 기존 자료는 교체하지 않습니다.'))return;const rows=preview.rows.filter(r=>r.selected&&r.status==='ready').map(r=>({instructorId:r.instructorId,date:r.date,startTime:r.startTime,endTime:r.endTime,note:r.note}));void act('import',rows).then(ok=>{if(ok)setPreview(undefined);});}}>선택 행 추가</button><button disabled={busy} onClick={()=>setPreview(undefined)}>가져오기 취소</button></section>}
     <ul aria-label="근무기록 수정 목록">{board.logs.filter(l=>l.date.startsWith(month)).map(log=><li key={log.id}>{log.date} {log.startTime}–{log.endTime}<button disabled={busy} onClick={()=>setEditing(log)}>수정</button><button disabled={busy} onClick={()=>{if(window.confirm('이 근무기록을 삭제할까요?'))void act('delete',undefined,log.id);}}>삭제</button></li>)}</ul></>}
    {tab==='월별 정산'&&<SettlementPanel documents={docs} selectedMonth={month} onMonthChange={setMonth} printActive={false} showWorkDetail={true} onToggleDetail={()=>{}} onPrint={()=>openPrint('detail')}/>}
    {tab==='지급명세서·출력'&&<><div className="instructor-actions"><button disabled={!files||busy||!docs.attendanceRegister.rows.length} onClick={()=>openPrint('attendance')}>출근관리부 미리보기</button><button disabled={!files||busy} onClick={()=>openPrint('payment')}>지급명세서 미리보기</button><button disabled={!files||busy} onClick={()=>void fileAction('workbookSave')}>지급명세서 Excel 저장</button></div><PaymentStatementPreview documents={docs} printActive={false} showPreview={true}/></>}
   </>}
  </>}
  {printing&&docs&&<SurfaceDialog overlayClassName="instructor-preview-overlay" restoreScroll title="출력 미리보기" onClose={closePrint} closeDisabled={busy}><section className="instructor-print-preview health-support-workspace" aria-label="인쇄할 문서" data-print-document={printing==='attendance'?'attendance-register':printing==='payment'?'payment-statement':'work-detail'}>
   <div className="instructor-print-actions"><h2>출력 전 확인</h2>{printing==='attendance'&&<>
    <label><input type="checkbox" checked={includeInstructor} disabled={busy||!instructorStamp} onChange={e=>setIncludeInstructor(e.target.checked)}/>이번 출력에 강사 도장 포함</label>
    <label><input type="checkbox" checked={include} disabled={busy||!stamp} onChange={e=>setInclude(e.target.checked)}/>이번 출력에 보건교사 도장 포함</label>
    <label>확인자 이름<input maxLength={100} value={verifier} onChange={e=>setVerifier(e.target.value)}/></label></>}
    {printing==='payment'&&<p>지급명세서는 날인이 필요하지 않습니다. 도장 이미지를 삽입하지 않습니다.</p>}
    <button disabled={busy} onClick={()=>void print()}>미리보기 확인 후 인쇄</button><button disabled={busy} onClick={closePrint}>출력 취소·닫기</button>
   </div>
   {printing==='attendance'?<AttendancePreview documents={docs} stamp={include?stamp:null} instructorStamp={includeInstructor?instructorStamp:null} verifier={verifier}/>:printing==='payment'?<PaymentStatementPreview documents={docs} printActive={true} showPreview={true}/>:<SettlementPanel documents={docs} selectedMonth={month} onMonthChange={()=>{}} printActive={true} showWorkDetail={true} onToggleDetail={()=>{}} onPrint={()=>{}}/>}
  </section></SurfaceDialog>}
 </section>;
}
export function ReadOnlySchedule({board}:{board:Board}){return <section aria-label="월별 근무표"><h3>{board.month} {board.name} 근무표</h3>{!board.schedule.length?<p>해당 월의 근무표가 없습니다.</p>:<><div className="instructor-table-scroll"><table><thead><tr><th>날짜</th><th>시작</th><th>종료</th><th>근무시간</th></tr></thead><tbody>{board.schedule.map(r=><tr key={r.id}><td>{r.date}</td><td>{r.startTime}</td><td>{r.endTime}</td><td>{r.hours}시간</td></tr>)}</tbody></table></div><p>월간 총 근무시간: {Number(board.schedule.reduce((n,r)=>n+r.hours,0).toFixed(2))}시간</p></>}{!teacher(board.role)&&<p>보건교사가 작성한 근무표입니다. 조회만 가능합니다.</p>}</section>;}
function WorkLogForm({instructor,month,editing,busy,save,cancel}:{instructor:HealthSupportInstructor;month:string;editing?:HealthSupportWorkLog;busy:boolean;save:(payload:unknown)=>Promise<void>;cancel:()=>void}){
 return <form aria-label="근무표 편집" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save({id:editing?.id??null,instructorId:instructor.id,date:f.get('date'),startTime:f.get('startTime'),endTime:f.get('endTime'),note:f.get('note')||null});}}><h3>{editing?'근무표 수정':'근무표 작성'}</h3><fieldset disabled={busy}><label>날짜<input type="date" name="date" required defaultValue={editing?.date??month+'-01'}/></label><label>시작 시간<input type="time" name="startTime" step={1} required defaultValue={editing?.startTime??''}/></label><label>종료 시간<input type="time" name="endTime" step={1} required defaultValue={editing?.endTime??''}/></label><label>교사 비고<textarea maxLength={2000} name="note" defaultValue={editing?.note??''}/></label><p>휴게시간 자동 공제 없이 시작·종료 시각 차이를 계산합니다. 학생·건강·상담 정보는 입력하지 마세요.</p><button type="submit">근무표 저장</button>{editing&&<button type="button" onClick={cancel}>수정 취소</button>}</fieldset></form>;
}
function AttendancePreview({documents,stamp,instructorStamp,verifier}:{documents:HealthSupportSettlementDocuments;stamp:StampView|null;instructorStamp:StampView|null;verifier:string}){
 const r=documents.attendanceRegister;
 return <section className="attendance-register-preview"><h2>{r.title}</h2>
  <div className="attendance-register-preview__meta"><span>분야: {r.field}</span><span>성명: {r.instructorName}</span><span>근무기간: {r.operationPeriod}</span><span>근무일수: 총({r.workDays})일</span></div>
  <table><thead><tr><th>날짜</th><th>요일</th><th>시작시간</th><th>종료시간</th><th>서명</th><th>보건교사 확인</th></tr></thead><tbody>{r.rows.map(row=><tr key={row.date+row.startTime}>
   <td>{row.date}</td><td>{row.weekday}</td><td>{row.startTime}</td><td>{row.endTime}</td>
   <td>{instructorStamp?<img className="instructor-print-stamp" src={instructorStamp.dataUrl} alt="강사 개인 도장"/>:row.signature}</td>
   <td>{stamp?<img className="instructor-print-stamp" src={stamp.dataUrl} alt="보건교사 개인 도장"/>:row.teacherConfirmation}</td>
  </tr>)}</tbody></table>
  <p className="attendance-register-preview__verifier">확인자: {verifier||'________________'} <span className="attendance-register-preview__verifier-signature"><span className="instructor-verifier-seal-slot">{stamp&&<img className="instructor-print-stamp" src={stamp.dataUrl} alt="확인자 보건교사 도장"/>}</span>(서명/인)</span></p>
 </section>;
}
