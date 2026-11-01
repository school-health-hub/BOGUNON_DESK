import {it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const fault=vi.hoisted(()=>({rename:false}));
vi.mock('node:fs/promises',async importOriginal=>{
 const real=await importOriginal<typeof import('node:fs/promises')>();
 return {...real,rename:async(...args:Parameters<typeof real.rename>)=>{if(fault.rename&&String(args[1]).replaceAll('\\','/').endsWith('/memo.json'))throw Error('SYNTHETIC_WRITE_FAILURE');return real.rename(...args);}};
});
import {MemoStore,createMemoHandlers} from '../main/memo-ipc';
const url='file:///poc/index.html',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
const root=()=>mkdtemp(join(tmpdir(),'p2b-memo-'));
it('creates, edits and reloads memo independently from dashboard settings',async()=>{
 const dir=await root(),store=new MemoStore(dir),handlers=createMemoHandlers(wc,url,store);
 await writeFile(join(dir,'layout.json'),'SYNTHETIC DASHBOARD');
 expect(await handlers.read(event)).toEqual({ok:true,data:{version:1,text:''}});
 for(const text of ['합성 메모 생성','합성 메모 수정\n다음 줄',''])expect(await handlers.write(event,{version:1,text})).toEqual({ok:true,data:{version:1,text}});
 expect(await new MemoStore(dir).read()).toEqual({version:1,text:''});
 expect(await readFile(join(dir,'layout.json'),'utf8')).toBe('SYNTHETIC DASHBOARD');
});
it('rejects unauthorized callers, extra args, oversized text and arbitrary paths',async()=>{
 const dir=await root(),h=createMemoHandlers(wc,url,new MemoStore(dir));
 for(const caller of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{}}])expect(await h.write(caller,{version:1,text:'test'})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(await h.read(event,{})).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 for(const value of [null,{version:2,text:''},{version:1,text:5},{version:1,text:'x'.repeat(8001)},{version:1,text:'test',path:'C:/synthetic'}])expect(await h.write(event,value)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(await readdir(dir)).toEqual([]);
});
it('preserves last good bytes if atomic rename fails, then permits retry',async()=>{
 const dir=await root(),store=new MemoStore(dir),h=createMemoHandlers(wc,url,store);
 await store.write({version:1,text:'SYNTHETIC GOOD'});const before=await readFile(join(dir,'memo.json'),'utf8');
 fault.rename=true;try{
  expect(await h.write(event,{version:1,text:'SYNTHETIC REJECTED'})).toMatchObject({ok:false,error:{code:'STORAGE_ERROR'}});
  expect(await readFile(join(dir,'memo.json'),'utf8')).toBe(before);
  expect(await readdir(dir)).toEqual(['memo.json']);
 }finally{fault.rename=false;}
 await store.write({version:1,text:'SYNTHETIC RETRY'});
 expect(await new MemoStore(dir).read()).toEqual({version:1,text:'SYNTHETIC RETRY'});
});
it('refuses to replace corrupted existing memo and returns sanitized errors',async()=>{
 const dir=await root();await writeFile(join(dir,'memo.json'),'SYNTHETIC CORRUPT');
 const h=createMemoHandlers(wc,url,new MemoStore(dir));
 expect(await h.read(event)).toMatchObject({ok:false,error:{code:'STORAGE_ERROR'}});
 const result=await h.write(event,{version:1,text:'replacement'});expect(result).toMatchObject({ok:false,error:{code:'STORAGE_ERROR'}});
 expect(JSON.stringify(result)).not.toContain(dir);expect(await readFile(join(dir,'memo.json'),'utf8')).toBe('SYNTHETIC CORRUPT');
});
