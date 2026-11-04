import type {IpcResult} from './protocol.js';
export type RecordImportBatch=Readonly<{reports:readonly Readonly<{sourceName:string;format:'pdf'|'hwp'|'hwpx'|'docx';text:string}>[];failures:readonly Readonly<{sourceName:string;message:string}>[]}>;
export type RecordReviewedRequest=Readonly<{reportId:string;requestId:number;accountId:string;model:string;packet:Readonly<{reportText:string;teacherMemo:string}>;identityHints:readonly string[];approved:true}>;
export type RecordHelperBridge=Readonly<{
 pick():Promise<IpcResult<RecordImportBatch|null>>;
 cancelImport():Promise<IpcResult<null>>;
 generateReviewed(request:RecordReviewedRequest):Promise<IpcResult<Readonly<{text:string}>|null>>;
 cancelAi(request:Readonly<{reportId:string}>):Promise<IpcResult<null>>;
 clear():Promise<IpcResult<null>>;
}>;
