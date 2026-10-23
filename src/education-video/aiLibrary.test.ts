import {describe,it,expect} from 'vitest';
import {parseLibraryV2,mergeLibraryV2,METADATA_TTL_MS} from './libraryV2';
import type {LibraryEntry} from './libraryV2';
import {saveAiCandidate} from './aiLibrary';
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
});
