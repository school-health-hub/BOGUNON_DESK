import {parseLocalDate} from '../dashboard/dateSource';
import {formatWorkspaceDate} from '../workspace-data/workspaceDataAdapter';
export type InventoryMovementKind='receive'|'use'|'dispose';
export type InventoryItem=Readonly<{itemId:string;name:string;baseUnit:string;recommendedStock:number}>;
export type InventoryLot=Readonly<{lotId:string;itemId:string;balance:number;expirationDate:string;status:'usable'|'quarantined'}>;
export type InventoryMovement=Readonly<{movementId:string;kind:InventoryMovementKind;itemId:string;quantity:number;reason:string;createdAt:string;expirationDate?:string}>;
export type InventoryDocument=Readonly<{version:1;updatedAt:string;items:readonly InventoryItem[];lots:readonly InventoryLot[];movements:readonly InventoryMovement[]}>;
export type InventoryFilterState='all'|'shortage'|'expiring'|'expired';
export type InventoryRow=InventoryItem&Readonly<{availableStock:number;totalStock:number;shortage:boolean;expiring:boolean;expired:boolean}>;
export type InventoryMovementInput=Readonly<{kind:InventoryMovementKind;itemId:string;quantity:number;reason:string;expirationDate?:string;lotId?:string}>;

const days=(from:string,to:string)=>Math.floor((Date.parse(to)-Date.parse(from))/86_400_000);
const stock=(document:InventoryDocument,itemId:string,asOf:string)=>{
 const lots=document.lots.filter(lot=>lot.itemId===itemId),usable=lots.filter(lot=>lot.status==='usable'&&lot.expirationDate>=asOf);
 return {available:usable.reduce((sum,lot)=>sum+lot.balance,0),total:lots.reduce((sum,lot)=>sum+lot.balance,0),expired:lots.some(lot=>lot.balance>0&&lot.expirationDate<asOf),expiring:usable.some(lot=>lot.balance>0&&days(asOf,lot.expirationDate)<=30)};
};
export function createSyntheticInventory(asOf:string):InventoryDocument{return {version:1,updatedAt:`${asOf}T00:00:00.000Z`,items:[
 {itemId:'synthetic-bandage',name:'합성 탄력붕대',baseUnit:'개',recommendedStock:20},
 {itemId:'synthetic-gloves',name:'합성 니트릴 장갑',baseUnit:'쌍',recommendedStock:10},
 {itemId:'synthetic-sanitizer',name:'합성 손소독제',baseUnit:'병',recommendedStock:6},
],lots:[
 {lotId:'lot-bandage-usable',itemId:'synthetic-bandage',balance:8,expirationDate:'2027-05-31',status:'usable'},
 {lotId:'lot-bandage-expired',itemId:'synthetic-bandage',balance:2,expirationDate:'2026-10-01',status:'usable'},
 {lotId:'lot-gloves',itemId:'synthetic-gloves',balance:8,expirationDate:'2026-11-20',status:'usable'},
 {lotId:'lot-sanitizer',itemId:'synthetic-sanitizer',balance:9,expirationDate:'2027-08-31',status:'usable'},
],movements:[]};}
export function filterInventory(document:InventoryDocument,filter:Readonly<{query:string;state:InventoryFilterState}>,asOf:string):InventoryRow[]{
 const query=filter.query.trim().toLocaleLowerCase('ko-KR');
 return document.items.map(item=>{const value=stock(document,item.itemId,asOf);return {...item,availableStock:value.available,totalStock:value.total,shortage:value.available<item.recommendedStock,expiring:value.expiring,expired:value.expired};})
  .filter(row=>(!query||row.name.toLocaleLowerCase('ko-KR').includes(query))&&(filter.state==='all'||row[filter.state]));
}
export function inventorySummary(document:InventoryDocument,asOf:string){const rows=filterInventory(document,{query:'',state:'all'},asOf);return {items:rows.length,shortage:rows.filter(row=>row.shortage).length,expiring:rows.filter(row=>row.expiring).length,expired:rows.filter(row=>row.expired).length};}
export function purchaseCandidate(item:InventoryItem&Partial<Pick<InventoryRow,'availableStock'>>){return {inventoryItemId:item.itemId,name:item.name,baseUnit:item.baseUnit,requestedBaseQuantity:Math.max(0,item.recommendedStock-(item.availableStock??0)),stockEffect:'NONE' as const};}
export const createEmptyInventory=(now:string):InventoryDocument=>({version:1,updatedAt:now,items:[],lots:[],movements:[]});
export type InventoryPurchaseLine=Readonly<{inventoryItemId:string;name:string;specification:string;quantity:number}>;
export function upsertInventoryItem(document:InventoryDocument,item:InventoryItem,now:string):InventoryDocument{
 if(!item.itemId||!item.name.trim()||item.name.length>200||!item.baseUnit.trim()||item.baseUnit.length>30||!Number.isSafeInteger(item.recommendedStock)||item.recommendedStock<0)throw Error('물품명·기본 단위·권장 재고를 확인해 주세요.');
 const before=document.items.find(i=>i.itemId===item.itemId);
 if(before&&before.baseUnit!==item.baseUnit&&(document.lots.some(l=>l.itemId===item.itemId)||document.movements.some(m=>m.itemId===item.itemId)))throw Error('입출고 이력이 있는 물품의 기본 단위는 변경할 수 없습니다.');
 const next={itemId:item.itemId,name:item.name.trim(),baseUnit:item.baseUnit.trim(),recommendedStock:item.recommendedStock};return {...document,updatedAt:now,items:before?document.items.map(i=>i.itemId===item.itemId?next:i):[...document.items,next]};
}
export function removeInventoryItem(document:InventoryDocument,itemId:string,now:string):InventoryDocument{
 if(document.lots.some(l=>l.itemId===itemId)||document.movements.some(m=>m.itemId===itemId))throw Error('로트·변경 이력이 있는 물품은 삭제하지 않습니다. 재고는 폐기 기록으로 정리해 주세요.');
 return {...document,updatedAt:now,items:document.items.filter(i=>i.itemId!==itemId)};
}
const nextId=(prefix:string,existing:readonly string[])=>{let n=existing.length+1;while(existing.includes(`${prefix}${n}`))n++;return `${prefix}${n}`;};
export function applyInventoryMovement(document:InventoryDocument,input:InventoryMovementInput,createdAt:string):InventoryDocument{
 if(!document.items.some(item=>item.itemId===input.itemId)||!['receive','use','dispose'].includes(input.kind)||!Number.isSafeInteger(input.quantity)||input.quantity<=0||!input.reason.trim()||input.reason.length>500||Number.isNaN(Date.parse(createdAt)))throw Error('수량·사유를 확인해 주세요.');
 const asOf=formatWorkspaceDate(new Date(createdAt));
 const eligible=(lot:InventoryLot)=>lot.itemId===input.itemId&&(!input.lotId||lot.lotId===input.lotId)&&(input.kind==='dispose'||(lot.status==='usable'&&lot.expirationDate>=asOf));
 const available=document.lots.filter(eligible).reduce((sum,l)=>sum+l.balance,0);
 if(input.kind!=='receive'&&available<input.quantity)throw Error(input.kind==='use'?'사용 가능한 재고가 부족합니다.':'선택한 폐기 재고가 부족합니다.');
 let lots=document.lots.map(lot=>({...lot}));
 if(input.kind==='receive'){
  if(!input.expirationDate||!parseLocalDate(input.expirationDate)||input.expirationDate<asOf)throw Error('유효한 유효기간이 필요합니다.');
  const total=document.lots.filter(l=>l.itemId===input.itemId).reduce((sum,l)=>sum+l.balance,0);if(!Number.isSafeInteger(total+input.quantity))throw Error('재고 수량 한도를 초과했습니다.');
  lots=[...lots,{lotId:nextId(`lot-${input.itemId}-`,document.lots.map(l=>l.lotId)),itemId:input.itemId,balance:input.quantity,expirationDate:input.expirationDate,status:'usable' as const}];
 }else{
  let remaining=input.quantity;const deductions=new Map<string,number>();
  for(const lot of [...lots].filter(eligible).sort((a,b)=>a.expirationDate.localeCompare(b.expirationDate))){const take=Math.min(lot.balance,remaining);deductions.set(lot.lotId,take);remaining-=take;if(!remaining)break;}
  if(remaining)throw Error('재고 변경을 적용하지 못했습니다.');lots=lots.map(lot=>({...lot,balance:lot.balance-(deductions.get(lot.lotId)??0)}));
 }
 const selectedLot=input.lotId?document.lots.find(l=>l.lotId===input.lotId):undefined;
 const expirationDate=input.kind==='receive'?input.expirationDate:selectedLot?.expirationDate;
 const movement:InventoryMovement={movementId:nextId('movement-',document.movements.map(m=>m.movementId)),kind:input.kind,itemId:input.itemId,quantity:input.quantity,reason:input.reason.trim(),createdAt,...(expirationDate?{expirationDate}:{})};
 return {...document,updatedAt:createdAt,lots,movements:[...document.movements,movement]};
}
