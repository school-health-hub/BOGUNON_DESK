import {expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AdminStore} from '../main/admin-store';
import {createAdminHandlers,type AdminPorts} from '../main/admin-ipc';
import {SmartLauncherStore} from '../main/smart-launcher-store';
import {ExcelService} from '../main/purchase-excel';
import {emptyAdmin} from '../admin-protocol';

const frame={},contents={mainFrame:frame,getURL:()=> 'file:///synthetic/index.html'},event={sender:contents,senderFrame:frame};

async function setup(){
 const root=await mkdtemp(join(tmpdir(),'smart-launcher-ipc-')),adminRoot=join(root,'admin');await mkdir(adminRoot);
 const store=new AdminStore(adminRoot),smartLauncher=new SmartLauncherStore(join(root,'smart-launcher'));
 const review=vi.fn(async()=>true),openExternal=vi.fn(async()=>{}),excel=new ExcelService('tools/purchase-excel-cli/target/debug/purchase-excel-cli',join(root,'temp'));
 const ports:AdminPorts={store,smartLauncher,excel,protectedRoot:root,review,openExternal,copy:async()=>{},pick:async()=>undefined,save:async()=>undefined};
 return {root,store,smartLauncher,review,openExternal,excel,handlers:createAdminHandlers(contents,contents.getURL(),ports)};
}

it('launches an immutable catalog action and records recent only after browser success',async()=>{
 const ctx=await setup();try{
  const catalog=await ctx.handlers.smartLauncherCatalog(event);expect(catalog.ok).toBe(true);expect(JSON.stringify(catalog)).not.toContain('https://');expect((await ctx.handlers.smartLauncherCatalog(event,'extra')).ok).toBe(false);
  expect((await ctx.handlers.smartLauncherToggleFavorite(event,'open-portal',0)).ok).toBe(true);expect((await ctx.handlers.smartLauncherReorderFavorites(event,['open-portal'],1)).ok).toBe(true);expect((await ctx.handlers.smartLauncherSetRecentEnabled(event,true,2)).ok).toBe(true);expect((await ctx.handlers.smartLauncherClearRecent(event,3,'extra')).ok).toBe(false);
  await ctx.store.save({...emptyAdmin(),systems:{...emptyAdmin().systems,portal:'https://synthetic.eduptl.kr/'}},0);
  expect(await ctx.handlers.smartLauncherLaunch(event,'open-portal')).toMatchObject({ok:true,data:{status:'launched',recentRecorded:true}});
  expect(ctx.openExternal).toHaveBeenCalledWith('https://synthetic.eduptl.kr/');
  expect((await ctx.smartLauncher.load()).document.recent[0]?.id).toBe('open-portal');
  expect((await ctx.handlers.smartLauncherLaunch(event,'https://evil.test','extra')).ok).toBe(false);
  expect((await ctx.handlers.smartLauncherLaunch(event,'spoofed-action')).ok).toBe(false);
 }finally{ctx.handlers.dispose();await ctx.excel.flush();await rm(ctx.root,{recursive:true,force:true});}
});

it('does not record a redirect-blocked launch',async()=>{
 const ctx=await setup();try{
  await ctx.store.save({...emptyAdmin(),systems:{...emptyAdmin().systems,portal:'https://synthetic.eduptl.kr/'}},0);await ctx.smartLauncher.setRecentEnabled(true,0);ctx.handlers.dispose();
  const handlers=createAdminHandlers(contents,contents.getURL(),{store:ctx.store,smartLauncher:ctx.smartLauncher,excel:ctx.excel,protectedRoot:ctx.root,review:ctx.review,openExternal:ctx.openExternal,copy:async()=>{},pick:async()=>undefined,save:async()=>undefined,inspect:async()=>({state:'redirect-blocked',redirects:1,message:'blocked',redirectOrigin:'https://evil.test'})});
  try{expect(await handlers.smartLauncherLaunch(event,'open-portal')).toMatchObject({ok:true,data:{status:'blocked'}});expect((await ctx.smartLauncher.load()).document.recent).toEqual([]);expect(ctx.openExternal).not.toHaveBeenCalled();}finally{handlers.dispose();}
 }finally{await ctx.excel.flush();await rm(ctx.root,{recursive:true,force:true});}
});

it('does not record canceled, blocked, needs-configuration, or failed launches',async()=>{
 const ctx=await setup();try{
  await ctx.smartLauncher.setRecentEnabled(true,0);
  expect(await ctx.handlers.smartLauncherLaunch(event,'open-portal')).toMatchObject({ok:true,data:{status:'needs-configuration'}});
  await ctx.store.save({...emptyAdmin(),systems:{...emptyAdmin().systems,portal:'https://synthetic.eduptl.kr/'}},0);
  ctx.review.mockResolvedValueOnce(false);
  expect(await ctx.handlers.smartLauncherLaunch(event,'open-portal')).toMatchObject({ok:true,data:{status:'canceled'}});
  ctx.openExternal.mockRejectedValueOnce(Error('private operating system error'));
  const failed=await ctx.handlers.smartLauncherLaunch(event,'open-portal');expect(failed.ok).toBe(false);expect(JSON.stringify(failed)).not.toContain('private operating system error');
  expect((await ctx.smartLauncher.load()).document.recent).toEqual([]);
 }finally{ctx.handlers.dispose();await ctx.excel.flush();await rm(ctx.root,{recursive:true,force:true});}
});

it('keeps launch success when recent persistence fails and preserves direct admin behavior',async()=>{
 const ctx=await setup();try{
  await ctx.store.save({...emptyAdmin(),launcher:{environment:'school',evpn:emptyAdmin().systems,entryUrl:'https://evpn.synthetic.go.kr/'}},0);
  await ctx.smartLauncher.setRecentEnabled(true,0);vi.spyOn(ctx.smartLauncher,'recordLaunch').mockRejectedValueOnce(Error('private recent store path'));
  expect(await ctx.handlers.smartLauncherLaunch(event,'open-evpn')).toEqual({ok:true,data:{status:'launched',recentRecorded:false,warning:'최근 업무를 기록하지 못했습니다.'}});
  expect(await ctx.handlers.openEvpn(event)).toEqual({ok:true,data:{status:'launched'}});
  expect(ctx.openExternal).toHaveBeenNthCalledWith(1,'https://evpn.synthetic.go.kr/');
 }finally{ctx.handlers.dispose();await ctx.excel.flush();await rm(ctx.root,{recursive:true,force:true});}
});

it('reports recentRecorded false when recent is disabled ahead of the queued record',async()=>{
 const ctx=await setup();try{
  await ctx.store.save({...emptyAdmin(),systems:{...emptyAdmin().systems,portal:'https://synthetic.eduptl.kr/'}},0);await ctx.smartLauncher.setRecentEnabled(true,0);
  const load=ctx.smartLauncher.load.bind(ctx.smartLauncher);let disableQueued=false;vi.spyOn(ctx.smartLauncher,'load').mockImplementation(async()=>{const loaded=await load();if(loaded.document.recentEnabled&&!disableQueued){disableQueued=true;void ctx.smartLauncher.setRecentEnabled(false,loaded.document.revision);}return loaded;});
  expect(await ctx.handlers.smartLauncherLaunch(event,'open-portal')).toMatchObject({ok:true,data:{status:'launched',recentRecorded:false}});
  const latest=await load();expect(latest.document.recentEnabled).toBe(false);expect(latest.document.recent).toEqual([]);
 }finally{ctx.handlers.dispose();await ctx.excel.flush();await rm(ctx.root,{recursive:true,force:true});}
});
