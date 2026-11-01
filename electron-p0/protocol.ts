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
export type IpcErrorCode = 'FORBIDDEN' | 'INVALID_INPUT' | 'INTERNAL_ERROR';
export type IpcResult<T> = Readonly<{ok:true;data:T}> | Readonly<{ok:false;error:Readonly<{code:IpcErrorCode;message:string;retryable:boolean}>}>;
export interface WorkBridge {
 readonly sample: Readonly<{summarize(request:SyntheticSummaryRequest):Promise<IpcResult<SyntheticSummary>>}>;
}
