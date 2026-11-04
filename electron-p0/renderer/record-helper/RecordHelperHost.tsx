import {useEffect,useRef,useState} from 'react';import {createPortal} from 'react-dom';
import {RecordHelperWorkspacePanel,type RecordHelperConnection} from '../../../src/components/desktop/RecordHelperWorkspacePanel';
import type {ChatGptStatus} from '../../chatgpt-protocol';
import type {DropDelivery} from '../../file-drop-protocol';
const disconnected:RecordHelperConnection={state:{status:'disconnected',planUsageEnabled:false},models:[],selectedModel:null,modelsLoading:false,modelsError:null,generateText:async()=>{throw Error('검토한 전송본을 사용해 주세요.');}};
export function RecordHelperHost({onClose,onOpenAiSettings,settingsOpen=false,dropped,onDropDone}:{onClose:()=>void;onOpenAiSettings:()=>void;settingsOpen?:boolean;dropped?:DropDelivery;onDropDone?:()=>void}){
 const api=window.electronWork.recordHelper,chatgpt=window.electronWork.chatgpt;
 const [nativeStatus,setNativeStatus]=useState<ChatGptStatus|null>(null);
 const caller=useRef(document.activeElement as HTMLElement|null);
 const [connection,setConnection]=useState(disconnected),root=useRef<HTMLDivElement>(null),live=useRef(true);
 const refresh=async()=>{if(!chatgpt)return;try{const result=await chatgpt.status();if(!live.current||!result.ok)return;const s:ChatGptStatus=result.data;setNativeStatus(s);setConnection({...disconnected,state:{status:s.phase==='ready'?'connected':'disconnected',planUsageEnabled:s.planUsageEnabled},models:s.models.map(m=>({slug:m.id,displayName:m.label})),selectedModel:s.model,modelsLoading:s.busy});}catch{if(live.current)setConnection(disconnected);}};
 useEffect(()=>{live.current=true;if(!settingsOpen)void refresh();return()=>{live.current=false;};},[settingsOpen]);
 useEffect(()=>{
  const container=root.current;if(!container)return;const previous=caller.current,siblings=[...document.body.children].filter(el=>el!==container) as HTMLElement[],states=siblings.map(el=>[el,el.inert??false] as const);siblings.forEach(el=>{el.inert=true;});
  const top=()=>{const nodes=container.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');return nodes.item(nodes.length-1);};
  const list=()=>[...top()?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')??[]];
  const trap=(event:KeyboardEvent)=>{if(container.inert||event.key!=='Tab')return;const nodes=list(),first=nodes[0],last=nodes[nodes.length-1];if(!first)return;if(event.shiftKey&&(document.activeElement===first||!top()?.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!top()?.contains(document.activeElement))){event.preventDefault();first.focus();}};
  const focus=(event:FocusEvent)=>{if(!container.inert&&event.target instanceof Node&&!top()?.contains(event.target))list()[0]?.focus();};
  document.addEventListener('keydown',trap,true);document.addEventListener('focusin',focus);
  return()=>{document.removeEventListener('keydown',trap,true);document.removeEventListener('focusin',focus);states.forEach(([el,inert])=>{el.inert=inert;});void api?.clear();if(previous?.isConnected)previous.focus();else document.querySelector<HTMLElement>('.dock button[data-dock-item="toolbox"]')?.focus();};
 },[api]);
 const read=<T,>(r:{ok:true;data:T}|{ok:false;error:{message:string}}):T=>{if(!r.ok)throw Error(r.error.message);return r.data;};
 if(!api)return <div><p role="alert">이 실행본에는 생기부 도우미 연결이 없습니다.</p><button type="button" onClick={onClose}>업무 도구로 돌아가기</button></div>;
 return createPortal(<div ref={root}><RecordHelperWorkspacePanel electronSession chatGpt={connection} onClose={onClose} onOpenAiSettings={onOpenAiSettings}
 importLabel={dropped?`확인한 드롭 보고서 ${dropped.files.length}개 가져오기`:undefined}
 onCancelDropped={dropped?()=>{void window.electronWork.fileDrop?.cancel({token:dropped.token});onDropDone?.();}:undefined}
 importReports={async()=>{if(!dropped)return read(await api.pick());try{const bridge=window.electronWork.fileDrop;if(!bridge)throw Error('드롭 연결이 없습니다.');return read(await bridge.record({token:dropped.token}));}finally{onDropDone?.();}}}
 onRefreshConnection={()=>{void refresh();}}
 onGenerateReviewed={async request=>{const result=read(await api.generateReviewed({...request,accountId:nativeStatus?.accountId??'',model:nativeStatus?.model??'',approved:true}));if(!result)throw Error('전송을 취소했습니다. 기존 학생 자료를 유지합니다.');return result.text;}}
 onCancelAi={reportId=>{void api.cancelAi({reportId});}} onCancelImport={()=>{void api.cancelImport();}}
 onDiscardWork={reportId=>{if(reportId)void api.cancelAi({reportId});else void api.clear();}}
 /></div>,document.body);
}
