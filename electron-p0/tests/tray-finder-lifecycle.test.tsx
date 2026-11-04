// @vitest-environment jsdom
import {EventEmitter} from 'node:events';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {EducationVideoFinder} from '../../src/education-video/EducationVideoFinder';
import {EducationVideoLibraryStore} from '../main/education-video-library';
import {createFinderSearchHandlers} from '../main/finder-search';
import type {FinderSearchBridge,FinderSearchPage} from '../finder-search-protocol';
const repository=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),exportFile:vi.fn()}));
vi.mock('../../src/education-video/library',()=>({nativeLibrary:true,libraryRepository:repository}));
const roots:string[]=[];afterEach(async()=>{cleanup();vi.restoreAllMocks();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
import {FinderSearchService} from '../main/finder-search';

// Exercise the event selected by the real Main binding, without starting Electron,
// using an OS-shaped close/preventDefault/closed fixture and the real Finder service.
const main=await readFile('electron-p0/main/main.mts','utf8');
function finderWindowEvent():string{
 const binding=main.match(/window\.on\('(close|closed)',\(\)=>finderSearch\.dispose\(\)\);/);
 if(!binding)throw Error('Finder Main lifetime binding changed; review the integration fixture.');
 return binding[1]!;
}
class WindowFixture extends EventEmitter{
 visible=true;destroyed=false;tray=true;
 hide(){this.visible=false;}
 show(){if(!this.destroyed)this.visible=true;}
 close(){const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};this.emit('close',event);if(!event.defaultPrevented){this.destroyed=true;this.emit('closed');}}
}
function service(){
 let stored:string|null=null;
 const vault={available:true,exists:vi.fn(async()=>stored!==null),read:vi.fn(async()=>stored),write:vi.fn(async(value:string)=>{stored=value;}),clear:vi.fn(async()=>{stored=null;})};
 const fetch=vi.fn(async(_url:string,_init:RequestInit)=>new Response('{"items":[]}',{headers:{'content-type':'application/json'}}));
 const ports={vault,fetch,readClipboard:async()=> 'SYNTHETIC_YOUTUBE_KEY_1234567890',clearClipboard:async()=>{},reviewKey:async()=>true,reviewSearch:async()=>true,openExternal:async()=>{},library:async()=>({version:1 as const,items:[]})};
 const finder=new FinderSearchService(ports);return {finder,vault,fetch,ports};
}
it('keeps the configured Finder reusable after Main close is prevented for tray hide',async()=>{
 const h=service(),window=new WindowFixture();window.on(finderWindowEvent(),()=>h.finder.dispose());window.on('close',event=>{if(window.tray){event.preventDefault();window.hide();}});
 try{await h.finder.connect({remember:true});window.close();expect(window.destroyed).toBe(false);expect(window.visible).toBe(false);window.show();expect(window.visible).toBe(true);
  expect(await h.finder.status()).toMatchObject({configured:true,saved:true});
  await h.finder.search({conditions:{topic:'합성 안전교육',target:'학생',minutes:10},consent:true});expect(h.fetch).toHaveBeenCalledOnce();
 }finally{h.finder.dispose();await h.finder.flush();window.removeAllListeners();}
});
function attach(window:WindowFixture,finder:FinderSearchService){
 const dispose=vi.spyOn(finder,'dispose');window.on(finderWindowEvent(),()=>finder.dispose());
 window.on('close',event=>{if(window.tray){event.preventDefault();window.hide();}});return dispose;
}
const request={conditions:{topic:'합성 안전교육',target:'학생',minutes:10},consent:true as const};
it('reuses one instance and listener set over repeated hides without clearing the session-only key',async()=>{
 const h=service(),window=new WindowFixture(),dispose=attach(window,h.finder);
 try{await h.finder.connect({remember:false});const counts=window.eventNames().map(event=>[event,window.listenerCount(event)]);
  for(let i=0;i<12;i++){window.close();expect(window.destroyed).toBe(false);window.show();await h.finder.search(request);expect(await h.finder.status()).toMatchObject({configured:true,saved:false});expect(window.eventNames().map(event=>[event,window.listenerCount(event)])).toEqual(counts);}
  expect(dispose).not.toHaveBeenCalled();expect(h.fetch).toHaveBeenCalledTimes(12);expect(h.vault.write).not.toHaveBeenCalled();expect(h.vault.clear).toHaveBeenCalledOnce();
 }finally{h.finder.dispose();await h.finder.flush();window.removeAllListeners();}
});
it('leaves approved in-flight work intact on hide and keeps explicit cancel/late-response protection',async()=>{
 const h=service(),window=new WindowFixture();attach(window,h.finder);
 try{await h.finder.connect({remember:false});let release!:(value:Response)=>void;h.fetch.mockImplementationOnce(()=>new Promise(r=>{release=r;}));
  const pending=h.finder.search(request);await vi.waitFor(()=>expect(h.fetch).toHaveBeenCalledOnce());window.close();window.show();expect(h.fetch.mock.calls[0]![1].signal?.aborted).toBe(false);
  h.finder.cancel();expect(h.fetch.mock.calls[0]![1].signal?.aborted).toBe(true);await expect(h.finder.search(request)).rejects.toThrow('진행');
  release(new Response('{"items":[]}',{headers:{'content-type':'application/json'}}));await expect(pending).rejects.toThrow('취소');await h.finder.flush();
  await expect(h.finder.search(request)).resolves.toMatchObject({videos:[]});expect(await h.finder.status()).toMatchObject({configured:true});
 }finally{h.finder.dispose();await h.finder.flush();window.removeAllListeners();}
});
it('disposes/aborts on actual closed, drains the owned timer/request and restores only in a new lifetime',async()=>{
 const h=service(),window=new WindowFixture(),dispose=attach(window,h.finder);
 try{await h.finder.connect({remember:true});h.fetch.mockImplementationOnce(async(_url,init)=>new Promise((_resolve,reject)=>{init.signal!.addEventListener('abort',()=>reject(Error('synthetic aborted')),{once:true});}));
  const pending=h.finder.search(request);await vi.waitFor(()=>expect(h.fetch).toHaveBeenCalledOnce());window.tray=false;window.close();expect(window.destroyed).toBe(true);expect(dispose).toHaveBeenCalledOnce();
  await expect(pending).rejects.toThrow('취소');await h.finder.flush();expect(h.fetch.mock.calls[0]![1].signal?.aborted).toBe(true);expect(await h.finder.status()).toMatchObject({configured:false,saved:true});await expect(h.finder.restore()).rejects.toThrow('취소');expect(h.vault.clear).not.toHaveBeenCalled();
  const restarted=new FinderSearchService(h.ports);try{expect(await restarted.status()).toMatchObject({configured:false,saved:true});await restarted.restore();await expect(restarted.search(request)).resolves.toMatchObject({videos:[]});}finally{restarted.dispose();await restarted.flush();}
 }finally{h.finder.dispose();await h.finder.flush();window.removeAllListeners();}
});
it.each(['search','connect'] as const)('settles owned %s approval on shutdown without waiting for a late native answer',async kind=>{
 const h=service();let approve!:(value:boolean)=>void;let pending:Promise<unknown>|undefined;
 try{await h.finder.connect({remember:true});const ask=vi.fn(()=>new Promise<boolean>(resolve=>{approve=resolve;}));
  if(kind==='search')h.ports.reviewSearch=ask;else h.ports.reviewKey=ask;
  pending=kind==='search'?h.finder.search(request):h.finder.connect({remember:false});const ended=vi.fn();void pending.catch(ended);
  await vi.waitFor(()=>expect(ask).toHaveBeenCalledOnce());h.finder.dispose();await vi.waitFor(()=>expect(ended).toHaveBeenCalledOnce());await h.finder.flush();
  approve(true);await Promise.resolve();expect(h.fetch).not.toHaveBeenCalled();expect(h.vault.clear).not.toHaveBeenCalled();expect(await h.finder.status()).toMatchObject({configured:false,saved:true});
 }finally{approve?.(false);await pending?.catch(()=>{});h.finder.dispose();await h.finder.flush();}
});
it('ignores an old cancelled approval while a fresh search session is active',async()=>{
 const h=service();let approve!:(value:boolean)=>void;let release!:(value:Response)=>void;
 try{await h.finder.connect({remember:true});h.ports.reviewSearch=vi.fn().mockImplementationOnce(()=>new Promise<boolean>(resolve=>{approve=resolve;})).mockResolvedValue(true);
  const previous=h.finder.search(request);await vi.waitFor(()=>expect(h.ports.reviewSearch).toHaveBeenCalledOnce());h.finder.cancel();await expect(previous).rejects.toThrow('취소');
  h.fetch.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));const current=h.finder.search(request);await vi.waitFor(()=>expect(h.fetch).toHaveBeenCalledOnce());approve(true);await Promise.resolve();
  expect(h.fetch).toHaveBeenCalledOnce();expect(h.fetch.mock.calls[0]![1].signal?.aborted).toBe(false);release(new Response('{"items":[]}',{headers:{'content-type':'application/json'}}));await expect(current).resolves.toMatchObject({videos:[]});expect(h.vault.write).toHaveBeenCalledOnce();expect(await h.finder.status()).toMatchObject({configured:true,saved:true});
 }finally{approve?.(false);release?.(new Response('{"items":[]}',{headers:{'content-type':'application/json'}}));h.finder.dispose();await h.finder.flush();}
});
it('keeps security-navigation/quit disposal and flush while close handles only the desktop close policy',()=>{
 const closeBindings=main.split('\n').filter(line=>line.includes("window.on('close',"));expect(closeBindings).toHaveLength(1);expect(closeBindings[0]).toContain('event.preventDefault()');expect(closeBindings[0]).toContain("desktop.closeBehavior==='tray'");expect(closeBindings[0]).toContain('window.hide()');
 for(const source of ["window.webContents.on('will-navigate',()=>finderSearch.dispose())","window.webContents.on('render-process-gone',()=>finderSearch.dispose())","app.on('before-quit',()=>finderSearch.dispose())",'finderSearch.flush()'])expect(main).toContain(source);
 const quit=main.split('\n').find(line=>line.includes('const quit=()=>'));expect(quit).toContain('finderSearch.dispose()');expect(quit).toContain('finderSearch.flush()');expect(quit).toContain('aiService.dispose()');expect(quit).toContain('inventoryQa.close()');
 const show=main.split('\n').find(line=>line.includes('const show=()=>'));expect(show).toContain('window.show()');expect(show).not.toMatch(/reload|loadURL|new BrowserWindow/);
 // Shared-window clients retain their credentials/worker lifetime too; no auth or engine rewrite.
 for(const name of ['aiService','chatgptService','imageImport','purchaseAi','officialFiles','financeService'])expect(main.split('\n').filter(line=>line.includes("window.on('close',")).join('')).not.toContain(name);
});
async function storedLibrary(){
 const root=await mkdtemp(join(tmpdir(),'tray-finder-'));roots.push(root);const store=new EducationVideoLibraryStore(root);
 const v1=JSON.parse(await readFile('electron-p0/tests/fixtures/finder-v2/electron-v1.json','utf8')),v2=JSON.parse(await readFile('electron-p0/tests/fixtures/finder-v2/tauri-v2.json','utf8'));
 await store.import(JSON.stringify(v1));await store.importReviewed(v2,v2.entries.map((row:{videoId:string})=>row.videoId),(await store.snapshot()).fingerprint);
 return {root,store};
}
function bridge(h:ReturnType<typeof service>):FinderSearchBridge{
 const frame={},contents={mainFrame:frame,getURL:()=> 'file:///synthetic-tray'},event={sender:contents,senderFrame:frame},handlers=createFinderSearchHandlers(contents,contents.getURL(),h.finder);
 return Object.fromEntries(Object.entries(handlers).map(([name,handler])=>[name,vi.fn((...args:unknown[])=>handler(event,...args))])) as unknown as FinderSearchBridge;
}
it('preserves library V1/V2 bytes and unsaved memo on repeated hide/show, then restores saved edits after re-entry/restart',async()=>{
 const {root,store}=await storedLibrary(),h=service(),window=new WindowFixture(),dispose=attach(window,h.finder);await h.finder.connect({remember:true});
 repository.load.mockImplementation(()=>store.load());repository.save.mockImplementation(item=>store.save(item));
 const searchBridge=bridge(h),chosenId=(await store.load()).library.items[0]!.videoId;const before1=await readFile(join(root,'library.json')),before2=await readFile(join(root,'library-v2.json'));
 let view=render(<EducationVideoFinder searchBridge={searchBridge} onClose={()=>{}}/>);
 try{await screen.findByText(/Key 설정됨/);fireEvent.click((await screen.findAllByRole('button',{name:'불러오기'}))[0]!);const memo=screen.getByLabelText('사용자 메모') as HTMLTextAreaElement;
  fireEvent.change(memo,{target:{value:'숨김 중 보존할 합성 편집 메모'}});fireEvent.change(screen.getByLabelText('안내문 직접 수정'),{target:{value:'숨김 중 보존할 합성 원고'}});
  for(let i=0;i<5;i++){window.close();window.show();expect(screen.getByLabelText('사용자 메모')).toBe(memo);expect(memo.value).toBe('숨김 중 보존할 합성 편집 메모');}
  expect(dispose).not.toHaveBeenCalled();expect(searchBridge.cancel).not.toHaveBeenCalled();expect(await readFile(join(root,'library.json'))).toEqual(before1);expect(await readFile(join(root,'library-v2.json'))).toEqual(before2);
  fireEvent.change(screen.getByLabelText('교육 주제'),{target:{value:'합성 안전교육'}});fireEvent.change(screen.getByLabelText('검색 대상'),{target:{value:'학생'}});fireEvent.click(screen.getByLabelText('학생·교직원 개인정보 없는 검색어를 YouTube에 전송하는 데 동의합니다.'));fireEvent.click(screen.getByRole('button',{name:'YouTube 영상 검색'}));await screen.findByText(/새 검색 결과가 없습니다/);expect(memo.value).toBe('숨김 중 보존할 합성 편집 메모');
  fireEvent.click(screen.getByRole('button',{name:'라이브러리 저장'}));await screen.findByText('독립 라이브러리에 저장했습니다.');view.unmount();expect(searchBridge.cancel).toHaveBeenCalledOnce();expect(dispose).not.toHaveBeenCalled();
  view=render(<EducationVideoFinder searchBridge={searchBridge} onClose={()=>{}}/>);await screen.findByText(/Key 설정됨/);const chosenIndex=(await store.load()).library.items.findIndex(row=>row.videoId===chosenId);fireEvent.click((await screen.findAllByRole('button',{name:'불러오기'}))[chosenIndex]!);expect((screen.getByLabelText('사용자 메모') as HTMLTextAreaElement).value).toBe('숨김 중 보존할 합성 편집 메모');
  view.unmount();window.tray=false;window.close();await h.finder.flush();expect(dispose).toHaveBeenCalledOnce();expect((await new EducationVideoLibraryStore(root).load()).library.items.some(row=>row.notes==='숨김 중 보존할 합성 편집 메모')).toBe(true);expect(await readFile(join(root,'library-v2.json'))).toEqual(before2);
 }finally{view.unmount();h.finder.dispose();await h.finder.flush();window.removeAllListeners();}
});
