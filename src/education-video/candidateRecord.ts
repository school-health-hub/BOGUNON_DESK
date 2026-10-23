import { candidateProvenances, factVerificationStatuses, type AiVideoCandidate, type CandidateProvenance, type MetadataVerification } from './aiVideo';
import { canonicalTimestamp } from './searchService';

export type CandidateRecord = {
  readonly provenance: CandidateProvenance;
  readonly title: string | null;
  readonly publisher: string | null;
  readonly durationSeconds: number | null;
  readonly metadataVerification: MetadataVerification;
  readonly savedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && [...value].length <= max && !value.includes('\0');

export function candidateRecord(candidate: AiVideoCandidate, savedAt = new Date().toISOString()): CandidateRecord {
  return {
    provenance: candidate.provenance,
    title: candidate.metadataVerification.title === 'teacher-confirmed' ? candidate.title : null,
    publisher: candidate.metadataVerification.publisher === 'teacher-confirmed' ? candidate.publisher : null,
    durationSeconds: candidate.metadataVerification.durationSeconds === 'teacher-confirmed' ? candidate.durationSeconds : null,
    metadataVerification: candidate.metadataVerification,
    savedAt,
  };
}

export function parseCandidateRecord(value: unknown, now = Date.now()): CandidateRecord {
  const fields=['provenance','title','publisher','durationSeconds','metadataVerification','savedAt'];
  if (!isRecord(value) || Object.keys(value).length!==fields.length || fields.some(key=>!Object.prototype.hasOwnProperty.call(value,key))) throw new Error('후보 확인정보 저장 형식이 올바르지 않습니다.');
  if (!candidateProvenances.includes(value.provenance as CandidateProvenance) || !isRecord(value.metadataVerification)
    || Object.keys(value.metadataVerification).length !== 3
    || !factVerificationStatuses.includes(value.metadataVerification.title as never)
    || !factVerificationStatuses.includes(value.metadataVerification.publisher as never)
    || !factVerificationStatuses.includes(value.metadataVerification.durationSeconds as never)
    || !canonicalTimestamp(value.savedAt) || Date.parse(value.savedAt) > now + 300000) throw new Error('후보 확인정보 저장 형식이 올바르지 않습니다.');
  const metadataVerification = value.metadataVerification as MetadataVerification;
  const title = value.title === null ? null : validText(value.title, 500) ? value.title : (()=>{throw new Error('후보 확인정보 저장 형식이 올바르지 않습니다.');})();
  const publisher = value.publisher === null ? null : validText(value.publisher, 500) ? value.publisher : (()=>{throw new Error('후보 확인정보 저장 형식이 올바르지 않습니다.');})();
  const durationSeconds = value.durationSeconds === null ? null : typeof value.durationSeconds === 'number' && Number.isInteger(value.durationSeconds) && value.durationSeconds >= 1 && value.durationSeconds <= 86400 ? value.durationSeconds : (()=>{throw new Error('후보 확인정보 저장 형식이 올바르지 않습니다.');})();
  if ((metadataVerification.title === 'teacher-confirmed') !== (title !== null)
    || (metadataVerification.publisher === 'teacher-confirmed') !== (publisher !== null)
    || (metadataVerification.durationSeconds === 'teacher-confirmed') !== (durationSeconds !== null)) throw new Error('후보 확인정보 저장 형식이 올바르지 않습니다.');
  return { provenance: value.provenance as CandidateProvenance, title, publisher, durationSeconds, metadataVerification, savedAt: value.savedAt };
}

export function mergeCandidateRecords(previous:CandidateRecord|undefined,next:CandidateRecord):CandidateRecord{
  if(!previous)return next;
  const provenanceRank:Record<CandidateProvenance,number>={'unverified':0,'teacher-supplied':1,'web-search-verified':2,'teacher-confirmed':3};
  const title=next.metadataVerification.title==='teacher-confirmed'?next.title:previous.title;
  const publisher=next.metadataVerification.publisher==='teacher-confirmed'?next.publisher:previous.publisher;
  const durationSeconds=next.metadataVerification.durationSeconds==='teacher-confirmed'?next.durationSeconds:previous.durationSeconds;
  return {provenance:provenanceRank[next.provenance]>=provenanceRank[previous.provenance]?next.provenance:previous.provenance,title,publisher,durationSeconds,
    metadataVerification:{title:title===null?'unverified':'teacher-confirmed',publisher:publisher===null?'unverified':'teacher-confirmed',durationSeconds:durationSeconds===null?'unverified':'teacher-confirmed'},savedAt:next.savedAt};
}

export function applyCandidateRecord(candidate:AiVideoCandidate,record:CandidateRecord):AiVideoCandidate{
  return {...candidate,provenance:record.provenance,title:record.title??candidate.title,publisher:record.publisher??candidate.publisher,durationSeconds:record.durationSeconds??candidate.durationSeconds,metadataVerification:record.metadataVerification};
}

export function candidateRecordMatchesCandidate(record:CandidateRecord,candidate:AiVideoCandidate):boolean{
  return record.provenance===candidate.provenance
    && record.metadataVerification.title===candidate.metadataVerification.title
    && record.metadataVerification.publisher===candidate.metadataVerification.publisher
    && record.metadataVerification.durationSeconds===candidate.metadataVerification.durationSeconds
    && (record.title===null||record.title===candidate.title)
    && (record.publisher===null||record.publisher===candidate.publisher)
    && (record.durationSeconds===null||record.durationSeconds===candidate.durationSeconds);
}

export function candidateFromRecord(videoId: string, record: CandidateRecord): AiVideoCandidate {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  return { videoId, url, title: record.title ?? '확인 필요', publisher: record.publisher, durationSeconds: record.durationSeconds,
    description: '확인 필요', relevance: '확인 필요', reason: '확인 필요', sources: [{ url, title: '교사가 저장한 영상 URL' }],
    checkedAt: record.savedAt, needsReview: true, provenance: record.provenance, metadataVerification: record.metadataVerification };
}
