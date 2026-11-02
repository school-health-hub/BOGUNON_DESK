export type InventoryMode='local'|'preview';
export function InventoryEntryButtons({onSelect}:{readonly onSelect:(mode:InventoryMode)=>void}){
 return <><button type="button" onClick={()=>onSelect('local')}>물품관리 — 로컬 저장</button><button type="button" onClick={()=>onSelect('preview')}>물품관리 — 미리보기</button></>;
}
