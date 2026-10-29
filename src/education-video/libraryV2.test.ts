import {describe,expect,it} from 'vitest';
import {parseLibraryV2,expireMetadata,migrateLegacy,mergeLibraryV2,toEntry} from './libraryV2';
import {searchMockVideos} from './model';
const now=Date.parse('2026-10-22T00:00:00.000Z');
const video=searchMockVideos({topic:'교육',target:'학생',minutes:10})[0];
const item={...video,educationTitle:'교사 교육명',target:'학생',schedule:'이번주',instructions:'확인',message:'수정 안내문',notes:'교사 메모'};
describe('libraryv2 retention',()=>{
 it('migrates v1 into separate teacher/provider fields',()=>{const migrated=migrateLegacy({version:1,items:[item]},now);expect(migrated.entries[0].teacher.notes).toBe(item.notes);expect(migrated.entries[0].provider?.source).toBe('synthetic-mock');});
 it('expires only metadata and preserves all teacher edits',()=>{const library=migrateLegacy({version:1,items:[item]},now);const expired=expireMetadata(library,now+31*86400000);expect(expired.entries[0].provider).toBeNull();expect(expired.entries[0].teacher).toEqual(library.entries[0].teacher);});
 it('rejects secrets unknown version duplicate IDs and invalid timestamps',()=>{const entry=toEntry(item,now);expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,accessToken:'no'}]}),now)).toThrow();expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[entry,entry]}),now)).toThrow();expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,provider:{...entry.provider,fetchedAt:'yesterday'}}]}),now)).toThrow();});
 it('import metadata never replaces existing notes or edited messages',()=>{const entry=toEntry(item,now);const incoming={...entry,teacher:{...entry.teacher,notes:'overwrite',message:'overwrite'}};expect(mergeLibraryV2({version:2,entries:[entry]},{version:2,entries:[incoming]}).entries[0].teacher).toEqual(entry.teacher);});
});
it('rejects far future metadata that would evade retention expiry',()=>{const entry=toEntry(item,now);expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,provider:{...entry.provider,fetchedAt:'2099-01-01T00:00:00.000Z',expiresAt:'2099-01-02T00:00:00.000Z'}}]}),now)).toThrow();});
it('serializes known live official evidence as native-compatible exact URL',()=>{const entry=toEntry({...item,source:'live',channelId:'UCexUyFaq9YH7XJfCQzVR_jg',fetchedAt:new Date(now).toISOString()},now);expect(entry.provider?.official).toBe(true);expect(entry.provider?.officialEvidence).toBe('https://moe.go.kr/main.do');const imported=parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,provider:{...entry.provider,officialEvidence:'forged'}}]}),now);expect(imported.entries[0].provider?.officialEvidence).toBe('https://moe.go.kr/main.do');});
it('never extends an existing shorter metadata expiry when saving teacher edits',()=>{const entry=toEntry(item,now);const shorter={...entry.provider,expiresAt:new Date(now+1000).toISOString()};if(!entry.provider)throw new Error('fixture');const video={videoId:entry.videoId,...entry.provider,...shorter};const saved=toEntry({...video,...entry.teacher},now+500);expect(saved.provider?.expiresAt).toBe(shorter.expiresAt);});
it('rejects NUL in teacher and provider text before native serialization',()=>{
 const entry=toEntry(item,now);
 for(const field of ['educationTitle','target','schedule','instructions','message','notes']){
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,teacher:{...entry.teacher,[field]:'before\u0000after'}}]}),now)).toThrow();
 }
 for(const field of ['title','channelId','channelTitle','url','officialEvidence']){
  expect(()=>parseLibraryV2(JSON.stringify({version:2,entries:[{...entry,provider:{...entry.provider,[field]:'before\u0000after'}}]}),now)).toThrow();
 }
});
