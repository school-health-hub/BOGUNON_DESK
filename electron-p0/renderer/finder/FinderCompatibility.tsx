import {useEffect,useRef,useState} from 'react';
import type {EducationVideoLibrary} from '../../protocol';
import type {FinderCompatBridge,FinderImportPreview,V2Load,LibraryEntry,TeacherData,CandidateRecord,RecommendationReason} from '../../finder-v2-protocol';

const labels:Record<keyof TeacherData,string>={educationTitle:'교육명',target:'교육 대상',schedule:'교육 일시',instructions:'안내사항',message:'안내문',notes:'메모'};
const reasonText=(entry:LibraryEntry)=>entry.recommendationReason&&entry.recommendationReason.status!=='deleted'?entry.recommendationReason.text:'';
function V2Editor({entry,busy,onSave,onClose}:{entry:LibraryEntry;busy:boolean;onSave:(teacher:TeacherData,reason?:RecommendationReason,record?:CandidateRecord)=>Promise<void>;onClose:()=>void}){
 const [teacher,setTeacher]=useState(entry.teacher),[reason,setReason]=useState(reasonText(entry));
 const reasonPatch=():RecommendationReason|undefined=>reason===reasonText(entry)?undefined:reason.trim()?{status:'teacher-edited',text:reason.trim()}:{status:'deleted'};
 const prior=entry.candidateRecord;
 const verification=prior?.metadataVerification??entry.ai?.metadataVerification;
 const [facts,setFacts]=useState({title:prior?.title??entry.ai?.title??'',publisher:prior?.publisher??entry.ai?.publisher??'',durationSeconds:String(prior?.durationSeconds??entry.ai?.durationSeconds??'')});
 const [checks,setChecks]=useState({title:verification?.title==='teacher-confirmed',publisher:verification?.publisher==='teacher-confirmed',durationSeconds:verification?.durationSeconds==='teacher-confirmed'});
 return <section aria-label="V2 교사 자료 편집" className="ev-editor"><h3>V2 교사 자료 편집 · {entry.videoId}</h3><p>저장 전에는 보관함을 변경하지 않습니다. 기존 검색 원고와 V1 자료는 변경하지 않습니다.</p>
 <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
 {(Object.keys(labels) as (keyof TeacherData)[]).map(key=><label key={key}>V2 {labels[key]}<textarea maxLength={20000} rows={key==='message'?5:2} value={teacher[key]} onChange={e=>setTeacher({...teacher,[key]:e.target.value})}/></label>)}
 <label>V2 추천 이유<textarea maxLength={600} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <div className="ev-actions"><button type="button" onClick={()=>void onSave(teacher,reasonPatch())}>V2 교사 자료 저장</button><button type="button" onClick={onClose}>V2 편집 취소</button></div>
 {(entry.ai||entry.candidateRecord)&&<details><summary>구조화 AI 후보·교사 확인 기록 검토</summary><p>가져온 기록입니다. 앱이 영상 시청·사실 검증을 수행한 결과가 아닙니다. 전체 AI 승인으로 처리하지 않습니다.</p>
 {(['title','publisher','durationSeconds'] as const).map(key=><div key={key}><label>V2 후보 {key}<input maxLength={500} value={facts[key]} onChange={e=>setFacts({...facts,[key]:e.target.value})}/></label><label><input type="checkbox" checked={checks[key]} onChange={e=>setChecks({...checks,[key]:e.target.checked})}/>{key} 사실을 직접 확인했습니다</label></div>)}
 <button type="button" onClick={()=>{if(!window.confirm('선택한 사실의 교사 확인 기록을 저장할까요? AI 내용 전체가 검증된 것으로 표시하지 않습니다.'))return;const record:CandidateRecord={provenance:prior?.provenance??entry.ai?.provenance??'unverified',title:checks.title?facts.title:null,publisher:checks.publisher?facts.publisher:null,durationSeconds:checks.durationSeconds?Number(facts.durationSeconds):null,metadataVerification:{title:checks.title?'teacher-confirmed':'unverified',publisher:checks.publisher?'teacher-confirmed':'unverified',durationSeconds:checks.durationSeconds?'teacher-confirmed':'unverified'},savedAt:new Date().toISOString()};void onSave(teacher,reasonPatch(),record);}}>V2 후보 사실 확인 저장</button>
 <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({ai:entry.ai,candidateRecord:entry.candidateRecord},null,2)}</pre></details>}
 <details><summary>원본 영상 메타데이터</summary><p>만료·공식 여부는 가져온 원본 기록입니다. 조회·공식성 재검증이나 자동 삭제는 하지 않습니다.</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(entry.provider,null,2)}</pre></details>
 </fieldset></section>;
}
export function FinderCompatibility({bridge,onV1Changed}:{bridge:FinderCompatBridge;onV1Changed:(library:EducationVideoLibrary)=>void}){
 const [loaded,setLoaded]=useState<V2Load|null>(null),[preview,setPreview]=useState<FinderImportPreview|null>(null),[ids,setIds]=useState<readonly string[]>([]),[editing,setEditing]=useState<LibraryEntry|null>(null);
 const [editingFingerprint,setEditingFingerprint]=useState(''),[editSession,setEditSession]=useState(0);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[preparing,setPreparing]=useState(false),[applying,setApplying]=useState(false);
 const live=useRef(true),running=useRef(false),epoch=useRef(0);
 const unwrap=<T,>(r:{ok:true;data:T}|{ok:false;error:{message:string}}):T=>{if(!r.ok)throw Error(r.error.message);return r.data;};
 const run=async(action:(token:number)=>Promise<void>)=>{if(running.current)return;running.current=true;setBusy(true);setNotice('Finder 자료 처리 중… 기존 자료를 유지합니다.');const token=++epoch.current;try{await action(token);}catch(e){if(live.current&&token===epoch.current)setNotice(e instanceof Error?e.message:'Finder V2 작업에 실패했습니다. 기존 자료를 보존합니다.');}finally{running.current=false;if(live.current&&token===epoch.current){setBusy(false);setPreparing(false);setApplying(false);}}};
 const current=(token:number)=>live.current&&token===epoch.current;
 const reload=()=>run(async token=>{const data=unwrap(await bridge.loadV2());if(current(token)){setLoaded(data);setNotice(data.recovered?'백업을 읽었습니다. 원본 보호를 위해 저장·가져오기를 차단합니다.':'V2 보존 자료를 불러왔습니다.');}});
 useEffect(()=>{live.current=true;void reload();return()=>{live.current=false;epoch.current++;void bridge.discardImport();};},[bridge]);
 const select=()=>run(async token=>{setPreparing(true);setPreview(null);const data=unwrap(await bridge.prepareImport());if(!current(token))return;if(!data){setNotice('파일 선택을 취소했습니다. 보관함은 변경하지 않았습니다.');return;}setPreview(data);setIds(data.rows.filter(r=>!r.conflict).map(r=>r.videoId));setNotice('가져올 항목과 충돌·보존 안내를 검토한 뒤 적용하세요.');});
 const cancel=async()=>{const reply=await bridge.discardImport();if(!reply.ok){setNotice(reply.error.message);return;}epoch.current++;running.current=false;setPreview(null);setIds([]);setBusy(false);setPreparing(false);setNotice('가져오기를 취소했습니다. 기존 보관함·메모·안내문을 유지했습니다.');};
 const apply=()=>run(async token=>{if(!preview||!ids.length||!window.confirm(`선택한 ${ids.length}개 영상을 추가할까요? 충돌 항목과 기존 메모·안내문은 덮어쓰지 않습니다.`))return;setApplying(true);const data=unwrap(await bridge.applyImport({token:preview.token,selectedIds:ids}));if(current(token)){setLoaded(data.v2);onV1Changed(data.v1);setPreview(null);setIds([]);setNotice(`${data.added}개 추가 · ${data.skipped}개 건너뜀. 기존 자료를 유지했습니다.`);}});
 const save=async(teacher:TeacherData,reason?:RecommendationReason,record?:CandidateRecord)=>run(async token=>{if(!editing||!loaded||loaded.recovered)return;const data=unwrap(await bridge.editV2({videoId:editing.videoId,expectedFingerprint:editingFingerprint,teacher,...(reason?{recommendationReason:reason}:{}),...(record?{candidateRecord:record}:{})}));if(current(token)){setLoaded(data);setEditing(null);setNotice('V2 교사 자료·검토 기록을 저장했습니다. V1 원고는 유지했습니다.');}});
 return <section aria-label="Finder V1/V2 데이터 관리"><p className="ev-muted">기존 내보내기는 V1 전용입니다. V2 전용 필드는 별도 V2 JSON으로 내보내 보존하세요. 기존 V1을 V2로 강제 변환하지 않습니다.</p>
 <div className="ev-actions"><button type="button" disabled={busy||loaded?.recovered} onClick={()=>void select()}>V1/V2 JSON 가져오기</button><button type="button" disabled={busy} onClick={()=>void reload()}>V2 자료 다시 불러오기</button><button type="button" disabled={busy} onClick={()=>void run(async token=>{const data=unwrap(await bridge.exportV2File());if(current(token))setNotice(data.status==='saved'?`V2 JSON을 저장했습니다: ${data.fileName}`:'V2 JSON 저장을 취소했습니다.');})}>V2 원본 내보내기</button></div>
 <p role="status" className="ev-notice">{notice}</p>
 {(preview||preparing)&&<button type="button" disabled={applying} onClick={()=>void cancel()}>가져오기 취소</button>}
 {preview&&<section aria-label="Finder 가져오기 검토"><h3>V{preview.version} · {preview.total}개 · 충돌 {preview.rows.filter(r=>r.conflict).length}개</h3>{preview.warnings.map(w=><p key={w}>{w}</p>)}<p>충돌은 기존 자료를 우선 보존해 건너뜁니다. 선택 해제한 자료도 가져오지 않습니다.</p><div style={{maxHeight:240,overflowY:'auto'}}>{preview.rows.map(row=><label key={row.videoId} style={{display:'block'}}><input type="checkbox" disabled={busy||row.conflict} checked={ids.includes(row.videoId)} onChange={e=>setIds(e.target.checked?[...ids,row.videoId]:ids.filter(id=>id!==row.videoId))}/>{row.title} · {row.videoId}{row.conflict?' · 충돌: 건너뜀':''}{row.hasAi?' · AI/검토 기록 포함':''}{row.expiredMetadata?' · 만료 메타데이터 보존':''}</label>)}</div><button type="button" disabled={busy||!ids.length} onClick={()=>void apply()}>선택 항목 확인 후 추가</button></section>}
 <h3>Tauri V2 보존 자료 · {loaded?.library.entries.length??0}개</h3>
 {loaded?.library.entries.map(entry=><div key={entry.videoId}><strong>{entry.teacher.educationTitle||entry.provider?.title||entry.ai?.title||entry.videoId}</strong><p>{entry.teacher.target} · {entry.teacher.schedule}{entry.provider&&Date.parse(entry.provider.expiresAt)<=Date.now()?' · 메타데이터 만료(보존됨)':''}</p><button type="button" disabled={busy||loaded.recovered} onClick={()=>{if(editing&&!window.confirm('저장하지 않은 V2 편집을 닫고 다른 자료를 열까요?'))return;setEditingFingerprint(loaded.fingerprint);setEditSession(s=>s+1);setEditing(entry);}}>V2 자료 편집 · {entry.videoId}</button></div>)}
 {editing&&<V2Editor key={`${editing.videoId}-${editSession}`} entry={editing} busy={busy} onSave={save} onClose={()=>{if(window.confirm('V2 편집을 취소할까요? 기존 저장 자료는 유지합니다.'))setEditing(null);}}/>}
 </section>;
}
