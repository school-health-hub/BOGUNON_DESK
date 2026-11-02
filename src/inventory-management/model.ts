export type InventoryMovementKind='receive'|'use'|'dispose';
export type InventoryItem=Readonly<{itemId:string;name:string;baseUnit:string;recommendedStock:number}>;
export type InventoryLot=Readonly<{lotId:string;itemId:string;balance:number;expirationDate:string;status:'usable'|'quarantined'}>;
export type InventoryMovement=Readonly<{movementId:string;kind:InventoryMovementKind;itemId:string;quantity:number;reason:string;createdAt:string;expirationDate?:string}>;
export type InventoryDocument=Readonly<{version:1;updatedAt:string;items:readonly InventoryItem[];lots:readonly InventoryLot[];movements:readonly InventoryMovement[]}>;
export type InventoryFilterState='all'|'shortage'|'expiring'|'expired';
export type InventoryRow=InventoryItem&Readonly<{availableStock:number;totalStock:number;shortage:boolean;expiring:boolean;expired:boolean}>;
export type InventoryMovementInput=Readonly<{kind:InventoryMovementKind;itemId:string;quantity:number;reason:string;expirationDate?:string}>;

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
export function applyInventoryMovement(document:InventoryDocument,input:InventoryMovementInput,createdAt:string):InventoryDocument{
 if(!document.items.some(item=>item.itemId===input.itemId)||!Number.isInteger(input.quantity)||input.quantity<=0||!input.reason.trim())throw Error('유효한 재고 기록이 필요합니다.');
 const asOf=createdAt.slice(0,10);if(input.kind!=='receive'&&stock(document,input.itemId,asOf).available<input.quantity)throw Error('사용 가능한 재고가 부족합니다.');
 let lots=document.lots.map(lot=>({...lot}));
 if(input.kind==='receive'){
  if(!input.expirationDate||input.expirationDate<asOf)throw Error('유효한 유효기간이 필요합니다.');
  lots=[...lots,{lotId:`lot-${input.itemId}-${document.movements.length+1}`,itemId:input.itemId,balance:input.quantity,expirationDate:input.expirationDate,status:'usable' as const}];
 }else{
  let remaining=input.quantity;lots=lots.sort((a,b)=>a.expirationDate.localeCompare(b.expirationDate)).map(lot=>{if(remaining===0||lot.itemId!==input.itemId||lot.status!=='usable'||lot.expirationDate<asOf)return lot;const take=Math.min(lot.balance,remaining);remaining-=take;return {...lot,balance:lot.balance-take};});
 }
 const movement:InventoryMovement={movementId:`movement-${document.movements.length+1}`,kind:input.kind,itemId:input.itemId,quantity:input.quantity,reason:input.reason.trim(),createdAt,...(input.expirationDate?{expirationDate:input.expirationDate}:{})};
 return {...document,updatedAt:createdAt,lots,movements:[...document.movements,movement]};
}
