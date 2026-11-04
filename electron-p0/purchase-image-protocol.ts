// Temporary, review-only OCR DTOs. No local paths, executable names or credentials cross IPC.
export const IMAGE_IMPORT_LIMITS = {files:10,bytes:10*1024*1024,pixels:12_000_000,dimension:8192,minWidth:256,minHeight:128,batchBytes:100*1024*1024,reviewRows:200,timeoutMs:60_000,batchMs:240_000} as const;
export type ImageSource = {readonly id:string;readonly order:number;readonly name:string;readonly width:number;readonly height:number;readonly thumbnail:string;readonly sha256:string;readonly warning:string|null};
export type ImageSelection = {readonly token:string;readonly sources:readonly ImageSource[]};
export type OcrLine = {readonly text:string;readonly confidence:number;readonly box:readonly [number,number,number,number]};
export type ImageOcrResult = {readonly sourceId:string;readonly status:'success'|'error';readonly lines:readonly OcrLine[];readonly message:string|null};
export type ImageAnalysis = {readonly token:string;readonly results:readonly ImageOcrResult[]};
export type ImageImportApi = Readonly<{
 pick():Promise<import('./protocol.js').IpcResult<ImageSelection|null>>;
 analyze(request:{readonly token:string}):Promise<import('./protocol.js').IpcResult<ImageAnalysis|null>>;
 cancel():Promise<import('./protocol.js').IpcResult<null>>;
}>;
