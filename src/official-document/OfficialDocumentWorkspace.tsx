import {useMemo,useState} from 'react';
import {ArrowLeft,Clipboard,FileText,RefreshCw} from 'lucide-react';
import {composeOfficialDocumentDraft,createEmptyOfficialDocumentInput,generateOfficialDocumentDraft} from './documentGenerator';
import {editOfficialDocumentBody} from './officialDocumentDraftEditing';
import {officialDocumentFieldDefinitions,officialDocumentPurposes,officialDocumentWorkAreas} from './options';
import {extractOfficialDocumentSummary,formatOfficialDocumentSummary} from './summaryExtractor';
import {inspectOfficialDocumentPrivacy} from './privacyGuard';
import type {OfficialDocumentDraft,OfficialDocumentInput,OfficialDocumentInputField} from './types';
import './official-document.css';

type Mode='create'|'summary';
export function OfficialDocumentWorkspace({onClose}:{readonly onClose:()=>void}){
 const [mode,setMode]=useState<Mode>('create');
 const [input,setInput]=useState<OfficialDocumentInput>(()=>createEmptyOfficialDocumentInput());
 const [draft,setDraft]=useState<OfficialDocumentDraft|null>(null);
 const [source,setSource]=useState('');
 const [notice,setNotice]=useState('운영 계정·실제 공문·외부 AI에 연결하지 않습니다.');
 const summary=useMemo(()=>source.trim()?extractOfficialDocumentSummary(source):null,[source]);
 const privacy=useMemo(()=>inspectOfficialDocumentPrivacy(mode==='create'?JSON.stringify(input):source),[input,mode,source]);
 const update=(field:OfficialDocumentInputField,value:string)=>setInput(current=>({...current,[field]:value}));
 const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setNotice('클립보드에 복사했습니다.');}catch{setNotice('복사하지 못했습니다. 내용을 직접 선택해 복사해 주세요.');}};
 return <main className="od-workspace">
  <header className="od-header"><div><button type="button" onClick={onClose}><ArrowLeft size={16}/>보건 업무로</button><span>BOGUNON DESK · ELECTRON LOCAL</span><h1>공문작업실</h1><p>검증된 로컬 생성 규칙으로 초안을 만들고 직접 검토하세요.</p></div><span className="od-local">외부 전송 없음</span></header>
  <nav className="od-tabs" aria-label="공문 작업"><button type="button" aria-pressed={mode==='create'} onClick={()=>setMode('create')}>신규 공문 작성</button><button type="button" aria-pressed={mode==='summary'} onClick={()=>setMode('summary')}>공문 핵심정리</button></nav>
  {!privacy.isSafe&&<div className="od-warning" role="alert">개인정보 가능 항목: {privacy.findings.join(', ')}. 실제 자료를 입력하지 말고 내용을 다시 확인해 주세요.</div>}
  <p className="od-status" role="status">{notice}</p>
  {mode==='create'?<div className="od-grid"><section className="od-form"><div className="od-section-title"><FileText size={18}/><h2>작성 정보</h2></div>
   <div className="od-fields"><label>문서 목적<select value={input.purpose} onChange={e=>setInput({...input,purpose:e.target.value as OfficialDocumentInput['purpose']})}>{officialDocumentPurposes.map(value=><option key={value}>{value}</option>)}</select></label><label>업무 영역<select value={input.workArea} onChange={e=>setInput({...input,workArea:e.target.value as OfficialDocumentInput['workArea']})}>{officialDocumentWorkAreas.map(value=><option key={value}>{value}</option>)}</select></label>
   {officialDocumentFieldDefinitions.map(field=>{const multiline='multiline' in field&&field.multiline;return <label className={multiline?'is-wide':''} key={field.name}>{field.label}{multiline?<textarea rows={3} value={input[field.name]} placeholder={field.placeholder} onChange={e=>update(field.name,e.target.value)}/>:<input value={input[field.name]} placeholder={field.placeholder} onChange={e=>update(field.name,e.target.value)}/>}</label>;})}</div>
   <div className="od-actions"><button type="button" onClick={()=>{setInput(createEmptyOfficialDocumentInput());setDraft(null);setNotice('새 합성 초안을 시작합니다.');}}><RefreshCw size={15}/>새 작업</button><button className="is-primary" type="button" onClick={()=>{setDraft(generateOfficialDocumentDraft(input));setNotice('기본 초안을 만들었습니다. 저장·발송 전 직접 검토해 주세요.');}}>기본 초안 만들기</button></div>
  </section><section className="od-paper"><h2>문서 미리보기</h2>{draft?<><label>제목<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>본문<textarea rows={18} value={draft.body} onChange={e=>setDraft(editOfficialDocumentBody(draft,e.target.value))}/></label><label>붙임<textarea rows={4} value={draft.attachments} onChange={e=>setDraft({...draft,attachments:e.target.value})}/></label><div className="od-actions"><button type="button" onClick={()=>void copy(draft.title)}><Clipboard size={15}/>제목 복사</button><button type="button" onClick={()=>void copy(draft.body)}><Clipboard size={15}/>본문 복사</button><button type="button" onClick={()=>void copy(composeOfficialDocumentDraft(draft))}><Clipboard size={15}/>전체 복사</button></div></>:<div className="od-empty">왼쪽 정보를 확인하고 기본 초안을 만드세요.</div>}</section></div>
  :<div className="od-grid"><section className="od-form"><h2>받은 공문 원문</h2><p>합성 또는 비식별 자료만 붙여넣으세요. 파일 반입과 AI 요약은 아직 연결하지 않습니다.</p><textarea rows={24} value={source} onChange={e=>setSource(e.target.value)} placeholder="핵심을 정리할 합성 공문 원문을 붙여넣으세요."/></section><section className="od-paper"><h2>로컬 핵심정리</h2>{summary?<><pre>{formatOfficialDocumentSummary(summary)}</pre><button type="button" onClick={()=>void copy(formatOfficialDocumentSummary(summary))}><Clipboard size={15}/>정리 복사</button></>:<div className="od-empty">원문을 입력하면 대상·일정·제출 항목을 로컬에서 정리합니다.</div>}</section></div>}
 </main>;
}
