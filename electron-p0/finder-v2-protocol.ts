import type {EducationVideoLibrary,IpcResult,EducationVideoFileExportResult} from './protocol.js';
// Selectively reused from Tauri Finder 04ad2d2: libraryV2, aiVideo, candidateRecord, recommendationReason.
export type TeacherData=Readonly<{educationTitle:string;target:string;schedule:string;instructions:string;message:string;notes:string}>;
export type ProviderData=Readonly<{title:string;channelId:string;channelTitle:string;durationSeconds:number|null;url:string;source:'live'|'synthetic-mock';official:boolean;officialEvidence:string|null;synthetic:boolean;fetchedAt:string;expiresAt:string}>;
export type CandidateProvenance='web-search-verified'|'teacher-supplied'|'teacher-confirmed'|'unverified';
export type FactVerificationStatus='unverified'|'teacher-confirmed';
export type MetadataVerification=Readonly<{title:FactVerificationStatus;publisher:FactVerificationStatus;durationSeconds:FactVerificationStatus}>;
export type AiVideoCandidate=Readonly<{videoId:string;url:string;title:string;publisher:string|null;durationSeconds:number|null;description:string;relevance:string;reason:string;sources:readonly Readonly<{url:string;title:string}>[];checkedAt:string;needsReview:true;provenance:CandidateProvenance;metadataVerification:MetadataVerification}>;
export type AiMetadata=Omit<AiVideoCandidate,'provenance'|'metadataVerification'>&Partial<Pick<AiVideoCandidate,'provenance'|'metadataVerification'>>;
export type CandidateRecord=Readonly<{provenance:CandidateProvenance;title:string|null;publisher:string|null;durationSeconds:number|null;metadataVerification:MetadataVerification;savedAt:string}>;
export type RecommendationReason=Readonly<{status:'ai-generated'|'teacher-edited';text:string}|{status:'deleted'}>;
export type LibraryEntry=Readonly<{videoId:string;teacher:TeacherData;provider:ProviderData|null;ai?:AiMetadata|null;candidateRecord?:CandidateRecord|null;recommendationReason?:RecommendationReason|null}>;
export type LibraryV2=Readonly<{version:2;entries:readonly LibraryEntry[]}>;
export type V2Load=Readonly<{library:LibraryV2;fingerprint:string;recovered:boolean}>;
export type FinderImportPreview=Readonly<{token:string;version:1|2;total:number;rows:readonly Readonly<{videoId:string;title:string;conflict:boolean;hasAi:boolean;expiredMetadata:boolean}>[];warnings:readonly string[]}>;
export type FinderImportApply=Readonly<{token:string;selectedIds:readonly string[]}>;
export type FinderV2Edit=Readonly<{videoId:string;expectedFingerprint:string;teacher:TeacherData;candidateRecord?:CandidateRecord;recommendationReason?:RecommendationReason}>;
export type FinderImportResult=Readonly<{added:number;skipped:number;v1:EducationVideoLibrary;v2:V2Load}>;
export type FinderCompatBridge=Readonly<{
 loadV2():Promise<IpcResult<V2Load>>;
 prepareImport():Promise<IpcResult<FinderImportPreview|null>>;
 applyImport(request:FinderImportApply):Promise<IpcResult<FinderImportResult>>;
 discardImport():Promise<IpcResult<null>>;
 editV2(request:FinderV2Edit):Promise<IpcResult<V2Load>>;
 exportV2File():Promise<IpcResult<EducationVideoFileExportResult>>;
}>;
