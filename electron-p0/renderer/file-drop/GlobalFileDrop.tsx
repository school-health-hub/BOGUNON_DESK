import {useEffect,useRef,useState} from 'react';
import type {DropDelivery,DropOffer,DropTarget} from '../../file-drop-protocol';
import {FileDropRouter} from '../../../src/components/desktop/FileDropRouter';
import {SurfaceDialog} from '../SurfaceDialog';
import './file-drop.css';
export function GlobalFileDrop({onDeliver,blocked}:{onDeliver:(delivery:DropDelivery)=>void;blocked:(target:DropTarget)=>string|null}){
 const api=window.electronWork.fileDrop,[offer,setOffer]=useState<DropOffer|null>(null),[selected,setSelected]=useState<DropTarget|undefined>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[drag,setDrag]=useState(false);const serial=useRef(0),alive=useRef(false);
 useEffect(()=>{
  if(!api)return;alive.current=true;let generation=0;
  const dispose=api.onOffer(r=>{generation++;setDrag(false);if(r.ok){setOffer(r.data);setSelected(undefined);setError('');}else setError(r.error.message);});
  void api.status().then(r=>{if(alive.current&&generation===0&&r.ok&&r.data)setOffer(r.data);}).catch(()=>{});
  return()=>{alive.current=false;serial.current++;dispose();};
 },[api]);
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const enter=(e:DragEvent)=>{if(e.dataTransfer&&Array.from(e.dataTransfer.types).includes('Files')){setDrag(true);clearTimeout(timer);timer=setTimeout(()=>setDrag(false),1500);}};const end=()=>setDrag(false);window.addEventListener('dragover',enter);window.addEventListener('dragleave',end);window.addEventListener('drop',end);return()=>{clearTimeout(timer);window.removeEventListener('dragover',enter);window.removeEventListener('dragleave',end);window.removeEventListener('drop',end);};},[]);
 const cancel=()=>{serial.current++;if(offer)void api?.cancel({token:offer.token});setOffer(null);setError('');setBusy(false);};
 const approve=async()=>{
  if(!api||!offer||!selected||busy)return;const reason=blocked(selected);if(reason){setError(reason);return;}const sequence=++serial.current;setBusy(true);setError('');
  try{const r=await api.approve({token:offer.token,target:selected,approved:true});if(sequence!==serial.current||!alive.current){if(r.ok)void api.cancel({token:r.data.token});return;}if(!r.ok){setError(r.error.message);return;}if(blocked(selected)){void api.cancel({token:r.data.token});setError('현재 작업실 상태가 바뀌었습니다. 기존 작업을 유지하고 다시 확인해 주세요.');return;}setOffer(null);setError('');onDeliver(r.data);}
  catch{if(sequence===serial.current)setError('파일을 전달하지 못했습니다. 기존 작업은 유지합니다. 다시 드롭해 주세요.');}finally{if(sequence===serial.current)setBusy(false);}
 };
 const candidates=offer?.candidates.map(c=>{const reason=blocked(c.target);return reason?{...c,enabled:false,reason}:c;});
 return <>{drag&&!offer&&<div className="p0-file-drop-hint" role="status">파일을 놓으면 형식 확인 후 작업실을 선택할 수 있습니다.</div>}{(offer||error)&&<SurfaceDialog title="드롭 파일 확인" onClose={cancel}>
  {offer&&<><FileDropRouter embedded paths={offer.files.map(f=>f.name)} modelOverride={{names:offer.files.map(f=>f.name),candidates:candidates!}} chosenTarget={selected} disabled={busy} onCancel={cancel} onChoose={setSelected}/><ul aria-label="확인할 드롭 파일">{offer.files.map(f=><li key={f.id}>{f.name} · {f.kind.toUpperCase()} · {(f.bytes/1024).toFixed(1)}KiB</li>)}</ul></>}
  <p>전체 50개·150MiB 이내, 문서당 15MiB, 이미지 최대 10장·장당 10MiB를 지원합니다.</p>
  <p>승인 시점의 로컬 임시 사본만 준비합니다. 작업실의 가져오기·검토에서 기존 내용을 유지하며 적용 여부를 선택하세요. AI로 자동 전송하지 않습니다.</p>
  {error&&<p role="alert">{error}</p>}{busy&&<p role="status">파일 변경 여부를 확인하고 준비하는 중…</p>}
  <footer className="p0-file-drop-actions"><button type="button" onClick={cancel}>취소</button>{offer&&<button type="button" disabled={busy||!selected||!!blocked(selected)} onClick={()=>void approve()}>확인 후 작업실로 전달</button>}</footer>
 </SurfaceDialog>}</>;
}
