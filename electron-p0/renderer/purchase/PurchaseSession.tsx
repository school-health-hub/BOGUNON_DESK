import {usePurchaseSettings} from './usePurchaseSettings';
import {inventoryPurchaseItems,type InventoryPurchaseRequest} from './inventoryPurchase';
import {reconcilePurchaseSettlement} from './purchase/purchaseSettlement';
import {PurchaseImageImport} from './PurchaseImageImport';
import { PurchaseImportControls } from './PurchaseImportControls';
import { useEffect, useRef, useState } from 'react';
import { PurchaseHelperPanel } from './components/desktop/PurchaseHelperPanel';
import { usePurchaseItemEditing } from './purchase/usePurchaseItemEditing';
import { createEmptyPurchaseItem, appendPurchaseItemsWithSessionIds } from './purchase/purchaseDomain';
import { defaultPurchaseOutputColumns, type PurchaseDraft, type PurchaseSettlement } from './purchase/types';
import './source.css';
// Settings persist independently from session-only items/draft/settlement. No Tauri migration or account access.
export function PurchaseSession({open,onClose,incoming,onIncomingApplied}:{readonly open:boolean;readonly onClose:()=>void;readonly incoming?:InventoryPurchaseRequest|null;readonly onIncomingApplied?:(id:string)=>void}) {
 const [format,setFormat]=useState<'csv'|'excel'|'pdf'>('csv');
 const [editing,onEdit]=usePurchaseItemEditing(open);
 const sequence=useRef(0);
 const settings=usePurchaseSettings();
 const columns=settings.document?.outputColumns??defaultPurchaseOutputColumns;
 const draftTemplates=settings.document?.draftTemplates??[];
 const importTemplates=settings.document?.importTemplates??[];
 const settingsBusy=!settings.ready||settings.busy;
 const [draft,onDraftChange]=useState<PurchaseDraft|null>(null);

 const [settlement,setSettlement]=useState<PurchaseSettlement|null>(null);
 useEffect(()=>{if(settlement!==null){const next=reconcilePurchaseSettlement(settlement,editing.items);if(next!==settlement)setSettlement(next);}},[settlement,editing.items]);
 const [notice,setNotice]=useState('');
 const received=useRef(new Set<string>());
 useEffect(()=>{if(!open||!incoming||received.current.has(incoming.id))return;
  received.current.add(incoming.id);
  try{const items=inventoryPurchaseItems(incoming.lines,()=>`electron-session-${sequence.current++}`);onEdit({type:'append',items});setNotice(`물품관리에서 ${items.length}개 구매 품목을 추가했습니다. 단가를 입력해 주세요. 재고는 변경되지 않았습니다.`);}
  catch{setNotice('구매 품목을 전달하지 못했습니다. 기존 Purchase 품목은 유지됩니다. 물품관리에서 수량과 규격을 확인해 주세요.');}
  onIncomingApplied?.(incoming.id);
 },[open,incoming,onEdit,onIncomingApplied]);
 return <div hidden={!open} inert={!open} style={{display:open?undefined:'none'}}>

  {open&&<PurchaseHelperPanel settingsStatus={<div className="purchase-import-templates" aria-label="Purchase 설정 상태" style={{flexShrink:0}}><p role="status">{settings.busy?'Purchase 설정 처리 중…':settings.message||'Purchase 설정 저장 연결이 없습니다. 품목·원고는 세션에서 계속 편집할 수 있습니다.'}</p><button type="button" disabled={settings.busy} onClick={()=>void settings.load()}>Purchase 설정 다시 불러오기</button></div>} settingsBusy={settingsBusy} importSettings={settings.ready?<section className="purchase-import-templates" aria-label="저장된 가져오기 설정" style={{maxHeight:'min(200px, 25dvh)',overflowY:'auto',flexShrink:0}}><strong>저장된 열 설정</strong>{importTemplates.length?importTemplates.map(t=><div key={t.id}><span>{t.name} · {Object.keys(t.mapping).length}개 열 연결</span><button type="button" disabled={settingsBusy} aria-label={`${t.name} 열 설정 삭제`} onClick={()=>{if(window.confirm(`'${t.name}' 열 설정을 삭제할까요? 현재 품목은 변경하지 않습니다.`))void settings.save({importTemplates:importTemplates.filter(x=>x.id!==t.id)});}}>삭제</button></div>):<p>저장된 설정이 없습니다. CSV/Excel 열 지정에서 저장할 수 있습니다.</p>}<button type="button" disabled={settingsBusy} onClick={()=>{if(window.confirm('Purchase 템플릿과 출력 열 설정을 초기화할까요? 현재 품목·품의 원고·정산은 유지됩니다.'))void settings.save({draftTemplates:[],importTemplates:[],outputColumns:defaultPurchaseOutputColumns});}}>Purchase 설정 초기화</button></section>:undefined} settlement={settlement} onSettlementChange={setSettlement} editing={editing} columns={columns} draft={draft} draftTemplates={draftTemplates}
   fileControls={<><label>가져오기 형식<select aria-label="가져오기 형식" value={format} onChange={e=>setFormat(e.target.value as "csv"|"excel"|"pdf")}><option value="csv">CSV</option><option value="excel">XLSX/XLS</option><option value="pdf">텍스트 PDF</option></select></label><PurchaseImportControls key={format} format={format} templates={importTemplates} settingsBusy={settingsBusy} onTemplatesChange={templates=>settings.save({importTemplates:templates})} items={editing.items} onNotice={setNotice} onApply={(items,replace)=>{const incoming=appendPurchaseItemsWithSessionIds([],items,()=>`electron-session-${sequence.current++}`);onEdit({type:replace?'replace':'append',items:incoming});if(replace){onDraftChange(null);setSettlement(null);}}}/><PurchaseImageImport items={editing.items} onNotice={setNotice} onApply={(items,replace)=>{const incoming=appendPurchaseItemsWithSessionIds([],items,()=>`electron-session-${sequence.current++}`);onEdit({type:replace?'replace':'append',items:incoming});if(replace){onDraftChange(null);setSettlement(null);}}}/></>}
   onAddItem={()=>onEdit({type:'append',items:[createEmptyPurchaseItem(`electron-session-${sequence.current++}`)]})}
   onEdit={onEdit} onColumnsChange={outputColumns=>settings.save({outputColumns})} onDraftChange={onDraftChange} onDraftTemplatesChange={draftTemplates=>settings.save({draftTemplates})}
   onClose={onClose} onNotice={setNotice}/>}
  {open&&notice&&<div className="p0-notice" role="status">{notice}<button type="button" onClick={()=>setNotice('')}>닫기</button></div>}
 </div>;
}
