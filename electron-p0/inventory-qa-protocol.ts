import type {AuthState,ErrorCode,Item,ItemDetail,Movement,NewItem,PurchaseBatch,PurchaseProgress,RpcInputs,RpcName,RpcOutput} from './main/inventory-connection/contracts.js';
export type InventoryQaResult<T>={ok:true;data:{contextRevision:number;value:T}}|{ok:false;error:{contextRevision:number;code:ErrorCode;serverCode?:string;outcomeUnknown:boolean;retryable:boolean;message:string}};
export type QaContext={contextRevision:number};
export type QaHandle={handleId:string;requestUuid:string};
export type QaMutation={persisted:true;data:RpcOutput<RpcName>;refreshRequired:true};
export interface InventoryQaApi {
 login(input:{email:string;password:string}):Promise<InventoryQaResult<AuthState>>;
 logout():Promise<InventoryQaResult<AuthState>>;
 authState():Promise<InventoryQaResult<AuthState>>;
 dispose():Promise<InventoryQaResult<null>>;
 selectSchool(input:QaContext&{schoolId:string}):Promise<InventoryQaResult<AuthState>>;
 listItems(input:QaContext):Promise<InventoryQaResult<Item[]>>;
 itemDetail(input:QaContext&{itemId:string}):Promise<InventoryQaResult<ItemDetail>>;
 movements(input:QaContext&{itemId?:string}):Promise<InventoryQaResult<Movement[]>>;
 purchaseBatches(input:QaContext):Promise<InventoryQaResult<PurchaseBatch[]>>;
 purchaseProgress(input:QaContext&{batchId:string}):Promise<InventoryQaResult<PurchaseProgress>>;
 registerItem(input:QaContext&{item:NewItem}):Promise<InventoryQaResult<{persisted:true;item:Item;refreshRequired:true}>>;
 prepare(input:QaContext&{operation:RpcName;input:RpcInputs[RpcName]}):Promise<InventoryQaResult<QaHandle>>;
 execute(input:QaContext&{handleId:string}):Promise<InventoryQaResult<QaMutation>>;
 discard(input:QaContext&{handleId:string}):Promise<InventoryQaResult<null>>;
}
export const INVENTORY_QA_ACTIONS=['login','logout','authState','dispose','selectSchool','listItems','itemDetail','movements','purchaseBatches','purchaseProgress','registerItem','prepare','execute','discard'] as const;
