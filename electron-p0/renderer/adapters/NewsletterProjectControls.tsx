import {useEffect,useState} from 'react';
import type {StudioDocument} from '../../../src/newsletter/studioDocument';
import {parseStudioDocument,serializeStudioDocument} from '../../../src/newsletter/studioDocument';
import type {IpcResult,NewsletterHead,NewsletterPreview,NewsletterProjectRecord,NewsletterRevision,NewsletterProjectsBridge} from '../../protocol';
type Props={onBusyChange?:(busy:boolean)=>void;document?:StudioDocument;head:NewsletterHead|null;onLoaded:(r:NewsletterProjectRecord)=>void;onSaved:(r:NewsletterProjectRecord)=>void;onPreview:(p:NewsletterPreview|null)=>void};
function data<T>(result:IpcResult<T>):T{if(!result.ok)throw Error(result.error.message);return result.data;}
export function NewsletterProjectControls({document,head,onLoaded,onSaved,onPreview,onBusyChange}:Props){
 const [id,setId]=useState(''),[ids,setIds]=useState<readonly string[]>([]),[history,setHistory]=useState<readonly NewsletterRevision[]>([]),[preview,setPreview]=useState<NewsletterPreview|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const api:NewsletterProjectsBridge=window.electronWork.newsletter.projects;
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);onBusyChange?.(true);try{await fn();}catch(e){setMessage(e instanceof Error?e.message:'프로젝트 처리 실패');}finally{setBusy(false);onBusyChange?.(false);}};
 useEffect(()=>{setId(document?.project.projectId??'');setPreview(null);setHistory([]);onPreview(null);},[document?.project.projectId]);
 useEffect(()=>{void api.list().then(r=>{if(r.ok)setIds(r.data);});},[]);
 const clear=()=>{setPreview(null);onPreview(null);};
 return <details className="newsletter-native-project"><summary>Electron 프로젝트 저장·revision 이력</summary><p>JSON 파일과 별도인 Electron 전용 저장소입니다. 이미지 원본과 Tauri 원고는 가져오지 않습니다. 내부 저장·복구마다 저장 revision이 증가합니다.</p>
  <label>불러올 프로젝트 ID<input aria-label="불러올 프로젝트 ID" value={id} disabled={busy} onChange={e=>{setId(e.target.value);setHistory([]);clear();}}/></label>
  <label>저장된 프로젝트<select aria-label="저장된 프로젝트" value={ids.includes(id)?id:''} disabled={busy} onChange={e=>{setId(e.target.value);setHistory([]);clear();}}><option value="">프로젝트 선택</option>{ids.map(i=><option key={i} value={i}>{i}</option>)}</select></label>
  <button type="button" disabled={busy||!id} onClick={()=>void run(async()=>{const r=data(await api.load({projectId:id}));parseStudioDocument(JSON.parse(r.document));clear();onLoaded(r);setMessage(`프로젝트 불러옴 · revision ${r.head.revision} · 이미지 원본을 다시 연결해 주세요.`);})}>프로젝트 불러오기</button>
  <button type="button" disabled={busy||!document||preview!==null} onClick={()=>void run(async()=>{if(!document)return;const r=data(await api.save({document:serializeStudioDocument(document),expected:head??{projectId:document.project.projectId,revision:0,hash:''}}));onSaved(r);setHistory([]);setIds(data(await api.list()));setMessage(`프로젝트 저장됨 · revision ${r.head.revision}`);})}>프로젝트 내부 저장</button>
  <button type="button" disabled={busy||!id} onClick={()=>void run(async()=>{setHistory(data(await api.history({projectId:id})));setMessage('revision 이력을 불러왔습니다.');})}>revision 이력 조회</button>
  {head&&<p>현재 연결: {head.projectId} · 저장 revision {head.revision}</p>}
  <ul aria-label="저장 revision 이력">{history.map(r=><li key={r.revision}>revision {r.revision}{r.restoredFrom?` · revision ${r.restoredFrom} 복구`:''} <button type="button" disabled={busy} onClick={()=>void run(async()=>{const p=data(await api.preview({projectId:id,revision:r.revision}));parseStudioDocument(JSON.parse(p.document));setPreview(p);onPreview(p);setMessage(`revision ${r.revision} 읽기 전용 미리보기 · 현재 원고는 변경하지 않았습니다.`);})}>revision {r.revision} 미리보기</button></li>)}</ul>
  {preview&&<><button type="button" disabled={busy} onClick={()=>{clear();setMessage('현재 편집 원고로 돌아왔습니다.');}}>미리보기 닫기</button><button type="button" disabled={busy} onClick={()=>void run(async()=>{const r=data(await api.restore({token:preview.token,expected:preview.head}));if(r.restored&&r.record){parseStudioDocument(JSON.parse(r.record.document));clear();onLoaded(r.record);setHistory([]);setMessage(`프로젝트 복구됨 · revision ${r.record.head.revision} · 이미지 원본을 다시 연결해 주세요.`);}else{clear();setMessage('복구를 취소했습니다.');}})}>미리 본 revision 복구</button></>}
  <p role="status" data-project-status>{message}</p>
 </details>;
}
