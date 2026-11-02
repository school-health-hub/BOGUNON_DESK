// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,within,waitFor} from '@testing-library/react';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {InventoryHost} from '../renderer/inventory-preview/InventoryHost';
import {InventoryEntryButtons,type InventoryMode} from '../renderer/inventory-preview/InventoryEntryButtons';
import {InventoryStore} from '../main/inventory-store';
import {createSyntheticInventory} from '../../src/inventory-management/model';
function App(){const [mode,setMode]=useState<InventoryMode|null>(null);return mode?<InventoryHost mode={mode} onModeChange={setMode} onClose={()=>setMode(null)}/>:<InventoryEntryButtons onSelect={setMode}/>;}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function denied(){const fetch=vi.fn(()=>{throw Error('Network forbidden');}),save=vi.fn(()=>{throw Error('Preview cannot save');}),load=vi.fn(()=>{throw Error('Preview cannot read local data');}),xhr=vi.spyOn(XMLHttpRequest.prototype,'open').mockImplementation(()=>{throw Error('XHR forbidden');});vi.stubGlobal('fetch',fetch);vi.stubGlobal('WebSocket',vi.fn(()=>{throw Error('Socket forbidden');}));vi.stubGlobal('electronWork',{inventory:{save,load}});return {fetch,save,load,xhr};}
it('opens the separate menu and exercises synthetic workflows with zero network/IPC and no stock mutation',async()=>{
 const deniedCalls=denied();render(<App/>);fireEvent.click(screen.getByRole('button',{name:'물품관리 — 미리보기'}));await screen.findByRole('table');expect(screen.getByText(/preview_only · persisted:false/)).toBeTruthy();const before=screen.getByRole('table').textContent;
 for(const [button,title] of [['입고 등록','입고 등록'],['재고 사용 기록','재고 사용 기록'],['폐기','폐기 기록'],['재고 정정','재고 정정'],['구매 필요 품목 확인','구매 후보 확인'],['물품 등록','물품 등록']]){
  fireEvent.click(screen.getByRole('button',{name:button}));const dialog=screen.getByRole('dialog',{name:title});
  if(title==='물품 등록'){
   for(const name of ['물품명','분류','규격','기본단위','구매단위'])fireEvent.change(within(dialog).getByRole('textbox',{name}),{target:{value:'합성 입력'}});
   for(const name of ['포장 변환비','권장재고','최소재고'])fireEvent.change(within(dialog).getByRole('spinbutton',{name}),{target:{value:'1'}});
  }else{
   const name=title==='재고 정정'?'실사 확인 잔량':title==='구매 후보 확인'?'구매 수량':'수량';fireEvent.change(within(dialog).getByRole('spinbutton',{name}),{target:{value:'1'}});
   const reason=within(dialog).queryByRole('textbox',{name:title==='재고 사용 기록'?'사용 메모':'업무 사유'});if(reason)fireEvent.change(reason,{target:{value:'합성 확인'}});
   if(title==='입고 등록')fireEvent.change(within(dialog).getByLabelText('입고일'),{target:{value:'2026-11-02'}});
   if(title==='구매 후보 확인')fireEvent.change(within(dialog).getByRole('spinbutton',{name:'예상 단가'}),{target:{value:'100'}});
  }
  fireEvent.submit(dialog.querySelector('form')!);await within(dialog).findByRole('status');expect(dialog.textContent).not.toMatch(/저장 완료|저장되었습니다|입고 완료/);fireEvent.click(within(dialog).getByRole('button',{name:'취소'}));
 }
 expect(screen.getByRole('table').textContent).toBe(before);for(const spy of Object.values(deniedCalls))expect(spy).not.toHaveBeenCalled();
 fireEvent.change(screen.getByRole('textbox',{name:'물품 검색'}),{target:{value:'탄력'}});expect(screen.getByRole('button',{name:'합성 탄력 붕대'})).toBeTruthy();fireEvent.change(screen.getByRole('textbox',{name:'물품 검색'}),{target:{value:''}});fireEvent.change(screen.getByRole('combobox',{name:'재고 상태 필터'}),{target:{value:'expired'}});expect(screen.getByRole('complementary',{name:'합성 냉각 패드 상세'})).toBeTruthy();
});
it('preserves real isolated JSON bytes through Preview switching and retains local save behavior',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'preview-json-'));const store=new InventoryStore(dir),seed=createSyntheticInventory('2026-11-02');await store.save({...seed,items:seed.items.map((i,n)=>n===0?{...i,name:'합성 LOCAL 전용'}:i)});const load=vi.fn(async()=>({ok:true as const,data:await store.load()})),save=vi.fn(async(value:unknown)=>({ok:true as const,data:await store.save(value)}));vi.stubGlobal('electronWork',{inventory:{load,save}});const fetch=vi.fn(()=>{throw Error('No network');});vi.stubGlobal('fetch',fetch);
 try{render(<App/>);fireEvent.click(screen.getByRole('button',{name:'물품관리 — 로컬 저장'}));await screen.findByRole('button',{name:'합성 LOCAL 전용 선택'});fireEvent.click(screen.getByRole('button',{name:'입고 기록'}));fireEvent.change(screen.getByLabelText('수량'),{target:{value:'2'}});fireEvent.change(screen.getByLabelText('사유'),{target:{value:'합성 로컬 저장'}});fireEvent.click(screen.getByRole('button',{name:'기록 저장'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));await screen.findByText('입고 기록을 저장했습니다.');const before=await readFile(join(dir,'inventory.json')),backup=await readFile(join(dir,'inventory.backup.json'));const calls=load.mock.calls.length;
 fireEvent.click(screen.getByRole('button',{name:'미리보기로'}));await screen.findByRole('table');expect(screen.queryByText('합성 LOCAL 전용')).toBeNull();fireEvent.change(screen.getByRole('textbox',{name:'물품 검색'}),{target:{value:'합성 냉각'}});expect(load).toHaveBeenCalledTimes(calls);expect(save).toHaveBeenCalledTimes(1);expect(await readFile(join(dir,'inventory.json'))).toEqual(before);expect(await readFile(join(dir,'inventory.backup.json'))).toEqual(backup);
 fireEvent.click(screen.getByRole('button',{name:'로컬 저장으로'}));await screen.findByRole('button',{name:'합성 LOCAL 전용 선택'});expect((await store.load()).document?.movements).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'미리보기로'}));await screen.findByRole('table');expect((screen.getByRole('textbox',{name:'물품 검색'}) as HTMLInputElement).value).toBe('');expect(save).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();expect(await readFile(join(dir,'inventory.json'))).toEqual(before);expect(await readdir(dir)).toEqual(expect.arrayContaining(['inventory.json','inventory.backup.json']));
 }finally{cleanup();await store.flush();await rm(dir,{recursive:true,force:true});}
});
