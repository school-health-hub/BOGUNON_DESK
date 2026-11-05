import {useEffect,useRef,useState} from 'react';
import {QuickAddPanel} from '../../../src/components/desktop/QuickAddPanel';
import type {QuickAddInput} from '../../../src/workspace-data/workItemCreateService';
import {useLocalWorkspace} from '../local-tasks/LocalWorkspaceProvider';
import {SurfaceDialog} from '../SurfaceDialog';import {localQuickTask} from './localQuickTask';
export function LocalQuickAdd({date,title='',onClose,onNotice,onCalendar}:{date:string;title?:string;onCalendar?:()=>void;onClose:()=>void;onNotice:(message:string)=>void}){
 const data=useLocalWorkspace(),[id]=useState(()=>crypto.randomUUID()),[saving,setSaving]=useState(false),[error,setError]=useState<string|null>(null),locked=useRef(false),live=useRef(true),sequence=useRef(0);
 useEffect(()=>{live.current=true;return()=>{live.current=false;sequence.current++;};},[]);
 const close=()=>{if(locked.current)return;sequence.current++;onNotice('빠른 추가를 취소했습니다. 기존 로컬 업무는 유지됩니다.');onClose();};
 const submit=async(input:QuickAddInput)=>{
  if(locked.current||data.busy||data.recovered||!data.document)return;
  const ticket=++sequence.current;locked.current=true;setSaving(true);setError(null);
  try{
   const task=localQuickTask(input,id),existing=data.document.tasks.find(t=>t.id===id);
   if(existing){if((Object.keys(task) as (keyof typeof task)[]).some(key=>existing[key]!==task[key]))throw Error('이 요청으로 저장된 업무가 있습니다. 업무 관리에서 확인해 주세요.');}
   else if(!await data.commit([...data.document.tasks,task],id))throw Error('저장하지 못했습니다. 입력과 기존 업무를 유지합니다. 상태를 확인한 뒤 다시 시도해 주세요.');
   if(live.current&&ticket===sequence.current){onNotice('로컬 업무를 저장했습니다. Dashboard에 반영됐습니다. 서버에는 전송하지 않았습니다.');onClose();}
  }catch(e){if(live.current&&ticket===sequence.current)setError(e instanceof Error?e.message:'저장하지 못했습니다. 기존 업무와 입력을 유지합니다.');}
  finally{locked.current=false;if(live.current&&ticket===sequence.current)setSaving(false);}
 };
 return <SurfaceDialog title="빠른 추가 — 로컬 업무" closeDisabled={saving} onClose={close}>
  {data.error&&<p role="alert">{data.error}</p>}{data.recovered&&<p role="alert">백업을 읽기 전용으로 표시합니다. 기존 원본을 덮어쓰지 않습니다.</p>}
  <button type="button" disabled={saving||data.pendingTaskId!==null} onClick={()=>void data.refresh()}>로컬 업무 다시 불러오기</button>
  <QuickAddPanel embedded onOpenLocalCalendar={onCalendar} storageMode="electron-local" authStatus="signedOut" initialDate={date} initialTaskTitle={title} initialTaskCategory="officialDocument" isSaving={saving} saveEnabled={!!data.document&&!data.busy&&!data.recovered} error={error} onClose={close} onSubmit={submit}/>
 </SurfaceDialog>;
}
