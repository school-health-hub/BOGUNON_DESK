import {useId,useRef,useState} from 'react';
import type {NewsletterProject} from '../../../src/newsletter/schema';
import type {NewsletterDesignState} from '../../../src/newsletter/rendering/designSchema';
import type {NewsletterAssetResolver} from '../../../src/newsletter/rendering/assetResolution';
import {referencedDesignAssets} from '../../../src/newsletter/rendering/assetResolution';
import {serializeStudioDocument} from '../../../src/newsletter/studioDocument';
import type {NewsletterExportSelection} from '../../protocol';
type Props={project:NewsletterProject;design:NewsletterDesignState;ready:boolean;blockedReason:string;assetResolver?:NewsletterAssetResolver};
export function NewsletterOutputControls({project,design,ready,blockedReason,assetResolver}:Props){
 const reasonId=useId();
 const lockLabelId=useId();
 const lock=useRef<HTMLDialogElement>(null);
 const [selection,setSelection]=useState<NewsletterExportSelection>('a4-pdf'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const save=async()=>{
  const dialog=lock.current;
  if(!ready||dialog===null||dialog.open)return;
  setBusy(true);setMessage('출력 검증·생성 중…');
  try{
   dialog.showModal();
  const assets=await Promise.all(referencedDesignAssets(design,design.designRevision).map(async a=>{
   const reference=`asset:${a.sha256}`;if(!assetResolver||a.localReference!==reference)throw Error('이미지 원본을 다시 연결해 주세요.');const bytes=await assetResolver.resolve(reference);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return {reference,bytesBase64:btoa(binary)};
  }));
  const result=await window.electronWork.newsletter.exportOutput({document:serializeStudioDocument({project,design}),selection,assets});
  setMessage(result.ok?(result.data.saved?`출력물을 저장했습니다. ${(result.data.names??[]).join(' · ')}`:'출력 저장을 취소했습니다.'):result.error.message);
 }catch{setMessage('출력 준비에 실패했습니다. 이미지 원본과 승인 상태를 확인해 주세요.');}finally{if(dialog.open)dialog.close();setBusy(false);}};
 return <fieldset className="control-stack"><legend>PNG·PDF 출력</legend><label>출력 형식<select aria-label="출력 형식" value={selection} disabled={busy} onChange={e=>setSelection(e.target.value as NewsletterExportSelection)}><option value="a4-png">A4 PNG · 2480×3508</option><option value="a4-pdf">A4 PDF · 1페이지</option><option value="card-pngs">카드 PNG · 7장 · 새 묶음 폴더</option><option value="cards-pdf">카드 PDF · 7페이지</option></select></label><button type="button" className="p0-newsletter-export" aria-describedby={!ready?reasonId:undefined} disabled={!ready||busy} onClick={()=>void save()}>{busy?'출력 검증·생성 중…':'출력 위치 선택·저장'}</button>{!ready&&<small id={reasonId} role="status">출력 대기: {blockedReason}</small>}<small>승인된 자산으로만 출력합니다. 카드 PNG는 새 묶음 폴더에 보관하며 기존 폴더를 덮어쓰지 않습니다.</small><p role="status" data-export-status>{message}</p><dialog ref={lock} className="newsletter-output-lock" aria-labelledby={lockLabelId} onCancel={event=>event.preventDefault()}><strong id={lockLabelId}>출력 검증·생성 중…</strong><p>현재 미리보기와 일치하도록 출력이 끝날 때까지 편집을 잠급니다.</p></dialog></fieldset>;
}
