import type {LocalEventsBridge} from './local-events.js';
import type {AdminBridge} from './admin-protocol.js';
import type {FinanceBridge} from './finance-protocol.js';
import type {LocalTaskDocument,LocalTaskLoad} from './local-tasks.js';
import type {InventoryQaApi} from './inventory-qa-protocol.js';
export const NEWSLETTER_COMPATIBILITY_MESSAGE='이 프로젝트는 현재 버전에서 지원하지 않는 편집 요소를 포함하고 있습니다. 데이터 손실을 방지하기 위해 열기와 저장을 중단했습니다. 최신 버전에서 다시 열어 주세요.';
import type { PurchaseItem,PurchaseOutputColumnId,PurchaseSettlement } from './renderer/purchase/purchase/types.js';
import type { PurchaseAnalysisResult, PurchaseColumnMapping } from './renderer/purchase/purchase/types.js';
export const APP_ID = 'kr.sungandi.schoolhealthdesk.electronp0';
export const PRODUCT_NAME = 'BOGUNON DESK';
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
export type InventoryDocument=Readonly<{version:1;updatedAt:string;items:readonly Readonly<{itemId:string;name:string;baseUnit:string;recommendedStock:number}>[];lots:readonly Readonly<{lotId:string;itemId:string;balance:number;expirationDate:string;status:'usable'|'quarantined'}>[];movements:readonly Readonly<{movementId:string;kind:'receive'|'use'|'dispose';itemId:string;quantity:number;reason:string;createdAt:string;expirationDate?:string}>[]}>;
export type PurchaseCsvSelection=Readonly<{generation:number;result:PurchaseAnalysisResult}>;
export type PurchaseCsvMappingRequest=Readonly<{generation:number;candidateId:string;headerRow:number;mapping:PurchaseColumnMapping}>;
export type SettlementRequest=Readonly<{items:readonly PurchaseItem[];settlement:PurchaseSettlement}>;
export type EdufineRequest=Readonly<{items:readonly PurchaseItem[]}>;
export type PurchaseTable=Readonly<{headers:readonly string[];rows:readonly (readonly (string|number|null)[])[];summaryRows?:readonly (readonly (string|number)[])[]}>;
export type PurchaseExportRequest=Readonly<{format:'csv'|'xlsx';items:readonly PurchaseItem[];columns:readonly PurchaseOutputColumnId[]}>;
export type PurchaseExportResult=Readonly<{status:'saved';fileName:string}|{status:'canceled'}>;
export type PurchaseClipboardRequest=Readonly<{text:string;html:string}>;
export type OfficialDocumentSave=Readonly<{title:string;body:string;attachments:string;hasTableText:boolean}>;
export type OfficialDocumentImported=Readonly<{sourceName:string;format:"pdf"|"hwpx"|"odt";text:string}>;
export type InventoryQaStatus = { mode: "local-qa"; authGateway: "reachable" | "unavailable"; inventoryConnection: "blocked"; persisted: false };
export interface WorkBridge {
 readonly account?:import('./account-protocol.js').AccountBridge;
 readonly fileDrop?:import('./file-drop-protocol.js').FileDropBridge;
 readonly workFolders?:import('./work-folders-protocol.js').WorkFoldersBridge;
 readonly memoLinks?:Readonly<{open(request:Readonly<{url:string}>):Promise<IpcResult<null>>}>;
 readonly recordHelper?:import('./record-helper-protocol.js').RecordHelperBridge;
 readonly chatgpt?:import('./chatgpt-protocol.js').ChatGptBridge;
  readonly school?: import('./school-protocol.js').SchoolBridge;
 readonly admin?:AdminBridge;
 readonly finance?:FinanceBridge;
 readonly ai?:AiBridge;
 readonly events?:LocalEventsBridge;
 readonly tasks:Readonly<{load():Promise<IpcResult<LocalTaskLoad>>;save(document:LocalTaskDocument,expectedRevision:number):Promise<IpcResult<LocalTaskLoad>>}>;
  inventoryLocalQa?: { status: () => Promise<IpcResult<InventoryQaStatus>>; business?: InventoryQaApi };
 readonly officialDocument:Readonly<{pick():Promise<IpcResult<OfficialDocumentImported|null>>;save(document:OfficialDocumentSave):Promise<IpcResult<{fileName:string}|null>>;cancel():Promise<IpcResult<null>>}>;
 readonly educationVideo:EducationVideoBridge;
 readonly inventory:Readonly<{load():Promise<IpcResult<Readonly<{document:InventoryDocument|null;recovered:boolean}>>>;save(document:InventoryDocument,expectedUpdatedAt?:string|null):Promise<IpcResult<Readonly<{document:InventoryDocument;recovered:boolean}>>>}>;
 readonly purchase:Readonly<{readonly settings?:import('./purchase-settings-protocol.js').PurchaseSettingsBridge;readonly images:import("./purchase-image-protocol.js").ImageImportApi;previewSettlement(request:SettlementRequest):Promise<IpcResult<PurchaseTable>>;exportSettlement(request:SettlementRequest):Promise<IpcResult<PurchaseExportResult>>;previewEdufine(request:EdufineRequest):Promise<IpcResult<PurchaseTable>>;exportEdufine(request:EdufineRequest):Promise<IpcResult<PurchaseExportResult>>;exportItems(request:PurchaseExportRequest):Promise<IpcResult<PurchaseExportResult>>;pickPdf():Promise<IpcResult<PurchaseCsvSelection|null>>;cancelPdf():Promise<IpcResult<null>>;mapPdf(request:PurchaseCsvMappingRequest):Promise<IpcResult<PurchaseCsvSelection>>;pickExcel():Promise<IpcResult<PurchaseCsvSelection|null>>;cancelExcel():Promise<IpcResult<null>>;mapExcel(request:PurchaseCsvMappingRequest):Promise<IpcResult<PurchaseCsvSelection>>;pickCsv():Promise<IpcResult<PurchaseCsvSelection|null>>;cancelCsv():Promise<IpcResult<null>>;mapCsv(request:PurchaseCsvMappingRequest):Promise<IpcResult<PurchaseCsvSelection>>;copy(request:PurchaseClipboardRequest):Promise<IpcResult<null>>}>;
 readonly newsletter:Readonly<{projects:NewsletterProjectsBridge;exportOutput(request:NewsletterExportRequest):Promise<IpcResult<NewsletterExportResult>>;saveJson(request:Readonly<{json:string}>):Promise<IpcResult<NewsletterSaveResult>>}>;
 readonly memo: Readonly<MemoBridge>;
 readonly sample: Readonly<{summarize(request:SyntheticSummaryRequest):Promise<IpcResult<SyntheticSummary>>}>;
}

export type EducationVideoLibraryItem=Readonly<{videoId:string;title:string;channelId:string;channelTitle:string;durationSeconds:number;url:string;source:'mock'|'youtube';educationTitle:string;target:string;schedule:string;instructions:string;message:string;notes:string}>;
export type EducationVideoLibrary=Readonly<{version:1;items:readonly EducationVideoLibraryItem[]}>;
export type EducationVideoLibraryLoad=Readonly<{library:EducationVideoLibrary;recovered:boolean}>;
export type EducationVideoFileExportResult=Readonly<{status:'saved';fileName:string}|{status:'canceled'}>;
export interface EducationVideoBridge {
 readonly compat?:import('./finder-v2-protocol.js').FinderCompatBridge;
 readonly searchProvider?:import('./finder-search-protocol.js').FinderSearchBridge;
 load():Promise<IpcResult<EducationVideoLibraryLoad>>;
 save(item:EducationVideoLibraryItem):Promise<IpcResult<EducationVideoLibraryLoad>>;
 import(json:string):Promise<IpcResult<EducationVideoLibraryLoad>>;
 export():Promise<IpcResult<string>>;
 exportFile():Promise<IpcResult<EducationVideoFileExportResult>>;
 recover():Promise<IpcResult<EducationVideoLibraryLoad>>;
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

// API connection contracts selectively reused from src/ai/types.ts; secrets stay in Main.
export type AiProvider='openai'|'gemini';
export type AiTool='official-document'|'newsletter'|'finder';
export type AiModel=Readonly<{id:string;label:string}>;
export type AiStatus=Readonly<{connected:boolean;provider:AiProvider|null;model:string|null;models:readonly AiModel[];stored:boolean;secureStorage:boolean;busy:boolean;chatGptSupported:boolean}>;
export type AiConnect=Readonly<{provider:AiProvider;remember:boolean}>;
export type AiRequest=Readonly<{tool:AiTool;prompt:string}>;
export type AiBridge=Readonly<{
 status():Promise<IpcResult<AiStatus>>;
 connectFromClipboard(input:AiConnect):Promise<IpcResult<AiStatus|null>>;
 restore():Promise<IpcResult<AiStatus>>;
 selectModel(input:Readonly<{model:string}>):Promise<IpcResult<AiStatus>>;
 disconnect():Promise<IpcResult<AiStatus>>;
 cancel():Promise<IpcResult<null>>;
 generate(input:AiRequest):Promise<IpcResult<Readonly<{text:string}>|null>>;
}>;
