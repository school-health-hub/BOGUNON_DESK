import { useRef, useState } from 'react';
import { PurchaseHelperPanel } from './components/desktop/PurchaseHelperPanel';
import { usePurchaseItemEditing } from './purchase/usePurchaseItemEditing';
import { createEmptyPurchaseItem } from './purchase/purchaseDomain';
import { defaultPurchaseOutputColumns, type PurchaseDraft, type PurchaseDraftTemplate } from './purchase/types';
import './source.css';
// No account settings, file repository, storage, migration, or auth dependency.
export function PurchaseSession({open,onClose}:{readonly open:boolean;readonly onClose:()=>void}) {
 const [editing,onEdit]=usePurchaseItemEditing(open);
 const sequence=useRef(0);
 const [columns,onColumnsChange]=useState(defaultPurchaseOutputColumns);
 const [draft,onDraftChange]=useState<PurchaseDraft|null>(null);
 const [draftTemplates,onDraftTemplatesChange]=useState<readonly PurchaseDraftTemplate[]>([]);
 const [notice,setNotice]=useState('');
 return <div hidden={!open} inert={!open} style={{display:open?undefined:'none'}}>
  {open&&<PurchaseHelperPanel editing={editing} columns={columns} draft={draft} draftTemplates={draftTemplates}
   onAddItem={()=>onEdit({type:'append',items:[createEmptyPurchaseItem(`electron-session-${sequence.current++}`)]})}
   onEdit={onEdit} onColumnsChange={onColumnsChange} onDraftChange={onDraftChange} onDraftTemplatesChange={onDraftTemplatesChange}
   onClose={onClose} onNotice={setNotice}/>}
  {open&&notice&&<div className="p0-notice" role="status">{notice}<button type="button" onClick={()=>setNotice('')}>닫기</button></div>}
 </div>;
}
