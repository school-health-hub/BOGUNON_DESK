// Main-owned personal assets/files; no paths or arbitrary bytes accepted from Renderer.
export interface HealthSupportWorkLogImportPreview {error?:string;rows:{sourceRow:number;instructorId:string;date:string;startTime:string;endTime:string;note:string|null;status:'ready'|'invalid'|'duplicateExisting'|'duplicateInFile';selected:boolean;reason?:string}[]}
export interface StampView {dataUrl:string;width:number;height:number}
export interface InstructorFilesRequest {school:string;month:string;version:number;kind?:'attendance'|'payment'|'detail';includeStamp?:boolean}
export type FileResult<T>={ok:true;status:'ready'|'saved'|'canceled';data?:T}|{ok:false;message:string};
export interface InstructorFilesApi {
 stampRead(input:InstructorFilesRequest):Promise<FileResult<StampView|null>>;
 stampPick(input:InstructorFilesRequest):Promise<FileResult<StampView>>;
 stampRemove(input:InstructorFilesRequest):Promise<FileResult<null>>;
 workbookPick(input:InstructorFilesRequest):Promise<FileResult<HealthSupportWorkLogImportPreview>>;
 workbookSave(input:InstructorFilesRequest):Promise<FileResult<null>>;
 print(input:InstructorFilesRequest):Promise<FileResult<null>>;
}
