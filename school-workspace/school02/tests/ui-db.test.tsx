// @vitest-environment jsdom
import{beforeEach,afterEach,describe,it,expect}from'vitest';import{render,screen,fireEvent,cleanup,configure,waitFor,within}from'@testing-library/react';
import{SchoolWorkspace}from'../ui/SchoolWorkspace.js';import{SchoolClientStore}from'../core/client-store.js';import{createSchoolSession,reset,A,mid}from'./fixtures.js';import{sql}from'../server/database.js';
import{registerSchoolIpc,createSchoolPreload,type IpcPort}from'../server/ipc.js';
import{LocalTaskStore}from'../../../electron-p0/main/local-tasks.js';import{mkdtemp,rm}from'node:fs/promises';import{join}from'node:path';import{tmpdir}from'node:os';
configure({asyncUtilTimeout:15000});beforeEach(reset);afterEach(cleanup);
describe('LOCAL DB + React UI + actual Main/BFF classes; MOCK IPC/cipher/Auth (not Windows)',()=>{
 it('Electron UI -> dedicated Preload IPC -> Main Auth -> SQL teacher join, no renderer tokens',async()=>{
  const rig=createSchoolSession('electron',11),handlers=new Map<string,Parameters<IpcPort['handle']>[1]>(),contents={mainFrame:{},getURL:()=> 'http://127.0.0.1:5174/'};
  const ipc:IpcPort={handle:(k,h)=>{handlers.set(k,h);},removeHandler:k=>{handlers.delete(k);}},event={sender:contents,senderFrame:contents.mainFrame};
  expect(()=>registerSchoolIpc(ipc,contents,contents.getURL(),rig.controller,false)).toThrow();const dispose=registerSchoolIpc(ipc,contents,contents.getURL(),rig.controller,true);
  const bridge=createSchoolPreload((c,a,i)=>handlers.get(c)!(event,a,i)),store=new SchoolClientStore(bridge);render(<SchoolWorkspace store={store} client="electron" connected/>);
  fireEvent.click(screen.getByRole('button',{name:'로그인'}));await screen.findByRole('button',{name:'학교 검색'});
  fireEvent.change(screen.getByLabelText('학교명'),{target:{value:'늘봄'}});fireEvent.click(screen.getByRole('button',{name:'학교 검색'}));await screen.findAllByText('합성 늘봄학교');
  fireEvent.click(screen.getAllByRole('button',{name:'이 학교 선택'})[0]);await screen.findByRole('button',{name:'가입 신청'});fireEvent.click(screen.getByRole('button',{name:'가입 신청'}));await screen.findByText('관리자 승인 대기',{selector:'span'});
  expect(await sql("SELECT count(*) FROM workspace.school_memberships WHERE status='pending'")).toBe('2');
  expect(JSON.stringify(store.snapshot())).not.toMatch(/accessToken|refreshToken|SCHOOL01C_MOCK|verifier/);expect(document.body.textContent).not.toMatch(/ws_v1|ws_s02|SQL|RPC/);
  await expect(handlers.values().next().value!({sender:{},senderFrame:{}},'state',{})).rejects.toThrow();await expect(handlers.values().next().value!({...event,senderFrame:{}},'state',{})).rejects.toThrow();
  dispose();expect(Object.isFrozen(bridge)).toBe(true);
 });
 it('admin UI approves actual pending assistant with expiry, confirmation cancels then executes suspension',async()=>{
  const joiner=createSchoolSession('web',12);await joiner.controller.command('login');await joiner.controller.command('select',{school:A});await joiner.controller.command('join',{role:'HEALTH_ASSISTANT'});
  const code=joiner.controller.snapshot().self.memberships[0].member_code,admin=createSchoolSession('electron',1),store=new SchoolClientStore(admin.controller);await store.command('login');await store.command('select',{school:A});render(<SchoolWorkspace store={store} connected client="electron"/>);
  const request=screen.getByRole('article',{name:`가입 신청 ${code}`});fireEvent.change(within(request).getByLabelText('지원강사 유효기간'),{target:{value:'2027-12-31'}});fireEvent.click(within(request).getByRole('button',{name:'가입 승인'}));await waitFor(()=>expect(screen.queryByRole('article',{name:`가입 신청 ${code}`})).toBeNull());
  expect((await joiner.controller.command('refresh')).workspace.context?.role).toBe('HEALTH_ASSISTANT');
  const member=screen.getByRole('article',{name:`구성원 ${code}`});fireEvent.click(within(member).getByRole('button',{name:'이용 정지'}));const dialog=screen.getByRole('alertdialog');fireEvent.click(within(dialog).getByRole('button',{name:'취소'}));expect(screen.queryByRole('alertdialog')).toBeNull();
  expect((await joiner.controller.command('refresh')).self.memberships[0].status).toBe('active');
  fireEvent.click(within(member).getByRole('button',{name:'이용 정지'}));fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'확인'}));await waitFor(()=>expect(store.snapshot().admin?.members.find(m=>m.member_code===code)?.status).toBe('suspended'));
 });
 it('network failure clears admin UI while actual personal local store remains writable',async()=>{
  const x=createSchoolSession('electron',1),store=new SchoolClientStore(x.controller);await store.command('login');await store.command('select',{school:A});render(<SchoolWorkspace store={store} connected/>);x.database.offline=true;fireEvent.click(screen.getByRole('button',{name:'신청 현황 새로고침'}));await waitFor(()=>expect(store.snapshot().admin).toBeUndefined());
  expect(screen.getByText('이 PC에 저장')).toBeTruthy();const dir=await mkdtemp(join(tmpdir(),'s02-personal-'));try{const personal=new LocalTaskStore(dir),loaded=await personal.load();expect((await personal.save(loaded.document,0)).document.revision).toBe(1);}finally{await rm(dir,{recursive:true,force:true});}
 });
 it('server rejected request remains nonadmin and unsupported hosted controls are explicitly disabled',async()=>{
  const x=createSchoolSession('electron',3),store=new SchoolClientStore(x.controller);await store.command('login');await store.command('select',{school:A});render(<SchoolWorkspace store={store} connected/>);
  expect(screen.queryByText('가입 승인과 구성원')).toBeNull();expect((screen.getByRole('button',{name:'운영 관리자 승격 사용 불가'})as HTMLButtonElement).disabled).toBe(true);
  await store.command('logout');await waitFor(()=>expect(screen.queryByText('관리자 추가·이관')).toBeNull());expect(await sql(`SELECT role FROM workspace.school_memberships WHERE id='${mid(3)}'`)).toBe('HEALTH_TEACHER');
 });
});
