export type {AiVideoCandidate,CandidateProvenance,FactVerificationStatus,MetadataVerification} from '../../finder-v2-protocol.js';
export const candidateProvenances=['web-search-verified','teacher-supplied','teacher-confirmed','unverified'] as const;
export const factVerificationStatuses=['unverified','teacher-confirmed'] as const;
export const UNVERIFIED_METADATA_VERIFICATION={title:'unverified',publisher:'unverified',durationSeconds:'unverified'} as const;
export class FinderInputError extends Error{}
export const canonicalTimestamp=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function safeVideoUrl(value:string):string|null{
 try{const u=new URL(value),id=u.searchParams.get('v');return id&&/^[A-Za-z0-9_-]{11}$/.test(id)&&value===`https://www.youtube.com/watch?v=${id}`?value:null;}catch{return null;}
}
