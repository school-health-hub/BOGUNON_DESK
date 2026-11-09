import {describe,expect,it} from 'vitest';
import {mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
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
 it('quarantines corrupt bytes and restores the validated backup once',async()=>{
  const root=await mkdtemp(join(tmpdir(),'education-video-recover-'));const store=new EducationVideoLibraryStore(root);
  await store.save(item('EVmock00001'));await store.save(item('EVmock00002'));
  await writeFile(join(root,'library.json'),'SYNTHETIC CORRUPT');
  const backup=await readFile(join(root,'library.backup.json'));
  const restarted=new EducationVideoLibraryStore(root);
  const [loaded,repeat]=await Promise.all([restarted.load(),restarted.load()]);
  expect(loaded.recovered).toBe(true);
  expect(loaded.library.items).toEqual([item()]);
  expect(repeat).toEqual({library:loaded.library,recovered:false});
  expect(await readFile(join(root,'library.json'))).toEqual(backup);
  expect(await readFile(join(root,'library.backup.json'))).toEqual(backup);
  const quarantine=(await readdir(root)).filter(name=>name.startsWith('library.corrupt-'));
  expect(quarantine).toHaveLength(1);
  expect(await readFile(join(root,quarantine[0]),'utf8')).toBe('SYNTHETIC CORRUPT');
 });
 it('does not overwrite a healthy primary on manual recovery',async()=>{
  const root=await mkdtemp(join(tmpdir(),'education-video-healthy-'));
  const store=new EducationVideoLibraryStore(root);
  await store.save(item());
  const latest=await store.save(item('EVmock00002'));
  expect(await store.recover()).toEqual(latest);
  expect(await store.load()).toEqual(latest);
 });
 it('leaves both unreadable versions untouched and preserves unsupported primary versions',async()=>{
  const root=await mkdtemp(join(tmpdir(),'education-video-bad-'));
  const store=new EducationVideoLibraryStore(root);
  const primary=join(root,'library.json'),backup=join(root,'library.backup.json');
  await writeFile(primary,'bad primary');
  await writeFile(backup,'bad backup');
  await expect(store.load()).rejects.toThrow();
  expect(await readFile(primary,'utf8')).toBe('bad primary');
  expect(await readFile(backup,'utf8')).toBe('bad backup');
  await writeFile(primary,'{"version":99,"items":[]}');
  await writeFile(backup,JSON.stringify({version:1,items:[item()]}));
  await expect(store.load()).rejects.toThrow();
  expect(await readFile(primary,'utf8')).toBe('{"version":99,"items":[]}');
  expect((await readdir(root)).sort()).toEqual(['library.backup.json','library.json']);
 });
 it('reports replacement failure without destroying the corrupt primary or the backup',async()=>{
  const root=await mkdtemp(join(tmpdir(),'education-video-denied-'));
  const primary=join(root,'library.json'),backup=join(root,'library.backup.json');
  const valid=JSON.stringify({version:1,items:[item()]});
  await writeFile(primary,'bad primary');
  await writeFile(backup,valid);
  const store=new EducationVideoLibraryStore(root,async()=>{throw new Error('synthetic replacement denied');});
  await expect(store.load()).rejects.toThrow('synthetic replacement denied');
  expect(await readFile(primary,'utf8')).toBe('bad primary');
  expect(await readFile(backup,'utf8')).toBe(valid);
 });
 it('does not accept BOM-prefixed bytes as a healthy primary when saving would reject them',async()=>{
  const root=await mkdtemp(join(tmpdir(),'education-video-bom-'));
  const store=new EducationVideoLibraryStore(root);
  const valid=JSON.stringify({version:1,items:[item()]});
  await writeFile(join(root,'library.json'),'\uFEFF'+valid);
  await writeFile(join(root,'library.backup.json'),valid);
  expect((await store.load()).recovered).toBe(true);
  await expect(store.save(item('EVmock00002'))).resolves.toMatchObject({recovered:false});
 });
});

it('round-trips mixed actual/mock results without losing existing notes, imports or backup bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'finder-real-library-'));const store=new EducationVideoLibraryStore(root);const legacy=item();await store.save(legacy);const oldBytes=await readFile(join(root,'library.json'));
 const actual={...item('QaVideo0001'),source:'youtube' as const,title:'합성 응답 기반 실제 출처 영상',channelId:'UC'+'x'.repeat(22),notes:'직접 작성한 보존 메모',message:'편집한 보존 원고'};await store.save(actual);expect(await readFile(join(root,'library.backup.json'))).toEqual(oldBytes);
 const json=await store.export();const {parseLibrary}=await import('../../src/education-video/library');const parsed=parseLibrary(json);expect(parsed.items).toEqual([legacy,actual]);const fresh=new EducationVideoLibraryStore(join(root,'new'));await fresh.import(json);expect((await fresh.load()).library).toEqual(parsed);
 await store.import(JSON.stringify({version:1,items:[{...actual,notes:'덮어쓰면 안 됨',message:'대체 원고'}]}));expect((await store.load()).library.items[1]).toEqual(actual);await expect(store.import(JSON.stringify({version:1,items:[{...actual,source:'unknown'}]}))).rejects.toThrow();expect(parseLibrary(await store.export()).items[1].notes).toBe(actual.notes);
});
