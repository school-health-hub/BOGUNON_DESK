import {useEffect,useRef,useState} from 'react';
import type {PurchaseCsvSelection} from '../../protocol';
import type {PurchaseColumnMapping,PurchaseItem} from './purchase/types';
import {purchaseImportFieldIds,purchaseImportFieldLabels} from './purchase/types';
export function PurchaseImportControls({items,onApply,onNotice,format="csv"}:{readonly format?:"csv"|"excel";readonly items:readonly PurchaseItem[];readonly onApply:(items:readonly PurchaseItem[],replace:boolean)=>void;readonly onNotice:(message:string)=>void}){
 const label=format==='csv'?"CSV":'Excel';
 const api=window.electronWork.purchase;
 const bridge=format==='csv'?{pick:()=>api.pickCsv(),cancel:()=>api.cancelCsv(),map:api.mapCsv}:{pick:()=>api.pickExcel(),cancel:()=>api.cancelExcel(),map:api.mapExcel};
 const [busy,setBusy]=useState(false),[selection,setSelection]=useState<PurchaseCsvSelection|null>(null);
 const [header,setHeader]=useState(0),[mapping,setMapping]=useState<PurchaseColumnMapping>({}),[replace,setReplace]=useState(false);
 const sequence=useRef(0),snapshot=useRef(''),live=useRef(items);live.current=items;
 const cancel=()=>{++sequence.current;setSelection(null);setBusy(false);void bridge.cancel().catch(()=>{});};
 useEffect(()=>()=>{++sequence.current;void bridge.cancel().catch(()=>{});},[]);
 const pick=async()=>{
  const token=++sequence.current;snapshot.current=JSON.stringify(live.current);setBusy(true);setSelection(null);setReplace(false);
  try{
   const reply=await bridge.pick();
   if(token!==sequence.current)return;
   if(!reply.ok){onNotice(reply.error.message);return;}
   if(!reply.data)return;
   if(snapshot.current!==JSON.stringify(live.current)){onNotice(`선택 중 품목이 변경되었습니다. 기존 품목을 보존했습니다. ${label}를 다시 선택해 주세요.`);return;}
   if(reply.data.result.sources.some(s=>s.status==='error'||s.status==='unsupported')){onNotice(`${label} 파일을 분석하지 못했습니다. 기존 품목을 보존했습니다.`);return;}
   setSelection(reply.data);const candidate=reply.data.result.candidates[0];setHeader(candidate?.headerOptions.find(o=>o.recommended)?.rowIndex??0);setMapping({});
   if(!reply.data.result.items.length&&!candidate)onNotice('가져올 품목이 없습니다. 기존 품목을 보존했습니다.');
  }catch{if(token===sequence.current)onNotice(`${label} 연결에 실패했습니다. 기존 품목은 보존됩니다.`);}
  finally{if(token===sequence.current)setBusy(false);}
 };
 const map=async()=>{
  const candidate=selection?.result.candidates[0];if(!candidate||!selection)return;
  const token=sequence.current;setBusy(true);
  try{
   const reply=await bridge.map({generation:selection.generation,candidateId:candidate.id,headerRow:header,mapping});
   if(token!==sequence.current)return;
   if(!reply.ok)onNotice(reply.error.message);else setSelection(reply.data);
  }catch{if(token===sequence.current)onNotice('열 연결에 실패했습니다. 기존 품목은 보존됩니다.');}
  finally{if(token===sequence.current)setBusy(false);}
 };
 const apply=()=>{
  if(!selection||!selection.result.items.length)return;
  if(snapshot.current!==JSON.stringify(live.current)){cancel();onNotice(`분석 후 품목이 변경되었습니다. 덮어쓰지 않았습니다. ${label}를 다시 선택해 주세요.`);return;}
  if(replace&&live.current.length&&!window.confirm(`현재 수동 품목과 품의문 초안을 ${label} 품목으로 교체할까요? 취소하면 기존 내용을 유지합니다.`))return;
  onApply(selection.result.items,replace);cancel();onNotice(replace?`${label} 품목으로 교체했습니다.`:`기존 품목을 유지하고 ${label} 품목을 추가했습니다.`);
 };
 const candidate=selection?.result.candidates[0];const option=candidate?.headerOptions.find(o=>o.rowIndex===header);
 return <>
  <button type="button" disabled={busy} onClick={()=>void pick()}>{label} 가져오기</button>
  {(busy||selection)&&<button type="button" onClick={cancel}>{label} 분석 취소</button>}
  {busy&&<span role="status">{label} 선택·분석 중…</span>}
  {candidate&&option&&<div className="purchase-mapping-backdrop"><section className="purchase-mapping-dialog" role="dialog" aria-modal="true" aria-label={`${label} 열 지정`}>
   <header><h3>열 지정 · {candidate.sourceName}</h3><button type="button" onClick={cancel}>열 지정 닫기</button></header>
   <label>머리글 행<select aria-label="머리글 행 선택" value={header} onChange={e=>{setHeader(Number(e.target.value));setMapping({});}}>{candidate.headerOptions.map(o=><option key={o.rowIndex} value={o.rowIndex}>{o.rowIndex+1}행: {o.headers.filter(Boolean).join(' | ')}</option>)}</select></label>
   <div className="purchase-mapping-preview"><table><tbody>{candidate.rows.slice(header,header+5).map((row,i)=><tr key={i}>{option.headers.map((_,j)=><td key={j}>{row[j]??''}</td>)}</tr>)}</tbody></table></div>
   <div className="purchase-mapping-fields">{purchaseImportFieldIds.map(field=><label key={field}>{purchaseImportFieldLabels[field]}{field==='name'?' *':''}<select aria-label={`${purchaseImportFieldLabels[field]}에 연결할 원본 열`} value={mapping[field]??''} onChange={e=>{const v=e.target.value;setMapping(current=>{const next={...current};if(v==='')delete next[field];else next[field]=Number(v);return next;});}}><option value="">사용 안 함</option>{option.headers.map((h,i)=><option key={i} value={i} disabled={Object.entries(mapping).some(([other,value])=>other!==field&&value===i)}>{h||`열 ${i+1}`}</option>)}</select></label>)}</div>
   <footer><button type="button" disabled={busy||mapping.name===undefined} onClick={()=>void map()}>{label} 열 연결 확인</button></footer>
  </section></div>}
  {selection&&!candidate&&<span role="group" aria-label={`${label} 적용 확인`}>{selection.result.items.length}개 {label} 품목 · <label>적용 방식<select aria-label={`${label} 적용 방식`} value={replace?'replace':'merge'} onChange={e=>setReplace(e.target.value==='replace')}><option value="merge">기존 품목에 추가</option><option value="replace">기존 품목 교체</option></select></label><button type="button" disabled={busy||!selection.result.items.length} onClick={apply}>{label} 품목 적용</button></span>}
 </>;
}
