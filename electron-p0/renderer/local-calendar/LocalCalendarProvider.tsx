import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {validateEvents,type EventDocument,type LocalEventDraft,type EventLoad} from '../../local-events';
import type {IpcResult} from '../../protocol';
type State={document:EventDocument|null;available:boolean;busy:boolean;recovered:boolean;error:string;refresh:()=>Promise<void>;save:(event:LocalEventDraft,expectedUpdatedAt:string|null)=>Promise<boolean>;remove:(id:string,expectedUpdatedAt:string)=>Promise<boolean>};
const Context=createContext<State|null>(null);
export function LocalCalendarProvider({children}:{children:ReactNode}){
 const api=window.electronWork?.events,[document,setDocument]=useState<EventDocument|null>(null),[loading,setLoading]=useState(!!api),[pending,setPending]=useState(false),[recovered,setRecovered]=useState(false),[conflict,setConflict]=useState(false),[error,setError]=useState('');
 const live=useRef(true),locked=useRef(false),reading=useRef(false),epoch=useRef(0),current=useRef<EventDocument|null>(null);
 const accept=(data:EventLoad)=>{const next=validateEvents(data.document);current.current=next;setDocument(next);setRecovered(data.recovered);setConflict(false);setError('');};
 const refresh=async()=>{
  if(!api||locked.current)return;const ticket=++epoch.current;reading.current=true;setLoading(true);
  try{const result=await api.load();if(!result.ok)throw Error(result.error.message);if(live.current&&ticket===epoch.current)accept(result.data);}
  catch(e){if(live.current&&ticket===epoch.current){setError(e instanceof Error?e.message:'일정을 불러오지 못했습니다.');setConflict(true);}}
  finally{if(live.current&&ticket===epoch.current){reading.current=false;setLoading(false);}}
 };
 useEffect(()=>{live.current=true;void refresh();return()=>{live.current=false;epoch.current++;};},[api]);
 const change=async(operation:(revision:number)=>Promise<IpcResult<EventLoad>>)=>{
  if(!api||!current.current||locked.current||reading.current||recovered||conflict)return false;locked.current=true;setPending(true);const ticket=++epoch.current;
  try{const result=await operation(current.current.revision);if(!result.ok){if(result.error.code==='CONFLICT'&&live.current)setConflict(true);throw Error(result.error.message);}if(live.current&&ticket===epoch.current)accept(result.data);return true;}
  catch(e){if(live.current&&ticket===epoch.current)setError(e instanceof Error?e.message:'저장하지 못했습니다. 기존 자료와 입력을 유지합니다.');return false;}
  finally{locked.current=false;if(live.current&&ticket===epoch.current)setPending(false);}
 };
 return <Context.Provider value={{document,available:!!api,busy:loading||pending||conflict,recovered,error,refresh,save:(event,expectedUpdatedAt)=>change(expectedRevision=>api!.save({event,expectedRevision,expectedUpdatedAt})),remove:(id,expectedUpdatedAt)=>change(expectedRevision=>api!.remove({id,expectedRevision,expectedUpdatedAt,confirmed:true}))}}>{children}</Context.Provider>;
}
export const useOptionalCalendar=()=>useContext(Context);
export function useLocalCalendar(){const value=useOptionalCalendar();if(!value)throw Error('LocalCalendarProvider required');return value;}
export function LocalCalendarStatus({onOpen}:{onOpen:()=>void}){
 const value=useLocalCalendar();if(!value.available||value.document&&!value.error&&!value.recovered)return null;
 return <div role={value.error||value.recovered?'alert':'status'} className="p0-notice p0-calendar-status">{value.error?'독립 일정 저장소 오류 — 일정 요약 수치는 확인이 필요합니다. 기존 파일과 업무는 유지합니다.':value.recovered?'독립 일정은 백업 읽기 전용입니다.':'독립 일정을 불러오는 중입니다.'}<button type="button" onClick={onOpen}>일정 상태 확인</button></div>;
}
