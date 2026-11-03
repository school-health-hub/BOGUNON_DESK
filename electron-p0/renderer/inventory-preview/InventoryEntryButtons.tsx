import {Package,FlaskConical} from 'lucide-react';
import {ToolCard} from '../ToolCard';
export type InventoryMode='local'|'preview';
export function InventoryEntryButtons({onSelect}:{readonly onSelect:(mode:InventoryMode)=>void}){
 return <><ToolCard icon={Package} label="물품관리 — 로컬 저장" description="기존 JSON 재고와 백업 관리" onClick={()=>onSelect('local')}/><ToolCard icon={FlaskConical} label="물품관리 — 미리보기" description="저장·DB 연결 없는 합성 데이터 체험" onClick={()=>onSelect('preview')}/></>;
}
