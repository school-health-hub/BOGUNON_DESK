import {describe,it,expect} from 'vitest';
import {parseLibraryV2,mergeLibraryV2,METADATA_TTL_MS} from './libraryV2';
import type {LibraryEntry} from './libraryV2';
import {saveAiCandidate} from './aiLibrary';
const now=Date.now();
const ai={videoId:'abcdefghijk',url:'https://www.youtube.com/watch?v=abcdefghijk',title:'합성 출처 제목',publisher:null,durationSeconds:null,description:'공개 소개정보 기반 합성 요약',relevance:'교육 관련성',reason:'선정 이유',sources:[{url:'https://www.youtube.com/watch?v=abcdefghijk',title:'합성 출처 제목'}],checkedAt:new Date(now).toISOString(),needsReview:true as const};
const teacher={educationTitle:'기존 교육',target:'중학생',schedule:'',instructions:'',message:'수정 안내문',notes:'보존 메모'};
const entry={videoId:ai.videoId,teacher,provider:null,ai};
describe('AI library compatibility',()=>{
 it('round trips optional provenance while old v2 remains readable',()=>{
  expect(parseLibraryV2(JSON.stringify({version:2,entries:[entry]}),now).entries[0]?.ai).toEqual(ai);
  expect(parseLibraryV2(JSON.stringify({version:2,entries:[{videoId:ai.videoId,teacher,provider:null}]}),now).entries[0]?.ai).toBeUndefined();
 });
 it('expires AI metadata while preserving teacher notes',()=>{
  const loaded=parseLibraryV2(JSON.stringify({version:2,entries:[entry]}),now+METADATA_TTL_MS+1);
  expect(loaded.entries[0]?.ai).toBeUndefined();expect(loaded.entries[0]?.teacher.notes).toBe('보존 메모');
 });
 it('rejects malformed provenance and duplicate IDs',()=>{
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,ai:{...ai,sources:[{url:'http://localhost/private',title:'bad'}]}}]}),now)).toThrow();
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[entry,entry]}),now)).toThrow();
 });
 it('retains notes and imports new AI evidence',()=>{
  const imported=mergeLibraryV2({version:2,entries:[{videoId:ai.videoId,teacher,provider:null}]},{version:2,entries:[entry]});
  expect(imported.entries[0]?.teacher.notes).toBe('보존 메모');expect(imported.entries[0]?.ai).toEqual(ai);
 });
 it('updates duplicate evidence through the existing repository without replacing notes',async()=>{
  let saved:unknown;
  const repository={load:async()=>({library:{version:2 as const,entries:[entry]},recovered:false}),save:async(value:LibraryEntry)=>{saved=value;return {library:{version:2 as const,entries:[value]},recovered:false};}};
  await saveAiCandidate(repository,ai);
  expect(saved).toMatchObject({teacher,ai});
 });
});
