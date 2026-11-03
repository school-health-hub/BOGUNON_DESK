import type {InventoryPurchaseLine} from '../../../src/inventory-management/model';
import {lazy,Suspense,useMemo} from 'react';
const InventoryWorkspace=lazy(()=>import('../../../src/inventory-management/InventoryWorkspace').then(m=>({default:m.InventoryWorkspace})));
const InventoryManagementPanel=lazy(()=>import('./source/InventoryManagementPanel').then(m=>({default:m.InventoryManagementPanel})));
import {createSyntheticInventoryAdapter} from './source/syntheticAdapter';
import './preview.css';
import type {InventoryMode} from './InventoryEntryButtons';
export function InventoryHost({mode,onModeChange,onClose,onPurchase}:{readonly mode:InventoryMode;readonly onModeChange:(mode:InventoryMode)=>void;readonly onClose:()=>void;readonly onPurchase?:(lines:readonly InventoryPurchaseLine[])=>void}){
 // This adapter has no host/IPC/configuration/token dependency and never persists.
 const adapter=useMemo(()=>createSyntheticInventoryAdapter(),[]);
 return <Suspense fallback={<p role="status">물품관리 화면을 불러오는 중…</p>}>{mode==='local'?<section aria-label="물품관리 — 로컬 저장"><header className="inventory-local-mode"><strong>물품관리 — 로컬 저장</strong><span>Electron 전용 JSON 저장 · 서버 동기화 없음</span><button type="button" onClick={()=>{if(window.confirm('미리보기로 전환하면 저장하지 않은 입력을 닫습니다. 전환하시겠습니까?'))onModeChange('preview');}}>미리보기로</button></header><InventoryWorkspace onClose={onClose} onPurchase={onPurchase}/></section>
 :<section className="inventory-preview" aria-label="물품관리 — 미리보기" data-mode="preview_only" data-persisted="false"><InventoryManagementPanel adapter={adapter} onOpenLocal={()=>onModeChange('local')} onClose={onClose}/></section>}</Suspense>;
}
