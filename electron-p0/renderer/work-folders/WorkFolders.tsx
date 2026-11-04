import {useEffect,useRef,useState} from 'react';
import {WorkFoldersPanel} from '../../../src/components/desktop/WorkFoldersPanel';
import type {IpcResult} from '../../protocol';
import type {WorkFoldersLoad} from '../../work-folders-protocol';
import './work-folders.css';

export async function openMemoUrl(url:string):Promise<void>{
 const api=window.electronWork.memoLinks;if(!api)throw Error('이 실행본은 메모 링크 열기를 지원하지 않습니다.');
 const r=await api.open({url});if(!r.ok)throw Error(r.error.message);
}
export function useWorkFolders(){
 const api=window.electronWork.workFolders;
 const [snapshot,setSnapshot]=useState<WorkFoldersLoad|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('폴더 불러오는 중');
 const locked=useRef(false),live=useRef(false),failed=useRef(false);
 const perform=async(action:()=>Promise<IpcResult<WorkFoldersLoad|null>>,success:string)=>{
  if(locked.current)return;locked.current=true;setBusy(true);setError('');
  try{const r=await action();if(!live.current)return;if(!r.ok)throw Error(r.error.message);if(r.data){setSnapshot(r.data);failed.current=false;setStatus(r.data.recovered?'백업 목록 · 읽기 전용':success);}else setStatus('취소됨 — 기존 폴더 목록을 유지합니다.');}
  catch(e){if(live.current){setError(e instanceof Error?e.message:'폴더 연결 실패 — 기존 목록을 유지합니다.');setStatus('변경되지 않음');}}
  finally{locked.current=false;if(live.current)setBusy(false);}
 };
 const load=()=>perform(async()=>{try{if(!api)throw Error('업무 폴더 연결이 없습니다.');const r=await api.load();if(!r.ok)failed.current=true;return r;}catch(e){failed.current=true;throw e;}},'폴더 불러옴');
 useEffect(()=>{live.current=true;void load();return()=>{live.current=false;};},[api]);
 const mutate=(action:(revision:number)=>Promise<IpcResult<WorkFoldersLoad|null>>,message:string)=>perform(async()=>{if(!snapshot||snapshot.recovered||failed.current)throw Error('폴더를 다시 불러와 확인해 주세요.');return action(snapshot.revision);},message);
 const open=async(id:string):Promise<string|null>=>{if(locked.current)return null;try{if(!api)throw Error('업무 폴더 연결이 없습니다.');const r=await api.open({id});if(!r.ok)throw Error(r.error.message);if(live.current){setError('');setStatus('폴더 열기 요청을 전달했습니다.');}return null;}catch(e){const message=e instanceof Error?e.message:'폴더를 열지 못했습니다.';if(live.current)setError(message);return message;}};
 return {snapshot,busy,error,status,disabled:busy||!snapshot||snapshot.recovered||failed.current,load,open,
  add:()=>mutate(revision=>api!.pick({expectedRevision:revision}),'폴더 등록됨'),
  rename:(id:string,name:string)=>mutate(revision=>api!.rename({id,name,expectedRevision:revision}),'폴더 이름 저장됨'),
  remove:(id:string)=>mutate(revision=>api!.remove({id,expectedRevision:revision,confirmed:true}),'즐겨찾기 등록 해제됨'),
  move:(id:string,delta:number)=>{const ids=snapshot?.favorites.map(f=>f.id)??[],index=ids.indexOf(id),target=index+delta;if(index<0||target<0||target>=ids.length)return Promise.resolve();[ids[index],ids[target]]=[ids[target],ids[index]];return mutate(revision=>api!.reorder({ids,expectedRevision:revision}),'폴더 순서 저장됨');},
 };
}
export type WorkFoldersState=ReturnType<typeof useWorkFolders>;
export function WorkFoldersContent({state,onClose}:{state:WorkFoldersState;onClose:()=>void}){
 const [edit,setEdit]=useState<{id:string;name:string}|null>(null);
 return <>
  <p>자주 사용하는 로컬 폴더를 최대 12개까지 즐겨찾기로 등록합니다. 등록 해제는 실제 파일을 삭제하지 않습니다.</p>
  <p>UNC·공유 경로·symlink/junction·바로가기는 지원하지 않습니다. 이동한 폴더는 해제 후 다시 등록해 주세요.</p>
  <button type="button" disabled={state.busy} onClick={()=>void state.load()}>폴더 다시 불러오기</button>
  <p role="status">{state.status}</p>{state.error&&<p role="alert">{state.error}</p>}
  <WorkFoldersPanel embedded disabled={state.disabled} favorites={state.snapshot?.favorites??[]} isLoading={!state.snapshot&&state.busy} onAdd={()=>void state.add()} onClose={onClose} onOpen={id=>void state.open(id)} renderActions={(f,index)=><div className="p0-work-folder-actions">
   {!f.available&&<p>{state.snapshot?.favorites.find(v=>v.id===f.id)?.unavailableReason}</p>}
   <button type="button" disabled={state.disabled||index===0} aria-label={`${f.name} 위로 이동`} onClick={()=>void state.move(f.id,-1)}>↑</button>
   <button type="button" disabled={state.disabled||index===(state.snapshot?.favorites.length??0)-1} aria-label={`${f.name} 아래로 이동`} onClick={()=>void state.move(f.id,1)}>↓</button>
   <button type="button" disabled={state.disabled} aria-label={`${f.name} 이름 변경`} onClick={()=>setEdit({id:f.id,name:f.name})}>이름 변경</button>
   <button type="button" disabled={state.disabled} aria-label={`${f.name} 즐겨찾기 해제`} onClick={()=>void state.remove(f.id)}>즐겨찾기 해제</button>
   {edit?.id===f.id&&<form onSubmit={e=>{e.preventDefault();void state.rename(f.id,edit.name);}}><label>폴더 이름<input aria-label={`${f.name} 새 이름`} maxLength={80} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></label><button type="submit" disabled={state.disabled}>이름 저장</button><button type="button" onClick={()=>setEdit(null)}>이름 편집 취소</button></form>}
  </div>}/>
 </>;
}
