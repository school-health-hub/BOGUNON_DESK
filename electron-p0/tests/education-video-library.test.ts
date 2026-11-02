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
