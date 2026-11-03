import {createContext,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react'
import {useWidgetSession} from '../../../src/dashboard/WidgetSessionContext'
import type {WorkspaceDataState} from '../../../src/workspace-data/types'
import {formatWorkspaceDate} from '../../../src/workspace-data/workspaceDataAdapter'
import {validateLocalTasks,type LocalTask,type LocalTaskDocument} from '../../local-tasks'
import {localTaskWorkspace} from './selectors'
type Value={document:LocalTaskDocument|null;state:WorkspaceDataState;busy:boolean;recovered:boolean;error:string|null;refresh:()=>Promise<void>;commit:(tasks:readonly LocalTask[],id?:string)=>Promise<boolean>;pendingTaskId:string|null;setTaskCompleted:(id:string,completed:boolean)=>Promise<'success'|'error'>}
const Context=createContext<Value|null>(null)
export function LocalWorkspaceProvider({children}:{children:ReactNode}){
 const {now}=useWidgetSession(),[document,setDocument]=useState<LocalTaskDocument|null>(null),[loading,setLoading]=useState(true),[pendingTaskId,setPendingTaskId]=useState<string|null>(null),[recovered,setRecovered]=useState(false),[error,setError]=useState<string|null>(null),[conflict,setConflict]=useState(false)
 const locked=useRef(false),reading=useRef(false),active=useRef(true),sequence=useRef(0)
 const refresh=async()=>{
  if(locked.current)return;const ticket=++sequence.current;reading.current=true;setLoading(true)
  try{const r=await window.electronWork.tasks.load();if(!r.ok)throw Error(r.error.message);const value=validateLocalTasks(r.data.document);if(active.current&&ticket===sequence.current){setDocument(value);setRecovered(r.data.recovered);setConflict(false);setError(null)}}catch(e){if(active.current&&ticket===sequence.current)setError(e instanceof Error?e.message:'로컬 업무를 불러오지 못했습니다.')}
  finally{if(active.current&&ticket===sequence.current){reading.current=false;setLoading(false)}}
 }
 useEffect(()=>{active.current=true;void refresh();return()=>{active.current=false;sequence.current++}},[])
 const commit=async(tasks:readonly LocalTask[],id='local-task-save')=>{
  if(locked.current||reading.current||!document||recovered||conflict)return false
  locked.current=true;setPendingTaskId(id);setError(null)
  try{const next=validateLocalTasks({...document,tasks}),r=await window.electronWork.tasks.save(next,document.revision);if(!r.ok){if(r.error.code==='CONFLICT'&&active.current)setConflict(true);throw Error(r.error.message)}const saved=validateLocalTasks(r.data.document);if(active.current)setDocument(saved);return true}
  catch(e){if(active.current)setError(e instanceof Error?e.message:'업무를 저장하지 못했습니다. 입력과 기존 데이터를 유지합니다.');return false}
  finally{locked.current=false;if(active.current)setPendingTaskId(null)}
 }
 const setTaskCompleted=async(id:string,completed:boolean):Promise<'success'|'error'>=>{
  if(!document?.tasks.some(t=>t.id===id))return 'error'
  return await commit(document.tasks.map(t=>t.id===id?{...t,completed}:t),id)?'success':'error'
 }
 const date=formatWorkspaceDate(now)
 const state:WorkspaceDataState=useMemo(()=>document?{status:'ready',data:localTaskWorkspace(document,now)}:{status:loading?'loading':'error'},[document,date,loading])
 return <Context.Provider value={{document,state,busy:loading||pendingTaskId!==null||conflict,recovered,error,refresh,commit,pendingTaskId,setTaskCompleted}}>{children}</Context.Provider>
}
export function useLocalWorkspace(){const value=useContext(Context);if(!value)throw Error('LocalWorkspaceProvider required');return value}
