import {describe,it,expect} from 'vitest';
import {parseLibraryV2,mergeLibraryV2,METADATA_TTL_MS} from './libraryV2';
import type {LibraryEntry} from './libraryV2';
import {saveAiCandidate} from './aiLibrary';
import {candidateFromRecord,candidateRecord,mergeCandidateRecords,parseCandidateRecord} from './candidateRecord';
import {parseRecommendationReason} from './recommendationReason';
const now=Date.now();
const ai={videoId:'abcdefghijk',url:'https://www.youtube.com/watch?v=abcdefghijk',title:'합성 출처 제목',publisher:null,durationSeconds:null,description:'공개 소개정보 기반 합성 요약',relevance:'교육 관련성',reason:'선정 이유',sources:[{url:'https://www.youtube.com/watch?v=abcdefghijk',title:'합성 출처 제목'}],checkedAt:new Date(now).toISOString(),needsReview:true as const};
const verification={title:'unverified',publisher:'unverified',durationSeconds:'unverified'} as const;
const enriched={...ai,provenance:'web-search-verified' as const,metadataVerification:verification};
const teacher={educationTitle:'기존 교육',target:'중학생',schedule:'',instructions:'',message:'수정 안내문',notes:'보존 메모'};
const entry={videoId:ai.videoId,teacher,provider:null,ai:enriched};
describe('AI library compatibility',()=>{
 it('round trips optional provenance while old v2 remains readable',()=>{
  const legacy=parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai}]}),now).entries[0]?.ai;
  expect(legacy).toEqual({...ai,provenance:'unverified',metadataVerification:verification});
  expect(parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:enriched}]}),now).entries[0]?.ai).toEqual(enriched);
  expect(parseLibraryV2(JSON.stringify({version:2,entries:[{videoId:ai.videoId,teacher,provider:null}]}),now).entries[0]?.ai).toBeUndefined();
 });
 it.each(['web-search-verified','teacher-supplied','unverified'] as const)('serializes and restores %s provenance without confirming metadata',(provenance)=>{
  const candidate={...enriched,provenance};
  expect(parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:candidate}]}),now).entries[0]?.ai).toEqual(candidate);
 });
 it('restores teacher-confirmed provenance and its separately confirmed title',()=>{
  const candidate={...enriched,provenance:'teacher-confirmed' as const,metadataVerification:{...verification,title:'teacher-confirmed' as const}};
  expect(parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:candidate}]}),now).entries[0]?.ai).toEqual(candidate);
 });
 it('keeps candidate provenance independent from per-field confirmation',()=>{
  const teacherConfirmed={...enriched,provenance:'teacher-confirmed' as const};
  const suppliedWithConfirmedTitle={...enriched,publisher:'기관',durationSeconds:600,provenance:'teacher-supplied' as const,metadataVerification:{title:'teacher-confirmed' as const,publisher:'teacher-confirmed' as const,durationSeconds:'teacher-confirmed' as const}};
  expect(parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:teacherConfirmed}]}),now).entries[0]?.ai).toEqual(teacherConfirmed);
  expect(parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:suppliedWithConfirmedTitle}]}),now).entries[0]?.ai).toEqual(suppliedWithConfirmedTitle);
 });
 it('expires AI metadata while preserving teacher notes',()=>{
  const loaded=parseLibraryV2(JSON.stringify({version:2,entries:[entry]}),now+METADATA_TTL_MS+1);
  expect(loaded.entries[0]?.ai).toBeUndefined();expect(loaded.entries[0]?.teacher.notes).toBe('보존 메모');
 });
 it('rejects malformed provenance and duplicate IDs',()=>{
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:{...ai,sources:[{url:'http://localhost/private',title:'bad'}]}}]}),now)).toThrow();
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[entry,entry]}),now)).toThrow();
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:{...enriched,provenance:'forged'}}]}),now)).toThrow();
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:{...enriched,metadataVerification:{...verification,title:'forged'}}}]}),now)).toThrow();
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:{...enriched,metadataVerification:{title:'unverified',publisher:'unverified'}}}]}),now)).toThrow();
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:{...ai,provenance:'teacher-supplied'}}]}),now)).toThrow();
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:{...ai,metadataVerification:verification}}]}),now)).toThrow();
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:{...enriched,publisher:null,provenance:'teacher-confirmed',metadataVerification:{...verification,publisher:'teacher-confirmed'}}}]}),now)).toThrow();
 });
 it('retains notes and imports new AI evidence',()=>{
  const imported=mergeLibraryV2({version:2,entries:[{videoId:ai.videoId,teacher,provider:null}]},{version:2,entries:[entry]});
  expect(imported.entries[0]?.teacher.notes).toBe('보존 메모');expect(imported.entries[0]?.ai).toEqual(enriched);
 });
 it('updates duplicate evidence through the existing repository without replacing notes',async()=>{
  let saved:unknown;
  const repository={load:async()=>({library:{version:2 as const,entries:[entry]},recovered:false}),save:async(value:LibraryEntry)=>{saved=value;return {library:{version:2 as const,entries:[value]},recovered:false};}};
  await saveAiCandidate(repository,enriched);
  expect(saved).toMatchObject({teacher,ai:enriched});
 });
 it('round trips generated edited and deleted reasons without upgrading legacy data',()=>{
  for(const recommendationReason of [{status:'ai-generated',text:'AI 이유'},{status:'teacher-edited',text:'교사 수정 이유'},{status:'deleted'}] as const){
   const restored=parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,recommendationReason}]}),now).entries[0];
   expect(restored?.recommendationReason).toEqual(recommendationReason);
  }
  expect(parseLibraryV2(JSON.stringify({version:2,entries:[entry]}),now).entries[0]?.recommendationReason).toBeUndefined();
 });
 it('keeps reasons after AI evidence expiry and import-export merge',()=>{
  const reason={status:'teacher-edited' as const,text:'교사 최종 이유'};
  const confirmed={...enriched,title:'교사 확인 제목',publisher:'교육기관',durationSeconds:600,metadataVerification:{title:'teacher-confirmed' as const,publisher:'teacher-confirmed' as const,durationSeconds:'teacher-confirmed' as const}};
  const record=candidateRecord(confirmed,new Date(now).toISOString());
  const expired=parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:confirmed,candidateRecord:record,recommendationReason:reason}]}),now+METADATA_TTL_MS+1).entries[0];
  expect(expired?.ai).toBeUndefined();expect(expired?.candidateRecord).toEqual(record);expect(expired?.recommendationReason).toEqual(reason);
  expect(candidateFromRecord(ai.videoId,record)).toMatchObject({title:'교사 확인 제목',publisher:'교육기관',durationSeconds:600,provenance:'web-search-verified'});
  const merged=mergeLibraryV2({version:2,entries:[entry]},{version:2,entries:[{...entry,recommendationReason:reason}]});
  expect(merged.entries[0]?.recommendationReason).toEqual(reason);
 });
 it('stores only teacher-confirmed facts and rejects inconsistent records',()=>{
  const confirmed={...enriched,title:'교사 확인 제목',publisher:'교육기관',durationSeconds:600,metadataVerification:{title:'teacher-confirmed' as const,publisher:'unverified' as const,durationSeconds:'teacher-confirmed' as const}};
  const record=candidateRecord(confirmed,new Date(now).toISOString());
  expect(record).toMatchObject({title:'교사 확인 제목',publisher:null,durationSeconds:600});
  expect(()=>parseCandidateRecord({...record,title:null},now)).toThrow();
  expect(()=>parseCandidateRecord({...record,publisher:'AI 추정 기관'},now)).toThrow();
  const {title,...missingTitle}=record;void title;
  expect(()=>parseCandidateRecord(missingTitle,now)).toThrow();
  expect(()=>parseCandidateRecord({...record,savedAt:'2026-10-22T00:00:00Z'},now)).toThrow();
 });
 it('uses Unicode scalar length consistently for persisted reasons',()=>{
  expect(parseRecommendationReason({status:'teacher-edited',text:'😀'.repeat(600)})).toBeTruthy();
  expect(()=>parseRecommendationReason({status:'teacher-edited',text:'😀'.repeat(601)})).toThrow();
 });
 it('rejects malformed recommendation reason data',()=>{
  for(const recommendationReason of [{status:'forged',text:'x'},{status:'ai-generated',text:''},{status:'ai-generated',text:' padded '},{status:'deleted',text:'x'},{status:'teacher-edited',text:'x',url:'secret'}]){
   expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,recommendationReason}]}),now)).toThrow();
  }
 });
 it('rejects conflicting expiring AI evidence and persistent confirmed facts',()=>{
  const confirmed={...enriched,title:'교사 확인 제목',metadataVerification:{...verification,title:'teacher-confirmed' as const}};
  const record=candidateRecord(confirmed,new Date(now).toISOString());
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:{...confirmed,title:'다른 제목'},candidateRecord:record}]}),now)).toThrow();
 });
 it('does not downgrade confirmed facts when the same video is saved from an unverified candidate',async()=>{
  let saved:LibraryEntry|undefined;
  const confirmed={...enriched,title:'교사 확인 제목',publisher:'교육기관',durationSeconds:600,provenance:'teacher-confirmed' as const,metadataVerification:{title:'teacher-confirmed' as const,publisher:'teacher-confirmed' as const,durationSeconds:'teacher-confirmed' as const}};
  const previous={...entry,ai:confirmed,candidateRecord:candidateRecord(confirmed,new Date(now).toISOString())};
  const repository={load:async()=>({library:{version:2 as const,entries:[previous]},recovered:false}),save:async(value:LibraryEntry)=>{saved=value;return {library:{version:2 as const,entries:[value]},recovered:false};}};
  await saveAiCandidate(repository,enriched);
  expect(saved?.candidateRecord).toMatchObject({provenance:'teacher-confirmed',title:'교사 확인 제목',publisher:'교육기관',durationSeconds:600});
  expect(saved?.ai).toMatchObject({provenance:'teacher-confirmed',title:'교사 확인 제목',publisher:'교육기관',durationSeconds:600,metadataVerification:confirmed.metadataVerification});
 });
 it('does not downgrade confirmed facts when a legacy v2 import omits the candidate record',()=>{
  const confirmed={...enriched,title:'교사 확인 제목',publisher:'교육기관',durationSeconds:600,provenance:'teacher-confirmed' as const,metadataVerification:{title:'teacher-confirmed' as const,publisher:'teacher-confirmed' as const,durationSeconds:'teacher-confirmed' as const}};
  const current={version:2 as const,entries:[{...entry,ai:confirmed}]};
  const incoming={version:2 as const,entries:[{...entry,ai:enriched}]};
  const merged=mergeLibraryV2(current,incoming).entries[0];
  expect(merged?.candidateRecord).toMatchObject({provenance:'teacher-confirmed',title:'교사 확인 제목',publisher:'교육기관',durationSeconds:600});
  expect(merged?.ai).toMatchObject({provenance:'teacher-confirmed',title:'교사 확인 제목',publisher:'교육기관',durationSeconds:600,metadataVerification:confirmed.metadataVerification});
 });
 it('allows evidence-backed provenance upgrades without downgrading stronger provenance',()=>{
  const savedAt=new Date(now).toISOString();
  const unverified=candidateRecord({...enriched,provenance:'unverified'},savedAt);
  const verified=candidateRecord(enriched,savedAt);
  expect(mergeCandidateRecords(unverified,verified).provenance).toBe('web-search-verified');
  const teacherConfirmed=candidateRecord({...enriched,provenance:'teacher-confirmed'},savedAt);
  expect(mergeCandidateRecords(teacherConfirmed,verified).provenance).toBe('teacher-confirmed');
 });
 it('persists explicit deletion and preserves the previous reason when omitted',async()=>{
  let saved:LibraryEntry|undefined;
  const previous={...entry,recommendationReason:{status:'ai-generated' as const,text:'이전 이유'}};
  const repository={load:async()=>({library:{version:2 as const,entries:[previous]},recovered:false}),save:async(value:LibraryEntry)=>{saved=value;return {library:{version:2 as const,entries:[value]},recovered:false};}};
  await saveAiCandidate(repository,enriched);expect(saved?.recommendationReason).toEqual(previous.recommendationReason);
  expect(saved?.candidateRecord).toMatchObject({provenance:'web-search-verified',title:null,publisher:null,durationSeconds:null,metadataVerification:verification});
  await saveAiCandidate(repository,enriched,undefined,{status:'deleted'});expect(saved?.recommendationReason).toEqual({status:'deleted'});
 });
});
