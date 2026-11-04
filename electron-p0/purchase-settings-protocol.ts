import type {PurchaseDraftTemplate,PurchaseImportTemplate,PurchaseOutputColumnId} from './renderer/purchase/purchase/types.js';
import type {IpcResult} from './protocol.js';
// Settings only: no item list, current draft, settlement, account, or filesystem path.
export type PurchaseSettingsDocument=Readonly<{
 version:1; revision:number;
 draftTemplates:readonly PurchaseDraftTemplate[];
 importTemplates:readonly PurchaseImportTemplate[];
 outputColumns:readonly PurchaseOutputColumnId[];
}>;
export type PurchaseSettingsLoad=Readonly<{document:PurchaseSettingsDocument;recovered:boolean}>;
export type PurchaseSettingsBridge=Readonly<{
 load():Promise<IpcResult<PurchaseSettingsLoad>>;
 save(document:PurchaseSettingsDocument,expectedRevision:number):Promise<IpcResult<PurchaseSettingsLoad>>;
}>;
