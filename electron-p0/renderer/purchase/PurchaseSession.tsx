import {reconcilePurchaseSettlement} from './purchase/purchaseSettlement';
import { PurchaseImportControls } from './PurchaseImportControls';
import { useEffect, useRef, useState } from 'react';
import { PurchaseHelperPanel } from './components/desktop/PurchaseHelperPanel';
import { usePurchaseItemEditing } from './purchase/usePurchaseItemEditing';
import { createEmptyPurchaseItem, appendPurchaseItemsWithSessionIds } from './purchase/purchaseDomain';
import { defaultPurchaseOutputColumns, type PurchaseDraft, type PurchaseDraftTemplate, type PurchaseSettlement } from './purchase/types';
import './source.css';
// No account settings, file repository, storage, migration, or auth dependency.
export function PurchaseSession({open,onClose}:{readonly open:boolean;readonly onClose:()=>void}) {
 const [format,setFormat]=useState<'csv'|'excel'|'pdf'>('csv');
 const [editing,onEdit]=usePurchaseItemEditing(open);
 const sequence=useRef(0);
 const [columns,onColumnsChange]=useState(defaultPurchaseOutputColumns);
 const [draft,onDraftChange]=useState<PurchaseDraft|null>(null);
 const [draftTemplates,onDraftTemplatesChange]=useState<readonly PurchaseDraftTemplate[]>([]);
 const [settlement,setSettlement]=useState<PurchaseSettlement|null>(null);
 useEffect(()=>{if(settlement!==null){const next=reconcilePurchaseSettlement(settlement,editing.items);if(next!==settlement)setSettlement(next);}},[settlement,editing.items]);
 const [notice,setNotice]=useState('');
 return <div hidden={!open} inert={!open} style={{display:open?undefined:'none'}}>
  {open&&<PurchaseHelperPanel settlement={settlement} onSettlementChange={setSettlement} editing={editing} columns={columns} draft={draft} draftTemplates={draftTemplates}
   fileControls={<><label>가져오기 형식<select aria-label="가져오기 형식" value={format} onChange={e=>setFormat(e.target.value as "csv"|"excel"|"pdf")}><option value="csv">CSV</option><option value="excel">XLSX/XLS</option><option value="pdf">텍스트 PDF</option></select></label><PurchaseImportControls key={format} format={format} items={editing.items} onNotice={setNotice} onApply={(items,replace)=>{const incoming=appendPurchaseItemsWithSessionIds([],items,()=>`electron-session-${sequence.current++}`);onEdit({type:replace?'replace':'append',items:incoming});if(replace){onDraftChange(null);setSettlement(null);}}}/></>}
   onAddItem={()=>onEdit({type:'append',items:[createEmptyPurchaseItem(`electron-session-${sequence.current++}`)]})}
   onEdit={onEdit} onColumnsChange={onColumnsChange} onDraftChange={onDraftChange} onDraftTemplatesChange={onDraftTemplatesChange}
   onClose={onClose} onNotice={setNotice}/>}
  {open&&notice&&<div className="p0-notice" role="status">{notice}<button type="button" onClick={()=>setNotice('')}>닫기</button></div>}
 </div>;
}
