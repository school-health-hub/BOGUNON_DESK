// @vitest-environment jsdom
import type {ReactNode} from 'react';import {afterEach,it,expect,vi} from 'vitest';import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {P0App} from '../renderer/P0App';import {QuickLauncherWidget} from '../../src/widgets/QuickLauncherWidget';
import {AdminStore} from '../main/admin-store';import {createAdminHandlers} from '../main/admin-ipc';import {emptyAdmin} from '../admin-protocol';
vi.mock('../renderer/school-profile/SchoolProfile',()=>({SchoolProfileProvider:({children}:{children:ReactNode})=><>{children}</>,SchoolInitialSetup:()=>null,SchoolProfileSettings:()=>null}));
vi.mock('../renderer/school-admin/SchoolAdmin',()=>({SchoolAdmin:({onClose}:{onClose:()=>void})=><main><h1>학교 주소 확인·설정 진입</h1><button onClick={onClose}>행정 닫기</button></main>}));
vi.mock('../renderer/purchase/PurchaseSession',()=>({PurchaseSession:()=>null}));
vi.mock('../../src/components/dashboard/DesktopWidgetLayout',()=>({DesktopWidgetLayout:()=> <QuickLauncherWidget/>}));
const roots:string[]=[];afterEach(async()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function setup(){
 vi.stubGlobal('ResizeObserver',class{observe(){} unobserve(){} disconnect(){}});const root=await mkdtemp(join(tmpdir(),'portal-dashboard-'));roots.push(root);const store=new AdminStore(root);await store.save({...emptyAdmin(),systems:{portal:'https://sen.eduptl.kr/',neis:'',edufine:''},launcher:{environment:'evpn',evpn:{portal:'https://remote.eduptl.kr/',neis:'',edufine:''}}},0);
 const frame={},contents={mainFrame:frame,getURL:()=> 'file:///synthetic'},event={sender:contents,senderFrame:frame},openExternal=vi.fn(async()=>{}),handlers=createAdminHandlers(contents,contents.getURL(),{store,protectedRoot:root,excel:{table:vi.fn(),review:vi.fn()},review:async()=>true,pick:async()=>undefined,save:async()=>undefined,copy:async()=>{},openExternal}),openSystem=vi.fn((system:string)=>handlers.openSystem(event,system));
 vi.stubGlobal('electronP0',{info:async()=>({appId:'kr.sungandi.schoolhealthdesk.electronp0',userData:'/synthetic-profile'}),readSettings:async()=>null,writeSettings:vi.fn(async()=>{})});vi.stubGlobal('electronWork',{admin:{openSystem},memo:{read:async()=>({ok:true,data:{version:1,text:''}}),write:vi.fn()},tasks:{load:async()=>({ok:true,data:{document:{version:1,revision:0,tasks:[]},recovered:false}}),save:vi.fn()}});
 return {store,openSystem,openExternal,handlers};
}
it('opens the current saved portal via the same Main launcher and follows saved environment changes without hardcoded URLs',async()=>{
 const h=await setup();render(<P0App/>);const button=await screen.findByRole('button',{name:'업무포털'});fireEvent.click(button);await waitFor(()=>expect(h.openExternal).toHaveBeenCalledExactlyOnceWith('https://remote.eduptl.kr/'));expect(h.openSystem).toHaveBeenCalledWith('portal');await screen.findByText(/기본 브라우저에 저장된 업무포털 열기를 요청/);
 await h.store.setEnvironment('school',1);fireEvent.click(button);await waitFor(()=>expect(h.openExternal).toHaveBeenLastCalledWith('https://sen.eduptl.kr/'));expect(h.openExternal).toHaveBeenCalledTimes(2);h.handlers.dispose();
});
it('sends an unconfigured portal to existing school administration, and blocks reentry from a modal',async()=>{
 const h=await setup(),current=(await h.store.load()).document;await h.store.save({...current,launcher:{...current.launcher!,evpn:{portal:'',neis:'',edufine:''}}},1);render(<P0App/>);fireEvent.click(await screen.findByRole('button',{name:'업무포털'}));await screen.findByRole('heading',{name:'학교 주소 확인·설정 진입'});expect(h.openExternal).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'행정 닫기'}));fireEvent.click(screen.getByRole('button',{name:'빠른 추가'}));await screen.findByRole('dialog',{name:'빠른 추가 — 로컬 업무'});fireEvent.click(screen.getByRole('button',{name:'업무포털',hidden:true}));expect(h.openSystem).toHaveBeenCalledOnce();expect(screen.getByRole('dialog',{name:'빠른 추가 — 로컬 업무'})).toBeTruthy();h.handlers.dispose();
});
it('does not duplicate pending portal requests and preserves settings after a browser failure',async()=>{
 const h=await setup();let release!:(v:any)=>void;h.openSystem.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));render(<P0App/>);const button=await screen.findByRole('button',{name:'업무포털'});fireEvent.click(button);fireEvent.click(button);expect(h.openSystem).toHaveBeenCalledOnce();release({ok:false,error:{code:'STORAGE_ERROR',message:'합성 브라우저 실패',retryable:true}});await screen.findByText('합성 브라우저 실패');expect((await h.store.load()).document.revision).toBe(1);expect(h.openExternal).not.toHaveBeenCalled();h.handlers.dispose();
});
