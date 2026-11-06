// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {QuickMemoSurface} from '../renderer/QuickMemoSurface';
import {SurfaceDialog} from '../renderer/SurfaceDialog';
const observers:{callback:()=>void;disconnect:ReturnType<typeof vi.fn>}[]=[];
afterEach(()=>{cleanup();observers.length=0;vi.unstubAllGlobals();vi.restoreAllMocks();});
function setup(){
 vi.stubGlobal('ResizeObserver',class{disconnect=vi.fn();constructor(callback:()=>void){observers.push({callback,disconnect:this.disconnect});}observe(){}});
 vi.stubGlobal('innerHeight',533);
 const dock=document.createElement('nav');dock.className='dock-zone';document.body.append(dock);
 let top=437.333,height=80;
 vi.spyOn(dock,'getBoundingClientRect').mockImplementation(()=>({top,height} as DOMRect));
 return{dock,move:(next:number,nextHeight=80)=>{top=next;height=nextHeight;}};
}
it('reserves the measured Dock top at the original 150% failure geometry',()=>{
 const {dock}=setup();render(<QuickMemoSurface onClose={()=>{}}><textarea aria-label="메모"/></QuickMemoSurface>);
 expect(document.querySelector('.quick-memo-surface')?.getAttribute('style')).toContain('425px');
 expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBeNull();dock.remove();
});
it('recalculates for viewport zoom and wrapped or relocated Dock without a fixed Dock height',()=>{
 const {dock,move}=setup();render(<QuickMemoSurface onClose={()=>{}}><textarea/></QuickMemoSurface>);
 move(300,160);observers[0].callback();expect(document.querySelector('.quick-memo-surface')?.getAttribute('style')).toContain('288px');
 vi.stubGlobal('innerHeight',240);fireEvent(window,new Event('resize'));expect(document.querySelector('.quick-memo-surface')?.getAttribute('style')).toContain('240px');dock.remove();
});
it('keeps input, close, Escape, focus restoration and the background non-inert',()=>{
 const {dock}=setup();function Host(){const[open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>메모 열기</button>{open&&<QuickMemoSurface onClose={()=>setOpen(false)}><textarea aria-label="메모 입력"/></QuickMemoSurface>}</>;}
 const view=render(<Host/>),button=screen.getByText('메모 열기');button.focus();fireEvent.click(button);
 const input=screen.getByLabelText('메모 입력');fireEvent.change(input,{target:{value:'합성 메모'}});input.focus();fireEvent.keyDown(input,{key:'Escape'});
 expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(button);expect(view.container.inert).not.toBe(true);
 fireEvent.click(button);fireEvent.click(screen.getByRole('button',{name:'빠른 메모 닫기'}));expect(screen.queryByRole('dialog')).toBeNull();dock.remove();
});
it('disconnects geometry observers and leaves ordinary modal markup unmodified',()=>{
 const {dock}=setup();const view=render(<QuickMemoSurface onClose={()=>{}}><textarea/></QuickMemoSurface>);view.unmount();expect(observers[0].disconnect).toHaveBeenCalledOnce();
 render(<SurfaceDialog title="설정" onClose={()=>{}}><input/></SurfaceDialog>);expect(document.querySelector('.rose-overlay')?.classList.contains('quick-memo-surface')).toBe(false);expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');dock.remove();
});
