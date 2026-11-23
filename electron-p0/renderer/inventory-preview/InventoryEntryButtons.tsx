import {Package,FlaskConical} from 'lucide-react';
import {ToolCard} from '../ToolCard';
export type InventoryMode='local'|'preview';
export function InventoryEntryButtons({onSelect}:{readonly onSelect:(mode:InventoryMode)=>void}){
 return <><ToolCard icon={Package} label="물품관리 — 이 PC에 저장" description="물품과 재고를 관리하고 백업합니다" onClick={()=>onSelect('local')}/><ToolCard icon={FlaskConical} label="물품관리 — 체험하기" description="실제 자료를 저장하지 않는 예시 화면" onClick={()=>onSelect('preview')}/></>;
}
