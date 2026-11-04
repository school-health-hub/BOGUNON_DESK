import {describe,expect,it} from 'vitest';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EducationVideoLibraryStore,validateEducationVideoLibrary} from '../main/education-video-library';

const item=(videoId='EVmock00001')=>({videoId,title:'합성 손씻기 교육',channelId:'mock-channel',channelTitle:'합성 채널',durationSeconds:600,url:`https://www.youtube.com/watch?v=${videoId}`,source:'mock' as const,educationTitle:'손씻기',target:'학생',schedule:'이번 주',instructions:'확인',message:'합성 안내문',notes:'교사 메모'});

describe('Electron education video library',()=>{
 it('persists only the verified v1 contract and reloads it',async()=>{
  const root=await mkdtemp(join(tmpdir(),'education-video-'));const store=new EducationVideoLibraryStore(root);
  const saved=await store.save(item());expect(saved.library.items).toHaveLength(1);
  expect(await new EducationVideoLibraryStore(root).load()).toEqual({library:saved.library,recovered:false});
 });
 it('rejects paths, credentials, duplicate IDs and oversized text',()=>{
  const valid={version:1,items:[item()]};
  for(const invalid of [{...valid,path:'C:/private'}, {version:1,items:[{...item(),token:'secret'}]}, {version:1,items:[item(),item()]}, {version:1,items:[{...item(),notes:'x'.repeat(20001)}]}])expect(()=>validateEducationVideoLibrary(invalid)).toThrow();
 });
 it('keeps corrupt primary bytes and loads the last good backup',async()=>{
  const root=await mkdtemp(join(tmpdir(),'education-video-recover-'));const store=new EducationVideoLibraryStore(root);
  await store.save(item('EVmock00001'));await store.save(item('EVmock00002'));
  await writeFile(join(root,'library.json'),'SYNTHETIC CORRUPT');
  const loaded=await new EducationVideoLibraryStore(root).load();
  expect(loaded.recovered).toBe(true);expect(loaded.library.items.map(row=>row.videoId)).toEqual(['EVmock00001']);
  expect(await readFile(join(root,'library.json'),'utf8')).toBe('SYNTHETIC CORRUPT');
 });
});

it('round-trips mixed actual/mock results without losing existing notes, imports or backup bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'finder-real-library-'));const store=new EducationVideoLibraryStore(root);const legacy=item();await store.save(legacy);const oldBytes=await readFile(join(root,'library.json'));
 const actual={...item('QaVideo0001'),source:'youtube' as const,title:'합성 응답 기반 실제 출처 영상',channelId:'UC'+'x'.repeat(22),notes:'직접 작성한 보존 메모',message:'편집한 보존 원고'};await store.save(actual);expect(await readFile(join(root,'library.backup.json'))).toEqual(oldBytes);
 const json=await store.export();const {parseLibrary}=await import('../../src/education-video/library');const parsed=parseLibrary(json);expect(parsed.items).toEqual([legacy,actual]);const fresh=new EducationVideoLibraryStore(join(root,'new'));await fresh.import(json);expect((await fresh.load()).library).toEqual(parsed);
 await store.import(JSON.stringify({version:1,items:[{...actual,notes:'덮어쓰면 안 됨',message:'대체 원고'}]}));expect((await store.load()).library.items[1]).toEqual(actual);await expect(store.import(JSON.stringify({version:1,items:[{...actual,source:'unknown'}]}))).rejects.toThrow();expect(parseLibrary(await store.export()).items[1].notes).toBe(actual.notes);
});
