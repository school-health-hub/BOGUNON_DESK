// @vitest-environment jsdom
import {beforeEach,describe,expect,it} from 'vitest';
import {libraryRepository} from './library';
import {toEntry} from './libraryV2';
import {searchMockVideos} from './model';
const key='bogunon.education-video.browser-qa.v2';
const item={...searchMockVideos({topic:'교육',target:'학생',minutes:10})[0],educationTitle:'교육명',target:'학생',schedule:'이번주',instructions:'확인',message:'교사 문구',notes:'교사 메모'};
beforeEach(()=>localStorage.clear());
describe('browser QA physical metadata retention',()=>{
 it('purges expired metadata from primary and valid backup, keeps teacher text',async()=>{const entry=toEntry(item,Date.now()-31*86400000);const original=JSON.stringify({version:2,entries:[entry]});localStorage.setItem(key,original);localStorage.setItem(key+'.backup',original);await libraryRepository.load();for(const location of [key,key+'.backup']){const raw=JSON.parse(localStorage.getItem(location)??'{}');expect(raw.entries[0].provider).toBeNull();expect(raw.entries[0].teacher.notes).toBe('교사 메모');}});
 it('explicit metadata deletion also scrubs backup',async()=>{await libraryRepository.save(toEntry(item));await libraryRepository.save(toEntry({...item,notes:'수정 메모'}));await libraryRepository.deleteMetadata(item.videoId);for(const location of [key,key+'.backup']){expect(JSON.parse(localStorage.getItem(location)??'{}').entries[0].provider).toBeNull();}});
});
const aiEvidence=()=>({videoId:item.videoId,url:item.url,title:'합성 출처 제목',publisher:null,durationSeconds:null,description:'공개 소개정보 요약',relevance:'교육 관련성',reason:'추천 이유',sources:[{url:item.url,title:'합성 출처 제목'}],checkedAt:new Date().toISOString(),needsReview:true as const,provenance:'web-search-verified' as const,metadataVerification:{title:'unverified' as const,publisher:'unverified' as const,durationSeconds:'unverified' as const}});
it('explicit AI metadata deletion scrubs primary and backup but preserves notes',async()=>{
 const entry={...toEntry(item),ai:aiEvidence()};
 await libraryRepository.save(entry);
 await libraryRepository.save({...entry,teacher:{...entry.teacher,notes:'유지 메모'}});
 await libraryRepository.deleteMetadata(item.videoId);
 for(const location of [key,key+'.backup']){
  const raw=JSON.parse(localStorage.getItem(location)??'{}');
  expect(raw.entries[0].ai).toBeUndefined();expect(raw.entries[0].teacher.notes).toBe('유지 메모');
 }
});
it('legacy teacher editing without AI field preserves stored AI provenance',async()=>{
 const entry=toEntry(item);const ai=aiEvidence();
 await libraryRepository.save({...entry,ai});
 await libraryRepository.save({...entry,teacher:{...entry.teacher,notes:'교사 수정'}});
 const loaded=await libraryRepository.load();
 expect(loaded.library.entries[0]?.ai).toEqual(ai);
 expect(loaded.library.entries[0]?.teacher.notes).toBe('교사 수정');
});
it('exports imports and reloads candidate provenance without promoting facts',async()=>{
 const entry=toEntry(item);const ai=aiEvidence();
 await libraryRepository.save({...entry,ai});
 const exported=await libraryRepository.export();
 localStorage.clear();
 await libraryRepository.import(exported);
 const loaded=await libraryRepository.load();
 expect(loaded.library.entries[0]?.ai).toEqual(ai);
 expect(loaded.library.entries[0]?.ai?.metadataVerification).toEqual({title:'unverified',publisher:'unverified',durationSeconds:'unverified'});
});
