// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {InventoryLocalQa} from '../renderer/inventory-local-qa/InventoryLocalQa';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('starts without network/storage calls; status never masquerades as persisted Inventory data',async()=>{
 const status=vi.fn(async()=>({ok:true,data:{authGateway:'reachable',inventoryConnection:'blocked',persisted:false}})),save=vi.fn(),load=vi.fn(),fetch=vi.fn();vi.stubGlobal('fetch',fetch);vi.stubGlobal('electronWork',{inventory:{save,load},inventoryLocalQa:{status}});
 render(<InventoryLocalQa onClose={()=>{}}/>);expect(status).not.toHaveBeenCalled();expect(screen.queryByLabelText(/비밀번호/)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'로컬 Auth 연결 상태 확인'}));await screen.findByText('로컬 Auth 게이트웨이에 응답이 있습니다. DB·인증·RPC는 검증하지 않았습니다.');expect(save).not.toHaveBeenCalled();expect(load).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();expect(screen.getByText('업무 IPC가 없는 이전 Host입니다. 실제 Inventory 연결은 비활성화 상태입니다.')).toBeTruthy();
});
it('hides the component in production and restores focus when leaving',()=>{
 const previous=document.createElement('button');document.body.append(previous);previous.focus();const {unmount}=render(<InventoryLocalQa onClose={()=>{}}/>);expect(document.activeElement).toBe(screen.getByRole('button',{name:'로컬 QA 닫기'}));unmount();expect(document.activeElement).toBe(previous);previous.remove();vi.stubEnv('DEV',false);const view=render(<InventoryLocalQa onClose={()=>{}}/>);expect(view.container.textContent).toBe('');vi.unstubAllEnvs();
});
