import {buildCreatePrompt,buildSummaryPrompt} from './promptBuilder';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {ArrowLeft,Clipboard,FileText,RefreshCw} from 'lucide-react';
import {composeOfficialDocumentDraft,createEmptyOfficialDocumentInput,generateOfficialDocumentDraft} from './documentGenerator';
import {editOfficialDocumentBody} from './officialDocumentDraftEditing';
import {officialDocumentFieldDefinitions,officialDocumentPurposes,officialDocumentWorkAreas} from './options';
import {extractOfficialDocumentSummary,formatOfficialDocumentSummary} from './summaryExtractor';
import {inspectOfficialDocumentPrivacy} from './privacyGuard';
import type {OfficialDocumentDraft,OfficialDocumentInput,OfficialDocumentInputField} from './types';
import {blankOfficialDraft,importedOfficialDraft,officialDraftSnapshot,officialDraftSaveIssues} from './localDocumentFlow';
import './official-document.css';

type Mode='create'|'summary';
export function OfficialDocumentWorkspace({onClose,renderAiTools,dropped,onDropDone}:{readonly onClose:()=>void;readonly renderAiTools?:(text:string)=>ReactNode;readonly dropped?:import('../../electron-p0/file-drop-protocol').DropDelivery;readonly onDropDone?:()=>void}){
 const generation=useRef(0);
 const [busy,setBusy]=useState(false);
 const work=window.electronWork,files=work?.officialDocument;
 const [mode,setMode]=useState<Mode>('create');
 const [input,setInput]=useState<OfficialDocumentInput>(()=>createEmptyOfficialDocumentInput());
 const [draft,setDraft]=useState<OfficialDocumentDraft|null>(null);
 const [source,setSource]=useState('');
 const [sourceName,setSourceName]=useState('가져온 공문');
 const [lastSaved,setLastSaved]=useState<{snapshot:string;fileName:string}|null>(null);
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState('로컬 편집·파일 저장은 외부 전송 없이 동작합니다.');
 useEffect(()=>{generation.current++;void files?.cancel();},[source,draft,files]);
 useEffect(()=>()=>{generation.current++;void files?.cancel();},[files]);
 const importFile=async()=>{
  if(!files||busy)return;
  if(source.trim()&&!window.confirm('현재 원문을 가져온 텍스트로 바꿀까요?'))return;
  const token=++generation.current;setBusy(true);
  try{const r=dropped?await work!.fileDrop!.official({token:dropped.token}):await files.pick();if(token!==generation.current)return;if(!r.ok){setNotice(r.error.message);return;}if(r.data){setSource(r.data.text);setSourceName(r.data.sourceName);setMode('summary');setNotice(`${r.data.sourceName} 텍스트를 가져왔습니다. 원본 서식·표 구조는 보존하지 않습니다. 편집하려면 ‘가져온 원문으로 편집’을 눌러 주세요.`);}else setNotice('가져오기를 취소했습니다. 기존 원문과 원고는 유지했습니다.');}
  catch{setNotice('가져오지 못했습니다. 기존 원문은 유지했습니다.');}finally{setBusy(false);if(dropped)onDropDone?.();}
 };
 const saveFile=async()=>{
  if(!files||!draft||busy)return;
  const issues=officialDraftSaveIssues(draft);if(issues.length){setNotice(issues.join(' '));return;}
  const snapshot=officialDraftSnapshot(draft),token=++generation.current;setBusy(true);setSaving(true);
  try{const r=await files.save(JSON.parse(snapshot));if(token!==generation.current){if(r.ok&&r.data){setLastSaved({snapshot,fileName:r.data.fileName});setNotice(`${r.data.fileName} 저장이 취소 요청 전에 완료됐습니다. 현재 원고와 파일을 확인해 주세요.`);}return;}
   if(!r.ok)setNotice(r.error.message);else if(r.data){setLastSaved({snapshot,fileName:r.data.fileName});setNotice(`${r.data.fileName} 저장 완료`);}else setNotice('저장을 취소했습니다. 원고는 유지했습니다.');
  }catch{if(token===generation.current)setNotice('저장하지 못했습니다. 원고는 유지했습니다.');}finally{setBusy(false);setSaving(false);}
 };
 const replaceDraft=(value:OfficialDocumentDraft)=>{
  if(draft&&!window.confirm('현재 편집 원고를 새 원고로 바꿀까요? 기존 저장 파일은 변경하지 않습니다.'))return false;
  setDraft(value);setLastSaved(null);setMode('create');return true;
 };
 const hasInput=officialDocumentFieldDefinitions.some(field=>input[field.name].trim());
 const close=()=>{if((source.trim()||hasInput||(draft&&officialDraftSnapshot(draft)!==lastSaved?.snapshot))&&!window.confirm('저장하지 않은 입력이나 가져온 원문이 있습니다. 작업실을 닫으면 임시 입력은 사라집니다. 닫을까요?'))return;onClose();};
 const saveIssues=draft?officialDraftSaveIssues(draft):[];
 const summary=useMemo(()=>source.trim()?extractOfficialDocumentSummary(source):null,[source]);
 const privacy=useMemo(()=>inspectOfficialDocumentPrivacy(mode==='create'?JSON.stringify({input,draft}):source),[input,draft,mode,source]);
 const update=(field:OfficialDocumentInputField,value:string)=>setInput(current=>({...current,[field]:value}));
 const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setNotice('클립보드에 복사했습니다.');}catch{setNotice('복사하지 못했습니다. 내용을 직접 선택해 복사해 주세요.');}};
 return <main className="od-workspace">
  <header className="od-header"><div><button type="button" disabled={busy} onClick={close}><ArrowLeft size={16}/>보건 업무로</button><span>BOGUNON DESK · ELECTRON LOCAL</span><h1>공문작업실</h1><p>검증된 로컬 생성 규칙으로 초안을 만들고 직접 검토하세요.</p></div><span className="od-local">로컬 편집 · AI 전송은 별도 확인</span></header>
  {renderAiTools?.(mode==='summary'?buildSummaryPrompt(source):draft?draft.title+'\n\n'+draft.body:buildCreatePrompt(input))}
  {files&&<div className="od-actions"><button type="button" disabled={busy} onClick={()=>void importFile()}>{dropped?`드롭 파일 가져오기 · ${dropped.files[0]?.name}`:'PDF/HWPX/ODT 가져오기'}</button>{dropped&&<button type="button" disabled={busy} onClick={()=>{void work?.fileDrop?.cancel({token:dropped.token});onDropDone?.();}}>드롭 파일 취소</button>}</div>}
  <nav className="od-tabs" aria-label="공문 작업"><button type="button" aria-pressed={mode==='create'} onClick={()=>setMode('create')}>신규 공문 작성</button><button type="button" aria-pressed={mode==='summary'} onClick={()=>setMode('summary')}>공문 핵심정리</button></nav>
  {!privacy.isSafe&&<div className="od-warning" role="alert">개인정보 가능 항목: {privacy.findings.join(', ')}. 실제 자료를 입력하지 말고 내용을 다시 확인해 주세요.</div>}
  <p className="od-status" role="status">{notice}</p>{busy&&<button type="button" onClick={()=>{generation.current++;void files?.cancel();setNotice('파일 처리를 취소했습니다. 기존 원문과 편집 원고는 유지했습니다.');}}>파일 처리 취소</button>}
  {mode==='create'?<div className="od-grid"><section className="od-form"><div className="od-section-title"><FileText size={18}/><h2>작성 정보</h2></div>
   <div className="od-fields" inert={busy}><label>문서 목적<select value={input.purpose} onChange={e=>setInput({...input,purpose:e.target.value as OfficialDocumentInput['purpose']})}>{officialDocumentPurposes.map(value=><option key={value}>{value}</option>)}</select></label><label>업무 영역<select value={input.workArea} onChange={e=>setInput({...input,workArea:e.target.value as OfficialDocumentInput['workArea']})}>{officialDocumentWorkAreas.map(value=><option key={value}>{value}</option>)}</select></label>
   {officialDocumentFieldDefinitions.map(field=>{const multiline='multiline' in field&&field.multiline;return <label className={multiline?'is-wide':''} key={field.name}>{field.label}{multiline?<textarea rows={3} value={input[field.name]} placeholder={field.placeholder} onChange={e=>update(field.name,e.target.value)}/>:<input value={input[field.name]} placeholder={field.placeholder} onChange={e=>update(field.name,e.target.value)}/>}</label>;})}</div>
   <div className="od-actions"><button type="button" disabled={busy} onClick={()=>{if((draft||source.trim()||hasInput)&&!window.confirm('현재 임시 원고와 원문을 지우고 새 작업을 시작할까요? 기존 저장 파일은 변경하지 않습니다.'))return;setInput(createEmptyOfficialDocumentInput());setDraft(null);setSource('');setSourceName('가져온 공문');setLastSaved(null);setNotice('새 작업을 시작합니다.');}}><RefreshCw size={15}/>새 작업</button><button type="button" disabled={busy} onClick={()=>{if(replaceDraft(blankOfficialDraft()))setNotice('빈 문서를 만들었습니다. 제목과 본문을 직접 입력해 주세요.');}}>빈 문서 작성</button><button className="is-primary" type="button" disabled={busy} onClick={()=>{if(!replaceDraft(generateOfficialDocumentDraft(input)))return;setNotice('기본 초안을 만들었습니다. 저장·발송 전 직접 검토해 주세요.');}}>기본 초안 만들기</button></div>
  </section><section className="od-paper"><h2>문서 미리보기</h2>{draft?<><label>제목<input disabled={saving} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>본문<textarea disabled={saving} rows={18} value={draft.body} onChange={e=>setDraft(editOfficialDocumentBody(draft,e.target.value))}/></label><label>붙임 (본문 연동)<textarea aria-label="본문 연동 붙임" rows={4} value={draft.attachments} readOnly/></label><p>붙임은 본문에서 수정하면 함께 갱신됩니다. 원본 표·서식은 보존하지 않습니다.</p><details><summary>저장 내용 미리보기</summary><pre aria-label="ODT 저장 내용 미리보기">{draft.title+'\n\n'+draft.body}</pre></details><p role="status" data-od-save-state>{lastSaved?.snapshot===officialDraftSnapshot(draft)?`파일 저장 완료 · ${lastSaved.fileName}`:lastSaved?'저장 후 수정됨 · 현재 원고는 아직 저장하지 않았습니다.':'임시 원고 · 아직 파일로 저장하지 않았습니다.'}</p>{saveIssues.length>0&&<ul aria-label="ODT 저장 전 확인">{saveIssues.map(issue=><li key={issue}>{issue}</li>)}</ul>}<div className="od-actions">{files&&<button type="button" disabled={busy||saveIssues.length>0} onClick={()=>void saveFile()}>ODT 새 파일 저장</button>}<button type="button" onClick={()=>void copy(draft.title)}><Clipboard size={15}/>제목 복사</button><button type="button" onClick={()=>void copy(draft.body)}><Clipboard size={15}/>본문 복사</button><button type="button" onClick={()=>void copy(composeOfficialDocumentDraft(draft))}><Clipboard size={15}/>전체 복사</button></div></>:<div className="od-empty">왼쪽 정보를 확인하고 기본 초안을 만드세요.</div>}</section></div>
  :<div className="od-grid"><section className="od-form"><h2>받은 공문 원문</h2><p>합성 또는 비식별 자료만 붙여넣으세요. PDF/HWPX/ODT에서 텍스트를 가져옵니다. 스캔 PDF OCR은 지원하지 않습니다. 기본 핵심정리는 로컬 규칙으로 동작합니다.</p><button type="button" disabled={busy||!source.trim()} onClick={()=>{if(replaceDraft(importedOfficialDraft(source,sourceName)))setNotice('가져온 텍스트를 편집 원고로 반영했습니다. 내용은 자동으로 고치지 않았습니다.');}}>가져온 원문으로 편집</button><textarea aria-label="받은 공문 원문" rows={24} value={source} onChange={e=>setSource(e.target.value)} placeholder="핵심을 정리할 합성 공문 원문을 붙여넣으세요."/></section><section className="od-paper"><h2>로컬 핵심정리</h2>{summary?<><pre>{formatOfficialDocumentSummary(summary)}</pre><button type="button" onClick={()=>void copy(formatOfficialDocumentSummary(summary))}><Clipboard size={15}/>정리 복사</button></>:<div className="od-empty">원문을 입력하면 대상·일정·제출 항목을 로컬에서 정리합니다.</div>}</section></div>}
 </main>;
}
