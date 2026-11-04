import {PurchaseAiControls} from './PurchaseAiControls';
import {aiImageReview} from './aiImageReview';
import {useEffect,useRef,useState} from 'react';
import {ImagePlus} from 'lucide-react';
import {DEFAULT_IMAGE_OCR,type ImageSelection,type ImageAnalysis,type ImageOcrOptions,type ImageBox} from '../../purchase-image-protocol';
import type {PurchaseItem} from './purchase/types';
import {parseImageReview,emptyImageReviewRow,reviewRowItem,reviewWarnings,duplicateReviewIds,type ImageReviewRow,type ImageCharge} from './imageReview';
import {ImageEvidenceView,type EvidenceRequest} from './ImageEvidenceView';
import {similarImages,reorderedSelection,duplicateCandidates} from './imageSimilarity';
import './image-import.css';
export function PurchaseImageImport({items,onApply,onNotice}:{readonly items:readonly PurchaseItem[];readonly onApply:(items:readonly PurchaseItem[],replace:boolean)=>void;readonly onNotice:(message:string)=>void}){
 const api=window.electronWork?.purchase.images;
 const [selection,setSelection]=useState<ImageSelection|null>(null),[analysis,setAnalysis]=useState<ImageAnalysis|null>(null),[rows,setRows]=useState<ImageReviewRow[]>([]),[charges,setCharges]=useState<ImageCharge[]>([]),[busy,setBusy]=useState(false),[replace,setReplace]=useState(false),[status,setStatus]=useState('');
 const [settings,setSettings]=useState<Record<string,ImageOcrOptions>>({}),[evidence,setEvidence]=useState<EvidenceRequest|null>(null);const opener=useRef<HTMLElement|null>(null);
 const [method,setMethod]=useState<'ai'|'ocr'>(api?.ai?'ai':'ocr'),[aiResult,setAiResult]=useState<import('../../purchase-ai-protocol').ImageAiAnalysis|null>(null),[aiStale,setAiStale]=useState(false);
 const manualSequence=useRef(0);
 const seq=useRef(0),snapshot=useRef(''),live=useRef(items);live.current=items;
 const cancel=()=>{seq.current++;setAiResult(null);setAiStale(false);setEvidence(null);setSettings({});setSelection(null);setAnalysis(null);setRows([]);setCharges([]);setBusy(false);setStatus('이미지 검토를 취소했습니다. 기존 품목은 유지합니다.');void api?.cancel().catch(()=>{});};
 useEffect(()=>()=>{seq.current++;void api?.cancel().catch(()=>{});},[api]);
 const pick=async()=>{if(!api||busy)return;if(rows.length&&!window.confirm('새 이미지를 선택하면 현재 이미지 검토 수정·승인을 초기화합니다. 계속할까요?'))return;const token=++seq.current;snapshot.current=JSON.stringify(live.current);setAiResult(null);setAiStale(false);setBusy(true);setEvidence(null);setSettings({});setSelection(null);setAnalysis(null);setRows([]);setCharges([]);setReplace(false);setStatus('이미지 선택 중…');
  try{const r=await api.pick();if(token!==seq.current)return;if(!r.ok){setStatus(r.error.message);return;}if(!r.data){setStatus('이미지 선택을 취소했습니다. 기존 품목을 유지합니다.');return;}setSelection(r.data);setStatus(`${r.data.sources.length}장 선택됨 · 순서와 원본을 확인한 후 OCR을 실행하세요.`);}
  catch{if(token===seq.current)setStatus('이미지를 선택하지 못했습니다. 기존 품목은 유지합니다.');}finally{if(token===seq.current)setBusy(false);}
 };
 const analyze=async()=>{if(!api||!selection)return;if(analysis&&rows.length&&!window.confirm('다시 분석하면 현재 이미지 검토 수정·승인을 새 OCR 결과로 바꿉니다. 계속할까요?'))return;setEvidence(null);const token=seq.current;setBusy(true);setStatus('오프라인 OCR 분석 중… 이미지별 최대 60초, 전체 4분입니다.');
  try{const r=await api.analyze({token:selection.token,settings:selection.sources.map(source=>({...DEFAULT_IMAGE_OCR,...settings[source.id],sourceId:source.id}))});if(token!==seq.current)return;if(!r.ok){setStatus(r.error.message);return;}if(!r.data){setStatus('분석이 취소되었습니다.');return;}const parsed=parseImageReview(selection,r.data);setAiResult(null);setAiStale(false);setAnalysis(r.data);setRows(parsed.rows);setCharges(parsed.charges);setStatus('OCR은 임시 제안입니다. 원본 근거·옵션·금액·중복을 검토하고 품목별로 승인하세요.');}
  catch(error){if(token===seq.current)setStatus(error instanceof RangeError&&error.message==='검토 품목이 200개를 초과했습니다. 이미지를 나누어 분석해 주세요.'?error.message:'OCR 연결에 실패했습니다. 기존 품목을 유지합니다.');}finally{if(token===seq.current)setBusy(false);}
 };
 const patch=(id:string,key:keyof ImageReviewRow,value:string)=>{if(busy)return;setRows(old=>old.map(r=>r.id===id?{...r,[key]:value,approved:false,edited:true}:['name','option','specification'].includes(key)?{...r,approved:false}:r));};
 const apply=()=>{if(!selection||busy||aiStale)return;if(snapshot.current!==JSON.stringify(live.current)){cancel();onNotice('이미지 선택 이후 구매 목록이 변경되었습니다. 최신 목록을 보존했습니다. 이미지를 다시 선택해 주세요.');return;}
  const approved=rows.filter(r=>r.approved),converted=approved.map(r=>reviewRowItem(r,selection));if(!approved.length||converted.some(i=>i===null)){setStatus('유효한 품목을 검토·승인해 주세요.');return;}
  if(!window.confirm(replace?`현재 ${live.current.length}개 품목과 품의문·정산 초안을 승인한 ${approved.length}개 이미지 품목으로 교체할까요?`:`승인한 ${approved.length}개 이미지 품목을 기존 목록 뒤에 추가할까요? 중복 후보도 선택한 대로 추가됩니다.`))return;
  onApply(converted as PurchaseItem[],replace);cancel();onNotice('사용자가 승인한 이미지 품목을 적용했습니다. 기존 계산·출력의 금액 검토를 계속 사용합니다.');
 };
 const duplicates=duplicateReviewIds(rows,items),candidates=duplicateCandidates(rows,items);
 const showEvidence=(sourceId:string,boxes:readonly ImageBox[],element:HTMLElement)=>{opener.current=element;setEvidence({sourceId,boxes});};
 const changeSetting=(sourceId:string,change:Partial<ImageOcrOptions>)=>{if(rows.length&&!window.confirm('전처리 설정을 바꾸면 현재 이미지 검토 수정·승인을 초기화합니다. 계속할까요?'))return;seq.current++;setEvidence(null);setAnalysis(null);setAiResult(null);setAiStale(true);setRows([]);setCharges([]);setSettings(old=>({...old,[sourceId]:{...DEFAULT_IMAGE_OCR,...old[sourceId],...change}}));setStatus('원본은 유지했습니다. 변경한 설정으로 OCR을 다시 실행해 주세요.');};
 const reorder=(sourceId:string,direction:-1|1)=>{if(!selection)return;const next=reorderedSelection(selection,sourceId,direction);if(next===selection)return;setSelection(next);if(aiResult)setAiStale(true);setRows(old=>[...old].sort((a,b)=>next.sources.findIndex(s=>s.id===a.sourceId)-next.sources.findIndex(s=>s.id===b.sourceId)).map(r=>({...r,approved:false})));setStatus('이미지 순서를 변경했습니다. 수정 내용은 유지하며 승인은 다시 확인해 주세요.');};
 return <section className={`purchase-image-import${selection||busy?' is-open':''}`} aria-label="장바구니 이미지 가져오기">
  <button type="button" disabled={busy||!api} onClick={()=>void pick()}><ImagePlus size={16}/>장바구니 이미지 선택</button>
  <p>JPG/JPEG/PNG 최대 10장 · 장당 10MiB · 원본 읽기 전용 · AI는 명시적 동의 후 외부 전송 · 학생·교직원·실제 학교 자료를 선택하지 마세요.</p>
  {(busy||selection)&&<button type="button" onClick={cancel}>이미지 분석 취소</button>}
  <p role="status">{status}</p>
  {selection&&<><label>분석 방식<select aria-label="이미지 분석 방식" disabled={busy} value={method} onChange={e=>{setMethod(e.target.value as 'ai'|'ocr');void api?.ai?.cancel();setAiStale(true);setRows(old=>old.map(r=>({...r,approved:false})));}}><option value="ai" disabled={!api?.ai}>연결된 AI</option><option value="ocr">로컬 OCR · 오프라인</option></select></label><ol className="purchase-image-sources">{selection.sources.map((source,index)=><li key={source.id}>
   <img src={source.thumbnail} alt={`이미지 ${source.order} 원본 썸네일: ${source.name}`}/><strong>{source.order}. {source.name}</strong><small>{source.width} × {source.height}</small>
   <div><button type="button" disabled={busy||index===0} aria-label={`이미지 ${source.order} 앞으로`} onClick={()=>reorder(source.id,-1)}>앞으로</button><button type="button" disabled={busy||index===selection.sources.length-1} aria-label={`이미지 ${source.order} 뒤로`} onClick={()=>reorder(source.id,1)}>뒤로</button><button type="button" disabled={busy||!api?.preview} onClick={e=>showEvidence(source.id,[],e.currentTarget)}>이미지 {source.order} 원본 확대</button></div>
   {method==='ocr'&&<><label>회전<select aria-label={`이미지 ${source.order} 회전`} disabled={busy} value={settings[source.id]?.rotation??0} onChange={e=>changeSetting(source.id,{rotation:Number(e.target.value) as ImageOcrOptions['rotation']})}>{[0,90,180,270].map(n=><option key={n} value={n}>{n}° 시계방향</option>)}</select></label>
   <label><input type="checkbox" aria-label={`이미지 ${source.order} 읽기 개선`} disabled={busy} checked={settings[source.id]?.enhance??false} onChange={e=>changeSetting(source.id,{enhance:e.target.checked})}/>작은 글씨·명암 개선 (제한된 2배 확대)</label>
   <label>배치<select aria-label={`이미지 ${source.order} 배치`} disabled={busy} value={settings[source.id]?.layout??'block'} onChange={e=>changeSetting(source.id,{layout:e.target.value as ImageOcrOptions['layout']})}><option value="block">한 열·문단</option><option value="sparse">카드·혼합 배치</option></select></label></>}
   {source.warning&&<p>{source.warning}</p>}{selection.sources.some(other=>other.id!==source.id&&other.sha256===source.sha256)?<p className="image-review-warning">동일 캡처 후보 · 자동 삭제하지 않았습니다.</p>:selection.sources.some(other=>other.id!==source.id&&similarImages(other,source))&&<p className="image-review-warning">유사 이미지 후보 · 배치가 비슷해도 같은 상품임을 보장하지 않습니다.</p>}
  </li>)}</ol>
   {evidence&&api&&<ImageEvidenceView api={api} selection={selection} request={evidence} onClose={()=>{setEvidence(null);const element=opener.current;if(element?.isConnected)element.focus();}}/>}
   {method==='ai'&&api?.ai&&<PurchaseAiControls key={selection.token+selection.sources.map(s=>s.id).join(',')} api={api} selection={selection} busy={busy} onBusy={setBusy} hasReview={rows.length>0} onNotice={setStatus} onInvalidate={()=>{setAiStale(true);setRows(old=>old.map(r=>({...r,approved:false})));}} onResult={result=>{const parsed=aiImageReview(result);setAiResult(result);setAnalysis(null);setRows(parsed.rows);setCharges(parsed.charges);setAiStale(false);setStatus('AI 결과는 임시 제안입니다. 이미지·근거 문구·옵션·금액·누락을 검토하고 개별 승인하세요.');}}/>}
   {method==='ocr'&&<button type="button" disabled={busy} onClick={()=>void analyze()}>{analysis?'현재 설정으로 다시 분석':'선택 이미지 OCR 실행'}</button>}
   {(analysis||aiResult)&&<div className="purchase-image-review" role="region" aria-label="이미지 품목 검토">
    {selection.sources.map(s=><section key={s.id}><h3>이미지 {s.order} · {s.name}</h3>{analysis?.results.find(r=>r.sourceId===s.id)?.message&&<p role="alert">{analysis?.results.find(r=>r.sourceId===s.id)?.message}</p>}
     {analysis&&<details><summary>OCR 원문·좌표 근거</summary><ol>{analysis?.results.find(r=>r.sourceId===s.id)?.lines.map((line,i)=><li key={i}>{line.text} <small>신뢰도 {Math.round(line.confidence)}% · 좌표 {line.box.join(', ')}</small></li>)}</ol></details>}
     {aiResult&&<p>{aiResult.provider} · {aiResult.model} · {aiResult.transmissions.find(t=>t.sourceId===s.id)?`전송본 SHA-256 ${aiResult.transmissions.find(t=>t.sourceId===s.id)!.sha256}`:'AI 전송 제외 · 자동 분석 결과 없음'}{aiResult.results.find(r=>r.sourceId===s.id)?.status==='error'?' · 이 이미지 분석 실패':''}</p>}
     {aiResult?.results.find(r=>r.sourceId===s.id)?.warnings.map((w,i)=><p key={i} role="alert">{w}</p>)}
     {charges.filter(c=>c.sourceId===s.id).map(c=><p key={c.lineIndex}>품목 제외 · {c.text} {c.ai?'(AI 제시 문구 · 원본 대조 필요)':`(원문 ${c.lineIndex+1}행)`}</p>)}
     {rows.filter(r=>r.sourceId===s.id).map(row=>{const warnings=reviewWarnings(row,selection),valid=reviewRowItem(row,selection)!==null;return <fieldset key={row.id} className="purchase-image-row"><legend>검토 품목 {rows.indexOf(row)+1} · 이미지 {s.order}</legend>{row.aiEvidence?<p>AI 제시 근거: {row.aiEvidence} · 원본 확인 필요 · {row.edited?'사용자 수정됨':'미수정'}{row.bundleQuantityText?` · 묶음 구성 ${row.bundleQuantityText}개 (주문 수량과 별도)`:''}</p>:<p>근거: {row.lineIndices.map(i=>i+1).join(', ')||'원본을 보고 직접 입력'}행</p>}
      <div className="purchase-image-fields">{([['name','상품명'],['option','옵션'],['specification','규격'],['quantity','주문 수량'],['unitPrice','적용 단가'],['amount','이미지 상품금액']] as const).map(([key,label])=><label key={key}>{label}<input disabled={busy} aria-label={`검토 ${rows.indexOf(row)+1} ${label}`} maxLength={300} inputMode={['quantity','unitPrice','amount'].includes(key)?'numeric':undefined} value={row[key]} onChange={e=>patch(row.id,key,e.target.value)}/>{row.confidences?.[key]!==undefined&&<small>신뢰도 {Math.round(row.confidences[key]!)}%{row.confidences[key]!<85?' · 원본 확인 필요':''}</small>}<button type="button" disabled={busy||!api?.preview} aria-label={`검토 ${rows.indexOf(row)+1} ${label} 위치`} onClick={e=>showEvidence(row.sourceId,row.fieldBoxes?.[key]??row.lineIndices.map(i=>analysis?.results.find(r=>r.sourceId===row.sourceId)?.lines[i]?.box).filter((b):b is ImageBox=>!!b),e.currentTarget)}>{row.aiEvidence?'원본과 근거 문구 보기':'추출 위치 보기'}</button></label>)}</div>
      {row.aiEvidence&&<div className="purchase-image-fields">{([['bundleQuantityText','묶음 구성 수량'],['originalPrice','정가'],['discount','상품별 할인']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={`검토 ${rows.indexOf(row)+1} ${label}`} inputMode="numeric" maxLength={20} disabled={busy} value={row[key]??''} onChange={e=>patch(row.id,key,e.target.value)}/></label>)}</div>}
      {duplicates.has(row.id)&&<p className="image-review-warning">중복 후보입니다. 같은 상품·옵션이 기존 목록 또는 다른 캡처에 있습니다. 자동 제거하지 않습니다. {candidates.find(c=>c.rowId===row.id)?.reason}</p>}
      {row.priceCandidates&&row.priceCandidates.length>0&&<details><summary>가격별 원문 후보</summary><ul>{row.priceCandidates.map((price,i)=><li key={i}>{price.label}: {price.value} · {price.lineIndex+1}행</li>)}</ul></details>}
      {warnings.length>0&&<ul className="image-review-warning">{warnings.map(w=><li key={w}>{w}</li>)}</ul>}
      <label><input type="checkbox" checked={row.approved} disabled={!valid||busy||aiStale} onChange={e=>setRows(old=>old.map(r=>r.id===row.id?{...r,approved:e.target.checked}:r))}/>원본·옵션·수량·금액·중복을 확인했고 이 품목을 승인합니다</label>
      <button type="button" disabled={busy} onClick={()=>setRows(old=>old.filter(r=>r.id!==row.id))}>이 검토 품목 제외</button>
     </fieldset>;})}
     <button type="button" disabled={rows.length>=200||busy} onClick={()=>setRows(old=>[...old,emptyImageReviewRow(s.id,`${s.id}-manual-${manualSequence.current++}-${old.length}`)])}>이미지 {s.order}에 검토 품목 추가</button>
    </section>)}
    <label>이미지 품목 적용 방식<select disabled={busy} aria-label="이미지 품목 적용 방식" value={replace?'replace':'append'} onChange={e=>setReplace(e.target.value==='replace')}><option value="append">기존 목록에 추가</option><option value="replace">기존 목록 교체</option></select></label>
    <button type="button" disabled={!rows.some(r=>r.approved)||busy||aiStale} onClick={apply}>승인한 이미지 품목 적용</button>
   </div>}
  </>}
 </section>;
}
