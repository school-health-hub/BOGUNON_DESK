import type { PurchaseItem,PurchaseOutputColumnId } from './renderer/purchase/purchase/types.js';
import type { PurchaseAnalysisResult, PurchaseColumnMapping } from './renderer/purchase/purchase/types.js';
export const APP_ID = 'kr.sungandi.schoolhealthdesk.electronp0';
export const PRODUCT_NAME = 'BOGUNON DESK ELECTRON P0';
export const PROFILE_NAME = 'BOGUNON-DESK-ELECTRON-P0';
export type P0Settings = Readonly<{ version: 1; dashboard: unknown; dock: unknown }>;
export type P0Info = Readonly<{ appId: string; productName: string; userData: string; sourceSha: string; electron: string }>;
export interface P0Bridge {
  info(): Promise<P0Info>;
  readSettings(): Promise<P0Settings | null>;
  writeSettings(settings: P0Settings): Promise<void>;
}

// Feature contracts are explicit; no channel or filesystem path is accepted from renderer.
export type SyntheticTaskId = 'prepare' | 'review' | 'finish';
export type SyntheticSummaryRequest = Readonly<{fixture:'synthetic-only';completed:readonly SyntheticTaskId[]}>;
export type SyntheticSummary = Readonly<{fixture:'synthetic-only';total:3;completedCount:number;pending:readonly SyntheticTaskId[]}>;
export type IpcErrorCode = 'FORBIDDEN' | 'INVALID_INPUT' | 'INTERNAL_ERROR' | 'STORAGE_ERROR' | 'CONFLICT';
export type IpcResult<T> = Readonly<{ok:true;data:T}> | Readonly<{ok:false;error:Readonly<{code:IpcErrorCode;message:string;retryable:boolean}>}>;
export type PurchaseCsvSelection=Readonly<{generation:number;result:PurchaseAnalysisResult}>;
export type PurchaseCsvMappingRequest=Readonly<{generation:number;candidateId:string;headerRow:number;mapping:PurchaseColumnMapping}>;
export type PurchaseExportRequest=Readonly<{format:'csv'|'xlsx';items:readonly PurchaseItem[];columns:readonly PurchaseOutputColumnId[]}>;
export type PurchaseExportResult=Readonly<{status:'saved';fileName:string}|{status:'canceled'}>;
export type PurchaseClipboardRequest=Readonly<{text:string;html:string}>;
export interface WorkBridge {
 readonly purchase:Readonly<{exportItems(request:PurchaseExportRequest):Promise<IpcResult<PurchaseExportResult>>;pickPdf():Promise<IpcResult<PurchaseCsvSelection|null>>;cancelPdf():Promise<IpcResult<null>>;mapPdf(request:PurchaseCsvMappingRequest):Promise<IpcResult<PurchaseCsvSelection>>;pickExcel():Promise<IpcResult<PurchaseCsvSelection|null>>;cancelExcel():Promise<IpcResult<null>>;mapExcel(request:PurchaseCsvMappingRequest):Promise<IpcResult<PurchaseCsvSelection>>;pickCsv():Promise<IpcResult<PurchaseCsvSelection|null>>;cancelCsv():Promise<IpcResult<null>>;mapCsv(request:PurchaseCsvMappingRequest):Promise<IpcResult<PurchaseCsvSelection>>;copy(request:PurchaseClipboardRequest):Promise<IpcResult<null>>}>;
 readonly newsletter:Readonly<{projects:NewsletterProjectsBridge;exportOutput(request:NewsletterExportRequest):Promise<IpcResult<NewsletterExportResult>>;saveJson(request:Readonly<{json:string}>):Promise<IpcResult<NewsletterSaveResult>>}>;
 readonly memo: Readonly<MemoBridge>;
 readonly sample: Readonly<{summarize(request:SyntheticSummaryRequest):Promise<IpcResult<SyntheticSummary>>}>;
}

export type MemoDocument = Readonly<{version:1;text:string}>;
export interface MemoBridge {
 read():Promise<IpcResult<MemoDocument>>;
 write(document:MemoDocument):Promise<IpcResult<MemoDocument>>;
}

export type NewsletterSaveResult=Readonly<{saved:boolean;fileName?:string}>;

export type NewsletterExportSelection='a4-png'|'a4-pdf'|'card-pngs'|'cards-pdf';
export type NewsletterExportRequest=Readonly<{document:string;selection:NewsletterExportSelection;assets:readonly Readonly<{reference:string;bytesBase64:string}>[]}>;
export type NewsletterExportResult=Readonly<{saved:boolean;names?:readonly string[]}>;
export type GeneratedNewsletterFile=Readonly<{fileName:string;bytesBase64:string}>;
export type TrustedNewsletterOutput=Readonly<{summary:string;files:readonly GeneratedNewsletterFile[]}>;

export type NewsletterHead=Readonly<{projectId:string;revision:number;hash:string}>;
export type NewsletterProjectRecord=Readonly<{head:NewsletterHead;document:string}>;
export type NewsletterRevision=Readonly<{revision:number;hash:string;createdAt:string;restoredFrom?:number}>;
export type NewsletterPreview=Readonly<{token:string;head:NewsletterHead;revision:number;document:string}>;
export type NewsletterProjectsBridge=Readonly<{
 list():Promise<IpcResult<readonly string[]>>;
 load(request:Readonly<{projectId:string}>):Promise<IpcResult<NewsletterProjectRecord>>;
 save(request:Readonly<{document:string;expected:NewsletterHead}>):Promise<IpcResult<NewsletterProjectRecord>>;
 history(request:Readonly<{projectId:string}>):Promise<IpcResult<readonly NewsletterRevision[]>>;
 preview(request:Readonly<{projectId:string;revision:number}>):Promise<IpcResult<NewsletterPreview>>;
 restore(request:Readonly<{token:string;expected:NewsletterHead}>):Promise<IpcResult<Readonly<{restored:boolean;record?:NewsletterProjectRecord}>>>;
}>;
export type NewsletterApprovalBarrier=Readonly<{ids:readonly string[];hashes:readonly string[]}>;
