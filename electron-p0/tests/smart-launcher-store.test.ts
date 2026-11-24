import {expect, it} from 'vitest';
import {link, lstat, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {SmartLauncherConflict, SmartLauncherStore} from '../main/smart-launcher-store';
import {emptySmartLauncherPreferences, validateSmartLauncherPreferences} from '../smart-launcher-preferences';
import {WORK_ACTION_IDS} from '../smart-work-launcher';

const firstId = 'leave-annual' as const;
const secondId = 'business-trip' as const;

async function withRoot(run:(root:string)=>Promise<void>):Promise<void>{
  const root=await mkdtemp(join(tmpdir(),'smart-launcher-store-'));
  try{await run(root);}finally{await rm(root,{recursive:true,force:true});}
}

it('returns private defaults when no preference files exist',async()=>withRoot(async root=>{
  // Given an empty synthetic preferences root
  const store=new SmartLauncherStore(root);
  // When preferences are loaded
  const loaded=await store.load();
  // Then history is disabled and no user state exists
  expect(loaded).toEqual({document:emptySmartLauncherPreferences(),recovered:false});
}));

it('persists command-shaped mutations, ordering, caps, and allowed fields only',async()=>withRoot(async root=>{
  // Given a new store with recent history enabled
  const store=new SmartLauncherStore(root);
  let state=await store.setRecentEnabled(true,0);
  // When favorites and launches are recorded through commands
  state=await store.toggleFavorite(firstId,state.document.revision);
  state=await store.toggleFavorite(secondId,state.document.revision);
  state=await store.reorderFavorites([secondId,firstId],state.document.revision);
  for(let index=0;index<12;index++)state=(await store.recordLaunch(index%2?firstId:secondId,new Date(index*1000).toISOString())).load;
  await store.flush();
  // Then the serialized document has strict fields, ordered favorites, and ten recents
  expect(state.document.favorites).toEqual([secondId,firstId]);
  expect(state.document.recent).toHaveLength(10);
  expect(Object.keys(JSON.parse(await readFile(join(root,'smart-launcher.json'),'utf8'))).sort()).toEqual(['favorites','recent','recentEnabled','revision','version']);
  expect((await new SmartLauncherStore(root).load()).document).toEqual(state.document);
}));

it('rejects malformed documents, unknown IDs, extra keys, timestamps, and favorite overflow',()=>{
  // Given otherwise plausible preference documents
  const base=emptySmartLauncherPreferences();
  // When each untrusted shape crosses the parser boundary
  // Then it is rejected instead of being normalized
  expect(()=>validateSmartLauncherPreferences({...base,extra:true})).toThrow();
  expect(()=>validateSmartLauncherPreferences({...base,favorites:['unknown-action']})).toThrow();
  expect(()=>validateSmartLauncherPreferences({...base,favorites:Array.from({length:13},()=>firstId)})).toThrow();
  expect(()=>validateSmartLauncherPreferences({...base,recent:[{id:firstId,timestamp:'yesterday'}]})).toThrow();
  expect(()=>validateSmartLauncherPreferences({...base,recent:[{id:firstId,timestamp:new Date(0).toISOString(),extra:true}]})).toThrow();
});

it('enforces expected revisions and preserves the last committed bytes on write failure',async()=>withRoot(async root=>{
  // Given one committed preference revision
  const store=new SmartLauncherStore(root),first=await store.toggleFavorite(firstId,0);
  const before=await readFile(join(root,'smart-launcher.json'));
  // When stale state and a synthetic atomic-write interruption are attempted
  await expect(store.toggleFavorite(secondId,0)).rejects.toBeInstanceOf(SmartLauncherConflict);
  const failing=new SmartLauncherStore(root,async()=>{throw new Error('synthetic interruption');});
  await expect(failing.toggleFavorite(secondId,first.document.revision)).rejects.toThrow('synthetic interruption');
  await expect(failing.toggleFavorite(secondId,first.document.revision)).rejects.toThrow('synthetic interruption');
  // Then the committed primary remains byte-for-byte unchanged
  expect(await readFile(join(root,'smart-launcher.json'))).toEqual(before);
}));

it('prevents lost updates across store instances sharing one root',async()=>withRoot(async root=>{
  // Given two Main store instances observing the same initial revision
  const first=new SmartLauncherStore(root),second=new SmartLauncherStore(root);
  // When both attempt revision zero concurrently
  const results=await Promise.allSettled([
    first.toggleFavorite(firstId,0),
    second.toggleFavorite(secondId,0),
  ]);
  // Then exactly one commit wins and the stale writer receives a conflict
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  const rejected=results.find(result=>result.status==='rejected');
  expect(rejected).toMatchObject({status:'rejected',reason:expect.any(SmartLauncherConflict)});
  expect((await new SmartLauncherStore(root).load()).document.revision).toBe(1);
}));

it('caps favorites at twelve and flush waits for queued commands',async()=>withRoot(async root=>{
  // Given twelve valid favorites queued in order
  const store=new SmartLauncherStore(root);let revision=0;
  for(const id of WORK_ACTION_IDS.slice(0,12)){const saved=await store.toggleFavorite(id,revision);revision=saved.document.revision;}
  // When a thirteenth favorite is attempted and the queue is flushed
  await expect(store.toggleFavorite(WORK_ACTION_IDS[12],revision)).rejects.toThrow('favorites are full');
  await store.flush();
  // Then only the committed maximum persists
  expect((await store.load()).document.favorites).toEqual(WORK_ACTION_IDS.slice(0,12));
}));

it('loads a valid backup read-only while preserving a corrupt primary',async()=>withRoot(async root=>{
  // Given a corrupt primary and strict valid backup
  const backup={...emptySmartLauncherPreferences(),revision:4,favorites:[firstId]};
  await writeFile(join(root,'smart-launcher.json'),'SYNTHETIC CORRUPTION');
  await writeFile(join(root,'smart-launcher.backup.json'),JSON.stringify(backup));
  const store=new SmartLauncherStore(root);
  // When recovery loads the backup
  const loaded=await store.load();
  // Then it is read-only and the corrupt evidence is preserved
  expect(loaded).toEqual({document:backup,recovered:true});
  await expect(store.clearRecent(4)).rejects.toThrow('read only');
  expect(await readFile(join(root,'smart-launcher.json'),'utf8')).toBe('SYNTHETIC CORRUPTION');
}));

it('can recover the first successful revision when its primary is later corrupted',async()=>withRoot(async root=>{
  // Given the first successful preference mutation
  const store=new SmartLauncherStore(root),saved=await store.toggleFavorite(firstId,0);
  // When the primary is corrupted after that completed save
  await writeFile(join(root,'smart-launcher.json'),'CORRUPTED AFTER FIRST SAVE');
  const recovered=await new SmartLauncherStore(root).load();
  // Then the completed revision remains available from a read-only backup
  expect(recovered).toEqual({document:saved.document,recovered:true});
  await expect(new SmartLauncherStore(root).toggleFavorite(secondId,saved.document.revision)).rejects.toThrow('read only');
  expect(await readFile(join(root,'smart-launcher.json'),'utf8')).toBe('CORRUPTED AFTER FIRST SAVE');
}));

it('rejects unsafe directory, symlink, and hardlink targets',async()=>withRoot(async root=>{
  // Given unsafe filesystem aliases around preference storage
  const real=join(root,'real');await writeFile(real,'{}');
  const linkedRoot=join(root,'linked-root');await symlink(root,linkedRoot,'junction');
  // When each target is inspected
  // Then directory symlinks and linked files are rejected before parsing or writing
  await expect(new SmartLauncherStore(linkedRoot).load()).rejects.toThrow('Unsafe smart launcher directory');
  await symlink(real,join(root,'smart-launcher.json'));
  await expect(new SmartLauncherStore(root).load()).rejects.toThrow('Unsafe smart launcher file');
  await rm(join(root,'smart-launcher.json'));
  await link(real,join(root,'smart-launcher.json'));
  expect((await lstat(join(root,'smart-launcher.json'))).nlink).toBeGreaterThan(1);
  await expect(new SmartLauncherStore(root).load()).rejects.toThrow('Unsafe smart launcher file');
}));

it('disables and clears recent history without accepting renderer-authored entries',async()=>withRoot(async root=>{
  // Given enabled recent history with a Main-authored launch
  const store=new SmartLauncherStore(root);
  let state=await store.setRecentEnabled(true,0);
  const recorded=await store.recordLaunch(firstId,new Date(0).toISOString());expect(recorded.recorded).toBe(true);state=recorded.load;
  // When history is disabled and later cleared through explicit commands
  state=await store.setRecentEnabled(false,state.document.revision);
  const unchanged=await store.recordLaunch(secondId,new Date(1000).toISOString());
  state=await store.clearRecent(unchanged.load.document.revision);
  // Then disabled recording is a no-op and clear removes existing entries
  expect(unchanged.recorded).toBe(false);expect(unchanged.load.document.recent).toHaveLength(1);
  expect(state.document.recent).toEqual([]);
}));
