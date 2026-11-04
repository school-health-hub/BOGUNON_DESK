import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {OfficialWorkflowContext} from '../../../src/official-document/electronWorkflow';
import type {OfficialDocumentMode} from '../../../src/official-document/types';
import {buildCreatePrompt,buildRevisionPrompt,buildSummaryPrompt} from '../../../src/official-document/promptBuilder';
import {evaluateOfficialDocumentOutbound,prepareOfficialDocumentAiSend} from '../../../src/official-document/officialDocumentAiService';
import {OfficialDocumentAiConfirmation} from '../../../src/components/desktop/OfficialDocumentAiConfirmation';
import {extractOfficialDocumentSummary,formatOfficialDocumentSummary} from '../../../src/official-document/summaryExtractor';
import {useWidgetSession} from '../../../src/dashboard/WidgetSessionContext';
import {formatWorkspaceDate} from '../../../src/workspace-data/workspaceDataAdapter';
import type {AiStatus,IpcResult} from '../../protocol';
import type {ChatGptStatus} from '../../chatgpt-protocol';
import {SurfaceDialog} from '../SurfaceDialog';
import {SummaryTaskReview} from './SummaryTaskReview';
import {summaryTaskCandidates,type SummaryTaskCandidate} from './summaryTasks';
import './workflow.css';
type Result={mode:OfficialDocumentMode;text:string;title:string;version:string;id:string;stale:boolean};
type Review={text:string;version:string;mode:OfficialDocumentMode;providerLabel:string};
const read=<T,>(r:IpcResult<T>):T=>{if(!r.ok)throw Error('AI 연결·권한 또는 요청 상태를 확인해 주세요.');return r.data;};
export function OfficialAiWorkflow({context,onSettings}:{context:OfficialWorkflowContext;onSettings:()=>void}){
 const {now}=useWidgetSession(),api=window.electronWork?.ai,chatgpt=window.electronWork?.chatgpt;
 const [mode,setMode]=useState<OfficialDocumentMode>('revision'),[target,setTarget]=useState<'source'|'draft'>('draft'),[route,setRoute]=useState<'chatgpt'|'api'>(chatgpt?'chatgpt':'api');
 const [request,setRequest]=useState(''),[review,setReview]=useState<Review|null>(null),[result,setResult]=useState<Result|null>(null),[candidates,setCandidates]=useState<SummaryTaskCandidate[]|null>(null);
 const [apiState,setApiState]=useState<AiStatus|null>(null),[chatState,setChatState]=useState<ChatGptStatus|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const current=useRef(context);current.current=context;
 const epoch=useRef(0),owned=useRef<null|{cancel:()=>void}>(null),live=useRef(true),locked=useRef(false),ids=useRef(new Map<string,string[]>());
 const abandon=()=>{epoch.current++;locked.current=false;owned.current?.cancel();owned.current=null;setBusy(false);setReview(null);};
 useLayoutEffect(()=>{
  abandon();setResult(value=>value?{...value,stale:true}:null);setCandidates(null);
 },[context.version]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;epoch.current++;owned.current?.cancel();owned.current=null;};},[]);
 const refresh=async()=>{
  try{const [a,c]=await Promise.all([api?.status(),chatgpt?.status()]);if(!live.current)return;setApiState(a?read(a):null);setChatState(c?read(c):null);setNotice('로컬 연결 상태를 확인했습니다. 로그인·모델 조회·유료 호출은 자동 실행하지 않습니다.');}catch{if(live.current)setNotice('연결 상태를 확인하지 못했습니다. 설정에서 연결을 확인해 주세요.');}
 };
 useEffect(()=>{void refresh();},[api,chatgpt]);
 useEffect(()=>{context.onDirtyChange(!!request||!!review||!!result);},[request,review,result,context.onDirtyChange]);
 const ready=route==='chatgpt'?!!(chatState?.supported&&chatState.phase==='ready'&&chatState.planUsageEnabled&&!chatState.busy&&chatState.model&&chatState.models.some(m=>m.id===chatState.model)):!!(apiState?.connected&&!apiState.busy&&apiState.model&&apiState.models.some(m=>m.id===apiState.model));
 const providerLabel=route==='chatgpt'?`ChatGPT 계정 · ${chatState?.model??'미연결'}`:`${apiState?.provider??'API'} · ${apiState?.model??'미연결'} (API 요금 별도)`;
 const original=target==='source'?context.source:context.draft?context.draft.title+'\n\n'+context.draft.body:'';
 const prepare=()=>{
  if(busy||context.busy||!ready||mode!=='create'&&!original.trim()||mode==='revision'&&!request.trim())return;
  const text=mode==='create'?buildCreatePrompt(context.input):mode==='revision'?buildRevisionPrompt({original,request}):buildSummaryPrompt(original);
  setReview({text,version:context.version,mode,providerLabel});
 };
 const send=async(text:string)=>{
  const captured=review,bridge=route==='chatgpt'?chatgpt:api;
  if(!captured||locked.current||!bridge||!ready||captured.version!==current.current.version||current.current.busy||!evaluateOfficialDocumentOutbound(text).canConfirm)return;
  const token=++epoch.current;
  const prepared=prepareOfficialDocumentAiSend({outboundText:text,generate:async prompt=>{
   const reply=read(await bridge.generate({tool:'official-document',prompt}));
   if(reply===null)return '';
   if(typeof reply.text!=='string'||!reply.text.trim()||reply.text.length>60000||reply.text.includes('\0'))throw Error('Invalid response');
   return reply.text;
  }});
  if(prepared.status!=='ready')return;
  locked.current=true;owned.current={cancel:()=>{void bridge.cancel().catch(()=>{});}};setBusy(true);setReview(null);setNotice('Main에서 계정·모델·전송 내용을 다시 확인합니다. 이전 원고와 AI 결과는 유지합니다.');
  try{
   const response=await prepared.gate.confirm();
   if(!live.current||epoch.current!==token||captured.version!==current.current.version)return;
   if(response){setResult({mode:captured.mode,text:response,title:current.current.draft?.title??'',version:captured.version,id:crypto.randomUUID(),stale:false});setCandidates(null);setNotice('AI 제안을 받았습니다. 공식 공문·사실로 확정되지 않습니다. 원문과 대조해 검토하세요.');}
   else setNotice('전송을 취소했습니다. 원고와 이전 AI 결과는 유지했습니다.');
  }catch{if(live.current&&epoch.current===token)setNotice('AI 요청을 완료하지 못했습니다. 연결·권한·한도·시간 초과를 확인해 주세요. 원고와 이전 결과는 유지했습니다. 자동 재요청하지 않습니다.');}
  finally{if(live.current&&epoch.current===token){owned.current=null;locked.current=false;setBusy(false);}}
 };
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);if(live.current)setNotice('검토 내용을 복사했습니다.');}catch{if(live.current)setNotice('복사하지 못했습니다. 내용을 직접 선택해 주세요.');}};
 const apply=(append:boolean)=>{
  if(!result||result.stale||result.version!==current.current.version||context.busy||busy)return;
  let text=result.text;
  if(append){const field=document.querySelector<HTMLTextAreaElement>('[data-od-ai-result]');text=field?.value.slice(field.selectionStart,field.selectionEnd)??'';if(!text.trim()){setNotice('AI 제안에서 적용할 문구를 먼저 선택해 주세요.');return;}}
  if(context.apply(result.version,result.title,text,append))setNotice('검토한 제안을 편집 원고에 반영했습니다. 파일 저장은 별도입니다.');
 };
 const taskReview=(text:string,key:string)=>{
  if(candidates&&!window.confirm('현재 업무 후보 검토를 바꿀까요? 이미 저장한 업무는 유지됩니다.'))return;
  if(!ids.current.has(key))ids.current.set(key,Array.from({length:10},()=>crypto.randomUUID()));
  setCandidates(summaryTaskCandidates(text,formatWorkspaceDate(now),ids.current.get(key)!));
 };
 return <section className="od-ai-workflow electron-ai" aria-label="공문 AI 작업"><h2>AI 초안·수정·요약</h2>
  <p>원문·현재 원고·AI 제안은 별개입니다. AI는 사실을 추가할 수 있으므로 반드시 교사가 검토하세요. 작업 내용은 세션 메모리에서만 다룹니다.</p>
  <fieldset disabled={busy||context.busy||!!review}>
   <label>공문 AI 작업<select value={mode} onChange={e=>{setMode(e.target.value as OfficialDocumentMode);setNotice('작업 종류만 변경했습니다. 기존 결과와 원고는 유지합니다.');}}><option value="create">AI 초안 작성</option><option value="revision">AI 수정·다듬기</option><option value="summary">AI 문서 요약</option></select></label>
   {mode!=='create'&&<label>분석할 문서<select value={target} onChange={e=>setTarget(e.target.value as 'source'|'draft')}><option value="draft">현재 편집 원고</option><option value="source">가져온 원문</option></select></label>}
   {mode==='revision'&&<label>수정 요청 사항<textarea rows={3} maxLength={10000} value={request} onChange={e=>setRequest(e.target.value)}/></label>}
   <label>공문 AI 연결<select value={route} onChange={e=>setRoute(e.target.value as 'api'|'chatgpt')}><option value="chatgpt" disabled={!chatgpt}>ChatGPT 계정</option><option value="api" disabled={!api}>OpenAI / Gemini API Key</option></select></label>
   <p>{providerLabel} · {ready?'로컬 연결 상태 사용 가능 · 실제 호출은 별도 승인':'연결·권한·모델 확인 필요'}</p>
   <div className="od-ai-actions"><button onClick={()=>void refresh()}>연결 상태 확인</button><button onClick={onSettings}>공통 AI 연결 설정</button><button disabled={!ready||mode!=='create'&&!original.trim()||mode==='revision'&&!request.trim()} onClick={prepare}>전송 전 내용 검토</button></div>
   <button disabled={!original.trim()} onClick={()=>{setResult({mode:'summary',text:formatOfficialDocumentSummary(extractOfficialDocumentSummary(original)),title:'',version:context.version,id:crypto.randomUUID(),stale:false});setCandidates(null);setNotice('외부 전송 없는 로컬 핵심정리입니다. 명시된 항목만 사용합니다.');}}>선택 문서 로컬 핵심정리</button>
  </fieldset>
  {busy&&<button onClick={()=>{abandon();setNotice('요청을 취소했습니다. 이미 전송한 내용은 회수되지 않습니다. 원고와 이전 결과는 유지합니다.');}}>공문 AI 요청 취소</button>}
  <p role="status">{notice}</p>
  {result&&<section aria-label="공문 AI 제안" className="od-ai-result"><h3>{result.mode==='summary'?'요약 결과 · 교사 검토용':'AI 제안 · 현재 원고와 별개'}</h3>{result.stale&&<p role="alert">원문·원고·작업 상태가 변경됐습니다. 이전 결과는 복사만 가능하며 적용·업무 전달은 차단됩니다. 다시 요청해 주세요.</p>}
   {result.mode!=='summary'&&<label>제안 제목<input maxLength={500} disabled={busy||context.busy} value={result.title} onChange={e=>setResult({...result,title:e.target.value})}/></label>}
   <label>검토·수정할 제안<textarea data-od-ai-result aria-label="검토·수정할 제안" rows={10} maxLength={60000} disabled={busy||context.busy||!!candidates} value={result.text} onChange={e=>setResult({...result,text:e.target.value})}/></label>
   <p>원문에 없는 사실·날짜를 확정하지 마세요. AI 출력의 제목·요약·체크리스트를 그대로 본문으로 저장하지 말고 필요한 내용을 직접 정리하세요.</p>
   <div className="od-ai-actions"><button onClick={()=>void copy(result.text)}>제안 복사</button>
    {result.mode!=='summary'?<><button disabled={busy||context.busy||result.stale||!result.text.trim()} onClick={()=>apply(false)}>검토한 제목·본문 적용</button><button disabled={busy||context.busy||result.stale} onClick={()=>apply(true)}>선택 부분을 본문 끝에 추가</button></>:<button disabled={busy||context.busy||result.stale||!result.text.trim()} onClick={()=>taskReview(result.text,result.id)}>요약 업무 후보 검토</button>}
    <button disabled={busy||context.busy} onClick={()=>{if(!window.confirm('AI 제안과 미저장 업무 후보를 버릴까요? 원고와 저장한 업무는 유지됩니다.'))return;setResult(null);setCandidates(null);}}>제안 취소</button>
   </div>
  </section>}
  {candidates&&<SummaryTaskReview key={result?.id} initial={candidates} onClose={()=>setCandidates(null)} onBusyChange={context.onBusyChange}/>}
  {review&&<SurfaceDialog title="공문 AI 전송 확인" onClose={()=>setReview(null)}><OfficialDocumentAiConfirmation embedded confirmation={{outboundText:review.text,providerLabel:review.providerLabel}} onCancel={()=>setReview(null)} onConfirm={value=>void send(value.outboundText)}/></SurfaceDialog>}
 </section>;
}
