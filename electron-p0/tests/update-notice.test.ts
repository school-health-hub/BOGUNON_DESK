import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,expect,it,vi} from 'vitest';
import {UpdateNotice,UPDATE_CHECK_INTERVAL_MS} from '../main/update-notice.js';

let directory:string|undefined;
afterEach(async()=>{if(directory)await rm(directory,{recursive:true,force:true});directory=undefined;});

it('notifies once per version across restarts, and keeps the next version eligible',async()=>{
  directory=await mkdtemp(join(tmpdir(),'bogunon-update-notice-'));
  const file=join(directory,'last-notified.json');
  const show=vi.fn(()=>true);
  const notice=new UpdateNotice(file,show);
  await notice.load();
  await notice.observe({phase:'current',currentVersion:'2.0.0-beta.11'});
  await notice.observe({phase:'available',currentVersion:'2.0.0-beta.11',nextVersion:'2.0.0-beta.12'});
  await notice.observe({phase:'available',currentVersion:'2.0.0-beta.11',nextVersion:'2.0.0-beta.12'});
  const restarted=new UpdateNotice(file,show);await restarted.load();
  await restarted.observe({phase:'available',currentVersion:'2.0.0-beta.11',nextVersion:'2.0.0-beta.12'});
  expect(show).toHaveBeenCalledTimes(1);
  await restarted.observe({phase:'available',currentVersion:'2.0.0-beta.11',nextVersion:'2.0.0-beta.13'});
  expect(show).toHaveBeenCalledTimes(2);
  expect(JSON.parse(await readFile(file,'utf8'))).toEqual({version:'2.0.0-beta.13'});
  expect(UPDATE_CHECK_INTERVAL_MS).toBeGreaterThanOrEqual(60*60*1000);
});

it('does not remember a notification that the OS could not display',async()=>{
  directory=await mkdtemp(join(tmpdir(),'bogunon-update-notice-'));
  const show=vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  const notice=new UpdateNotice(join(directory,'last-notified.json'),show);await notice.load();
  const state={phase:'available' as const,currentVersion:'2.0.0-beta.11',nextVersion:'2.0.0-beta.12'};
  await notice.observe(state);await notice.observe(state);
  expect(show).toHaveBeenCalledTimes(2);
});

it('waits for asynchronous delivery before recording the version',async()=>{
  directory=await mkdtemp(join(tmpdir(),'bogunon-update-notice-'));
  const file=join(directory,'last-notified.json');
  let finish:(result:boolean)=>void=()=>{};
  const notice=new UpdateNotice(file,()=>new Promise<boolean>(resolve=>{finish=resolve;}));
  await notice.load();
  const pending=notice.observe({phase:'available',currentVersion:'2.0.0-beta.11',nextVersion:'2.0.0-beta.12'});
  await expect(readFile(file,'utf8')).rejects.toMatchObject({code:'ENOENT'});
  finish(false);await pending;
  await expect(readFile(file,'utf8')).rejects.toMatchObject({code:'ENOENT'});
});
