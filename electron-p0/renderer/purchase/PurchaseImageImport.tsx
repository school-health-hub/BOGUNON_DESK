import {useEffect,useRef,useState} from 'react';
import {ImagePlus} from 'lucide-react';
import type {ImageSelection,ImageAnalysis} from '../../purchase-image-protocol';
import type {PurchaseItem} from './purchase/types';
import {parseImageReview,emptyImageReviewRow,reviewRowItem,reviewWarnings,duplicateReviewIds,type ImageReviewRow,type ImageCharge} from './imageReview';
import './image-import.css';
export function PurchaseImageImport({items,onApply,onNotice}:{readonly items:readonly PurchaseItem[];readonly onApply:(items:readonly PurchaseItem[],replace:boolean)=>void;readonly onNotice:(message:string)=>void}){
 const api=window.electronWork?.purchase.images;
 const [selection,setSelection]=useState<ImageSelection|null>(null),[analysis,setAnalysis]=useState<ImageAnalysis|null>(null),[rows,setRows]=useState<ImageReviewRow[]>([]),[charges,setCharges]=useState<ImageCharge[]>([]),[busy,setBusy]=useState(false),[replace,setReplace]=useState(false),[status,setStatus]=useState('');
 const manualSequence=useRef(0);
 const seq=useRef(0),snapshot=useRef(''),live=useRef(items);live.current=items;
 const cancel=()=>{seq.current++;setSelection(null);setAnalysis(null);setRows([]);setCharges([]);setBusy(false);setStatus('이미지 검토를 취소했습니다. 기존 품목은 유지합니다.');void api?.cancel().catch(()=>{});};
 useEffect(()=>()=>{seq.current++;void api?.cancel().catch(()=>{});},[api]);
 const pick=async()=>{if(!api)return;const token=++seq.current;snapshot.current=JSON.stringify(live.current);setBusy(true);setSelection(null);setAnalysis(null);setRows([]);setCharges([]);setReplace(false);setStatus('이미지 선택 중…');
  try{const r=await api.pick();if(token!==seq.current)return;if(!r.ok){setStatus(r.error.message);return;}if(!r.data){setStatus('이미지 선택을 취소했습니다. 기존 품목을 유지합니다.');return;}setSelection(r.data);setStatus(`${r.data.sources.length}장 선택됨 · 순서와 원본을 확인한 후 OCR을 실행하세요.`);}
  catch{if(token===seq.current)setStatus('이미지를 선택하지 못했습니다. 기존 품목은 유지합니다.');}finally{if(token===seq.current)setBusy(false);}
 };
 const analyze=async()=>{if(!api||!selection)return;const token=seq.current;setBusy(true);setStatus('오프라인 OCR 분석 중… 이미지별 최대 60초, 전체 4분입니다.');
  try{const r=await api.analyze({token:selection.token});if(token!==seq.current)return;if(!r.ok){setStatus(r.error.message);return;}if(!r.data){setStatus('분석이 취소되었습니다.');return;}const parsed=parseImageReview(selection,r.data);setAnalysis(r.data);setRows(parsed.rows);setCharges(parsed.charges);setStatus('OCR은 임시 제안입니다. 원본 근거·옵션·금액·중복을 검토하고 품목별로 승인하세요.');}
  catch(error){if(token===seq.current)setStatus(error instanceof RangeError&&error.message==='검토 품목이 200개를 초과했습니다. 이미지를 나누어 분석해 주세요.'?error.message:'OCR 연결에 실패했습니다. 기존 품목을 유지합니다.');}finally{if(token===seq.current)setBusy(false);}
 };
 const patch=(id:string,key:keyof ImageReviewRow,value:string)=>setRows(old=>old.map(r=>r.id===id?{...r,[key]:value,approved:false}:['name','option','specification'].includes(key)?{...r,approved:false}:r));
 const apply=()=>{if(!selection||busy)return;if(snapshot.current!==JSON.stringify(live.current)){cancel();onNotice('이미지 선택 이후 구매 목록이 변경되었습니다. 최신 목록을 보존했습니다. 이미지를 다시 선택해 주세요.');return;}
  const approved=rows.filter(r=>r.approved),converted=approved.map(r=>reviewRowItem(r,selection));if(!approved.length||converted.some(i=>i===null)){setStatus('유효한 품목을 검토·승인해 주세요.');return;}
  if(!window.confirm(replace?`현재 ${live.current.length}개 품목과 품의문·정산 초안을 승인한 ${approved.length}개 이미지 품목으로 교체할까요?`:`승인한 ${approved.length}개 이미지 품목을 기존 목록 뒤에 추가할까요? 중복 후보도 선택한 대로 추가됩니다.`))return;
  onApply(converted as PurchaseItem[],replace);cancel();onNotice('사용자가 승인한 이미지 품목을 적용했습니다. 기존 계산·출력의 금액 검토를 계속 사용합니다.');
 };
 const duplicates=duplicateReviewIds(rows,items);
 return <section className={`purchase-image-import${selection||busy?' is-open':''}`} aria-label="장바구니 이미지 가져오기">
  <button type="button" disabled={busy||!api} onClick={()=>void pick()}><ImagePlus size={16}/>장바구니 이미지 선택</button>
  <p>JPG/JPEG/PNG 최대 10장 · 장당 10MiB · 외부 전송 없음 · 학생·교직원·실제 학교 자료를 선택하지 마세요.</p>
  {(busy||selection)&&<button type="button" onClick={cancel}>이미지 분석 취소</button>}
  <p role="status">{status}</p>
  {selection&&<><ol className="purchase-image-sources">{selection.sources.map(s=><li key={s.id}><img src={s.thumbnail} alt={`이미지 ${s.order} 원본 썸네일: ${s.name}`}/><strong>{s.order}. {s.name}</strong><small>{s.width} × {s.height}</small>{s.warning&&<p>{s.warning}</p>}{selection.sources.some(other=>other.id!==s.id&&other.sha256===s.sha256)&&<p className="image-review-warning">동일 캡처 후보 · 자동 삭제하지 않았습니다.</p>}</li>)}</ol>
   {!analysis&&<button type="button" disabled={busy} onClick={()=>void analyze()}>선택 이미지 OCR 실행</button>}
   {analysis&&<div className="purchase-image-review" role="region" aria-label="이미지 품목 검토">
    {selection.sources.map(s=><section key={s.id}><h3>이미지 {s.order} · {s.name}</h3>{analysis.results.find(r=>r.sourceId===s.id)?.message&&<p role="alert">{analysis.results.find(r=>r.sourceId===s.id)?.message}</p>}
     <details><summary>OCR 원문·좌표 근거</summary><ol>{analysis.results.find(r=>r.sourceId===s.id)?.lines.map((line,i)=><li key={i}>{line.text} <small>신뢰도 {Math.round(line.confidence)}% · 좌표 {line.box.join(', ')}</small></li>)}</ol></details>
     {charges.filter(c=>c.sourceId===s.id).map(c=><p key={c.lineIndex}>품목 제외 · {c.text} (원문 {c.lineIndex+1}행)</p>)}
     {rows.filter(r=>r.sourceId===s.id).map(row=>{const warnings=reviewWarnings(row,selection),valid=reviewRowItem(row,selection)!==null;return <fieldset key={row.id} className="purchase-image-row"><legend>검토 품목 {rows.indexOf(row)+1} · 이미지 {s.order}</legend><p>근거: {row.lineIndices.map(i=>i+1).join(', ')||'원본을 보고 직접 입력'}행</p>
      <div className="purchase-image-fields">{([['name','상품명'],['option','옵션'],['specification','규격'],['quantity','주문 수량'],['unitPrice','적용 단가'],['amount','이미지 상품금액']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={`검토 ${rows.indexOf(row)+1} ${label}`} maxLength={300} inputMode={['quantity','unitPrice','amount'].includes(key)?'numeric':undefined} value={row[key]} onChange={e=>patch(row.id,key,e.target.value)}/></label>)}</div>
      {duplicates.has(row.id)&&<p className="image-review-warning">중복 후보입니다. 같은 상품·옵션이 기존 목록 또는 다른 캡처에 있습니다. 자동 제거하지 않습니다.</p>}
      {warnings.length>0&&<ul className="image-review-warning">{warnings.map(w=><li key={w}>{w}</li>)}</ul>}
      <label><input type="checkbox" checked={row.approved} disabled={!valid} onChange={e=>setRows(old=>old.map(r=>r.id===row.id?{...r,approved:e.target.checked}:r))}/>원본·옵션·수량·금액·중복을 확인했고 이 품목을 승인합니다</label>
      <button type="button" onClick={()=>setRows(old=>old.filter(r=>r.id!==row.id))}>이 검토 품목 제외</button>
     </fieldset>;})}
     <button type="button" onClick={()=>setRows(old=>[...old,emptyImageReviewRow(s.id,`${s.id}-manual-${manualSequence.current++}-${old.length}`)])}>이미지 {s.order}에 검토 품목 추가</button>
    </section>)}
    <label>이미지 품목 적용 방식<select aria-label="이미지 품목 적용 방식" value={replace?'replace':'append'} onChange={e=>setReplace(e.target.value==='replace')}><option value="append">기존 목록에 추가</option><option value="replace">기존 목록 교체</option></select></label>
    <button type="button" disabled={!rows.some(r=>r.approved)||busy} onClick={apply}>승인한 이미지 품목 적용</button>
   </div>}
  </>}
 </section>;
}
